export interface AppConfig {
  limits: {
    maxCompanies: number;
    maxContactsPerCompany: number;
    maxProspeoPages: number;
    maxRealEmails: number;
  };
  http: {
    timeoutMs: number;
    maxRetries: number;
  };
  emailContent: {
    signatureName: string;
    companyName: string;
    offer: string;
    postalAddress: string;
  };
  suppressionList: Set<string>;
  liveCredentials: {
    oceanApiToken: string;
    prospeoApiKey: string;
    eazyreachClientId: string;
    eazyreachClientSecret: string;
  } | null;
  brevo: {
    apiKey: string;
    senderEmail: string;
    senderName: string;
  } | null;
  allowRealSend: boolean;
  confirmedOptIn: boolean;
}

import { z } from "zod";

import { ConfigurationError } from "./shared/error.js";
import type { RunMode } from "./types.js";

const baseEnvironmentSchema = z.object({
  MAX_COMPANIES: z.coerce.number().int().min(1).max(50).default(5),
  MAX_CONTACTS_PER_COMPANY: z.coerce.number().int().min(1).max(10).default(2),
  MAX_PROSPEO_PAGES: z.coerce.number().int().min(1).max(20).default(3),
  MAX_REAL_EMAILS: z.coerce.number().int().min(1).max(50).default(10),
  HTTP_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(120_000)
    .default(30_000),
  HTTP_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(3),
  SUPPRESSION_LIST: z.string().default(""),
  OUTREACH_SIGNATURE_NAME: z.string().default("Your Name"),
  OUTREACH_COMPANY_NAME: z.string().default("Your Company"),
  OUTREACH_OFFER: z
    .string()
    .default("[replace this with one clear sentence explaining your offer]"),
  PHYSICAL_POSTAL_ADDRESS: z
    .string()
    .default("[add your valid business postal address]"),
  ALLOW_REAL_SEND: z.enum(["yes", "no"]).default("no"),
  CONFIRMED_OPT_IN: z.enum(["yes", "no"]).default("no"),
});

const liveEnvironmentSchema = z.object({
  OCEAN_API_TOKEN: z.string().min(1),
  PROSPEO_API_KEY: z.string().min(1),
  EAZYREACH_CLIENT_ID: z.string().min(1),
  EAZYREACH_CLIENT_SECRET: z.string().min(1),
});

const deliveryEnvironmentSchema = z.object({
  BREVO_API_KEY: z.string().min(1),
  BREVO_SENDER_EMAIL: z.string().email(),
  BREVO_SENDER_NAME: z.string().min(1),
  OUTREACH_SIGNATURE_NAME: z.string().min(1),
  OUTREACH_COMPANY_NAME: z.string().min(1),
  OUTREACH_OFFER: z.string().min(1),
  PHYSICAL_POSTAL_ADDRESS: z.string().min(1),
});

function parseOrThrow<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join(".") || issue.message)
      .join(", ");
    throw new ConfigurationError(`${label}: ${fields}`, result.error);
  }
  return result.data;
}

export function loadConfig(
  mode: RunMode,
  environment = process.env,
): AppConfig {
  const base = parseOrThrow(
    baseEnvironmentSchema,
    environment,
    "Invalid settings",
  );
  const live =
    mode === "mock"
      ? null
      : parseOrThrow(
          liveEnvironmentSchema,
          environment,
          "Missing or invalid live API credentials",
        );
  const delivery =
    mode === "sandbox-email" || mode === "send"
      ? parseOrThrow(
          deliveryEnvironmentSchema,
          environment,
          "Missing or invalid Brevo/email configuration",
        )
      : null;

  if (mode === "send" && base.ALLOW_REAL_SEND !== "yes") {
    throw new ConfigurationError(
      "Real sending is locked. Set ALLOW_REAL_SEND=yes only for an intentional send.",
    );
  }
  if (mode === "send" && base.CONFIRMED_OPT_IN !== "yes") {
    throw new ConfigurationError(
      "Brevo requires consent. Set CONFIRMED_OPT_IN=yes only for consented recipients.",
    );
  }

  return {
    limits: {
      maxCompanies: base.MAX_COMPANIES,
      maxContactsPerCompany: base.MAX_CONTACTS_PER_COMPANY,
      maxProspeoPages: base.MAX_PROSPEO_PAGES,
      maxRealEmails: base.MAX_REAL_EMAILS,
    },
    http: {
      timeoutMs: base.HTTP_TIMEOUT_MS,
      maxRetries: base.HTTP_MAX_RETRIES,
    },
    emailContent: {
      signatureName: base.OUTREACH_SIGNATURE_NAME,
      companyName: base.OUTREACH_COMPANY_NAME,
      offer: base.OUTREACH_OFFER,
      postalAddress: base.PHYSICAL_POSTAL_ADDRESS,
    },
    suppressionList: new Set(
      base.SUPPRESSION_LIST.split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
    liveCredentials: live
      ? {
          oceanApiToken: live.OCEAN_API_TOKEN,
          prospeoApiKey: live.PROSPEO_API_KEY,
          eazyreachClientId: live.EAZYREACH_CLIENT_ID,
          eazyreachClientSecret: live.EAZYREACH_CLIENT_SECRET,
        }
      : null,
    brevo: delivery
      ? {
          apiKey: delivery.BREVO_API_KEY,
          senderEmail: delivery.BREVO_SENDER_EMAIL,
          senderName: delivery.BREVO_SENDER_NAME,
        }
      : null,
    allowRealSend: base.ALLOW_REAL_SEND === "yes",
    confirmedOptIn: base.CONFIRMED_OPT_IN === "yes",
  };
}
