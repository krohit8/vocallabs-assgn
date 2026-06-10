import type { Logger } from "pino";
import { z } from "zod";

import type { AppConfig } from "../config.js";
import type { HttpClient } from "../shared/http-client.js";
import type { DeliveryResult, EmailMessage, EmailSender } from "../types.js";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

const brevoResponseSchema = z
  .object({
    messageId: z.string().optional(),
  })
  .passthrough();

export class BrevoClient implements EmailSender {
  constructor(
    private readonly http: HttpClient,
    private readonly config: NonNullable<AppConfig["brevo"]>,
    private readonly logger: Logger,
  ) {}

  async send(
    messages: EmailMessage[],
    sandbox: boolean,
  ): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    for (const message of messages) {
      const body: Record<string, unknown> = {
        sender: {
          name: this.config.senderName,
          email: this.config.senderEmail,
        },
        to: [
          {
            name: message.contact.fullName || message.contact.email,
            email: message.contact.email,
          },
        ],
        replyTo: {
          name: this.config.senderName,
          email: this.config.senderEmail,
        },
        subject: message.subject,
        textContent: message.textContent,
        htmlContent: message.htmlContent,
        tags: ["automated-outreach-demo"],
      };

      if (sandbox) {
        body.headers = {
          "X-Sib-Sandbox": "drop",
        };
      }

      try {
        const response = await this.http.request(
          "Brevo",
          BREVO_URL,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "api-key": this.config.apiKey,
            },
            body: JSON.stringify(body),
          },
          brevoResponseSchema,
        );

        results.push({
          email: message.contact.email,
          ok: true,
          ...(response.messageId ? { messageId: response.messageId } : {}),
        });
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : "Unknown Brevo error";
        results.push({
          email: message.contact.email,
          ok: false,
          error: messageText,
        });
        this.logger.warn(
          { email: message.contact.email, error },
          "Brevo delivery failed",
        );
      }
    }

    return results;
  }
}
