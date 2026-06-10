export type RunMode = "mock" | "live-data" | "sandbox-email" | "send";


export interface Company {
    domain: string
    name: string,
    description: string,
    size: string,
    country: string,
    industries: string[],
}
export interface Contact {
    firstName: string;
    lastName: string;
    fullName: string;
    title: string;
    linkedinUrl: string;
    companyDomain: string;
    companyName: string;
}

export interface CompanyFinder {
    findLookalikes(seedDomain: string): Promise<Company[]>;
}

export interface ContactFinder {
    findDecisionMakers(companies: Company[]): Promise<Contact[]>;
}

export interface EnrichedContact extends Contact {
    email: string;
    emailStatus: "verified";
}

export interface EnrichmentResult {
    contacts: EnrichedContact[];
    skipped: number;
    failed: number;
}

export interface EmailResolver {
    resolveVerifiedEmails(contacts: Contact[]): Promise<EnrichmentResult>;
}
export interface EmailMessage {
    contact: EnrichedContact;
    subject: string;
    textContent: string;
    htmlContent: string;
}

export interface DeliveryResult {
    email: string;
    ok: boolean;
    messageId?: string;
    error?: string;
}

export interface EmailSender {
    send(messages: EmailMessage[], sandbox: boolean): Promise<DeliveryResult[]>;
}

export interface PipelineResult {
  seedDomain: string;
  companies: Company[];
  contacts: Contact[];
  recipients: EnrichedContact[];
  messages: EmailMessage[];
  enrichmentSkipped: number;
  enrichmentFailed: number;
  deliveryResults: DeliveryResult[];
  cancelled: boolean;
}
export interface PipelinePresenter {
  stage(message: string): void;
  summary(
    result: Omit<PipelineResult, "deliveryResults" | "cancelled">,
    mode: RunMode,
  ): void;
}
export type DeliveryConfirmation = (
  mode: "sandbox-email" | "send",
  messageCount: number,
) => Promise<boolean>;