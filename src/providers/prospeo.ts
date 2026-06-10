import type { Logger } from "pino";
import { z } from "zod";

import { uniqueBy } from "../domain/deduplicate.js";
import {
  normalizeEmail,
  normalizeLinkedinUrl,
  tryNormalizeDomain,
} from "../domain/normalize.js";
import { ProviderError } from "../shared/error.js";
import type { HttpClient } from "../shared/http-client.js";
import type {
  Company,
  Contact,
  ContactFinder,
  EmailResolver,
  EnrichedContact,
  EnrichmentResult,
} from "../types.js";

const PROSPEO_URL = "https://api.prospeo.io/search-person";
const PROSPEO_ENRICH_URL = "https://api.prospeo.io/enrich-person";

const prospeoResponseSchema = z
  .object({
    results: z
      .array(
        z.object({
          person: z.object({
            first_name: z.string().nullish(),
            last_name: z.string().nullish(),
            full_name: z.string().nullish(),
            current_job_title: z.string().nullish(),
            linkedin_url: z.string().nullish(),
          }),
          company: z.object({
            name: z.string().nullish(),
            domain: z.string().nullish(),
          }),
        }),
      )
      .default([]),
    pagination: z
      .object({
        current_page: z.number().int().nullish(),
        total_page: z.number().int().nullish(),
      })
      .default({}),
  })
  .passthrough();

const prospeoEnrichResponseSchema = z
  .object({
    error: z.boolean().nullish(),
    person: z
      .object({
        email: z
          .object({
            email: z.string().nullish(),
            status: z.string().nullish(),
          })
          .passthrough()
          .nullish(),
      })
      .passthrough()
      .nullish(),
  })
  .passthrough();

function isNoResultsError(error: unknown): boolean {
  if (
    !(error instanceof ProviderError) ||
    !error.body ||
    typeof error.body !== "object"
  ) {
    return false;
  }
  return Reflect.get(error.body, "error_code") === "NO_RESULTS";
}

export class ProspeoClient implements ContactFinder, EmailResolver {
  constructor(
    private readonly http: HttpClient,
    private readonly apiKey: string,
    private readonly maxContactsPerCompany: number,
    private readonly maxPages: number,
    private readonly logger: Logger,
  ) {}

  async findDecisionMakers(companies: Company[]): Promise<Contact[]> {
    const domains = companies.map((company) => company.domain);
    const maximumContacts = domains.length * this.maxContactsPerCompany;
    const results: z.infer<typeof prospeoResponseSchema>["results"] = [];
    let page = 1;
    let totalPages = 1;

    while (
      page <= totalPages &&
      page <= this.maxPages &&
      results.length < maximumContacts
    ) {
      try {
        const response = await this.http.request(
          "Prospeo",
          PROSPEO_URL,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-KEY": this.apiKey,
            },
            body: JSON.stringify({
              page,
              filters: {
                company: {
                  websites: {
                    include: domains,
                  },
                },
                person_seniority: {
                  include: ["C-Suite", "Vice President"],
                },
                max_person_per_company: this.maxContactsPerCompany,
              },
            }),
          },
          prospeoResponseSchema,
        );

        results.push(...response.results);
        totalPages = Math.max(1, response.pagination.total_page ?? 1);
        this.logger.info(
          {
            page,
            totalPages,
            pageResults: response.results.length,
          },
          "Prospeo page processed",
        );
        page += 1;
      } catch (error) {
        if (isNoResultsError(error)) {
          break;
        }
        throw error;
      }
    }

    const contacts = results.flatMap(({ person, company }) => {
      const linkedinUrl = normalizeLinkedinUrl(person.linkedin_url);
      const companyDomain = tryNormalizeDomain(company.domain);
      if (!linkedinUrl || !companyDomain) {
        return [];
      }

      const fullName =
        person.full_name ||
        [person.first_name, person.last_name].filter(Boolean).join(" ");

      return [
        {
          firstName: person.first_name || "",
          lastName: person.last_name || "",
          fullName,
          title: person.current_job_title || "",
          linkedinUrl,
          companyDomain,
          companyName: company.name || companyDomain,
        },
      ];
    });

    return uniqueBy(contacts, (contact) => contact.linkedinUrl).slice(
      0,
      maximumContacts,
    );
  }

  async resolveVerifiedEmails(contacts: Contact[]): Promise<EnrichmentResult> {
    const enriched: EnrichedContact[] = [];
    let skipped = 0;
    let failed = 0;

    for (const contact of contacts) {
      try {
        const response = await this.http.request(
          "Prospeo Enrich",
          PROSPEO_ENRICH_URL,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-KEY": this.apiKey,
            },
            body: JSON.stringify({
              data: { linkedin_url: contact.linkedinUrl },
              only_verified_email: true,
            }),
          },
          prospeoEnrichResponseSchema,
        );

        const emailObj = response.person?.email;
        const email = emailObj?.email;
        const emailStatus = emailObj?.status;

        if (response.error === false && emailStatus === "VERIFIED" && email) {
          const normalized = normalizeEmail(email);
          if (normalized) {
            enriched.push({
              ...contact,
              email: normalized,
              emailStatus: "verified",
            });
            continue;
          }
        }

        skipped += 1;
        this.logger.warn(
          { linkedinUrl: contact.linkedinUrl },
          "Prospeo returned no verified email",
        );
      } catch (error) {
        if (
          error instanceof ProviderError &&
          [400, 404, 422].includes(error.status ?? 0)
        ) {
          skipped += 1;
          this.logger.warn(
            { linkedinUrl: contact.linkedinUrl, status: error.status },
            "Skipping unavailable Prospeo profile",
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
          "Prospeo lookup failed",
        );
      }
    }

    return {
      contacts: uniqueBy(enriched, (contact) => contact.email),
      skipped,
      failed,
    };
  }
}
