import type { Logger } from "pino";
import { z } from "zod";

import { uniqueBy } from "../domain/deduplicate.js";
import { normalizeEmail } from "../domain/normalize.js";
import { ProviderError } from "../shared/error.js";
import type { HttpClient } from "../shared/http-client.js";
import type {
  Contact,
  EmailResolver,
  EnrichedContact,
  EnrichmentResult,
} from "../types.js";

const EAZYREACH_BASE_URL = "https://api.superflow.run/b2b";

const authenticationResponseSchema = z
  .object({
    auth_token: z.string().min(1),
  })
  .passthrough();

const emailResponseSchema = z
  .object({
    emails: z
      .array(
        z.object({
          email: z.string().nullish(),
          verification: z.string().nullish(),
          source: z.string().nullish(),
        }),
      )
      .default([]),
  })
  .passthrough();

export class EazyreachClient implements EmailResolver {
  constructor(
    private readonly http: HttpClient,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly logger: Logger,
  ) {}

  async resolveVerifiedEmails(contacts: Contact[]): Promise<EnrichmentResult> {
    const authToken = await this.authenticate();
    const enriched: EnrichedContact[] = [];
    let skipped = 0;
    let failed = 0;

    for (const contact of contacts) {
      try {
        const response = await this.http.request(
          "Eazyreach email",
          `${EAZYREACH_BASE_URL}/linkedin-emails`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              linkedinUrl: contact.linkedinUrl,
            }),
          },
          emailResponseSchema,
        );

        const email = this.pickVerifiedEmail(response.emails);
        if (!email) {
          skipped += 1;
          this.logger.warn(
            { linkedinUrl: contact.linkedinUrl },
            "Eazyreach returned no verified email",
          );
          continue;
        }

        enriched.push({
          ...contact,
          email,
          emailStatus: "verified",
        });
      } catch (error) {
        if (
          error instanceof ProviderError &&
          [400, 404].includes(error.status ?? 0)
        ) {
          skipped += 1;
          this.logger.warn(
            { linkedinUrl: contact.linkedinUrl, status: error.status },
            "Skipping unavailable Eazyreach profile",
          );
          continue;
        }

        if (
          error instanceof ProviderError &&
          [401, 402, 403].includes(error.status ?? 0)
        ) {
          throw error;
        }

        failed += 1;
        this.logger.warn(
          { linkedinUrl: contact.linkedinUrl, error },
          "Eazyreach lookup failed",
        );
      }
    }

    return {
      contacts: uniqueBy(enriched, (contact) => contact.email),
      skipped,
      failed,
    };
  }

  async authenticate(): Promise<string> {
    const response = await this.http.request(
      "Eazyreach auth",
      `${EAZYREACH_BASE_URL}/createAuthToken/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: this.clientId,
          clientSecret: this.clientSecret,
        }),
      },
      authenticationResponseSchema,
    );

    return response.auth_token;
  }

  private pickVerifiedEmail(
    emails: z.infer<typeof emailResponseSchema>["emails"],
  ): string | null {
    for (const candidate of emails) {
      if (
        candidate.verification?.toLowerCase() !== "verified" ||
        !candidate.email
      ) {
        continue;
      }

      const normalized = normalizeEmail(candidate.email);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }
}
