import type { AppConfig } from "./config.js";
import { uniqueBy } from "./domain/deduplicate.js";
import { createEmailMessage } from "./domain/email-template.js";
import { normalizeDomain } from "./domain/normalize.js";
import { AppError, ConfigurationError } from "./shared/error.js";
import type {
    CompanyFinder,
    ContactFinder,
    DeliveryConfirmation,
    EmailResolver,
    EmailSender,
    PipelinePresenter,
    PipelineResult,
    RunMode,
} from "./types.js";

export interface PipelineDependencies {
    companyFinder: CompanyFinder;
    contactFinder: ContactFinder;
    emailResolver: EmailResolver;
    emailSender: EmailSender | null;
    presenter: PipelinePresenter;
    confirmDelivery: DeliveryConfirmation;
}

export class OutreachPipeline {
    constructor(
        private readonly config: AppConfig,
        private readonly dependencies: PipelineDependencies,
    ) { }

    async run(seedInput: string, mode: RunMode): Promise<PipelineResult> {
        const seedDomain = normalizeDomain(seedInput);
        this.dependencies.presenter.stage(`Starting pipeline for ${seedDomain}`);

        this.dependencies.presenter.stage("Ocean: finding lookalike companies");
        const companies = uniqueBy(
            await this.dependencies.companyFinder.findLookalikes(seedDomain),
            (company) => company.domain,
        ).slice(0, this.config.limits.maxCompanies);

        if (companies.length === 0) {
            throw new AppError(
                "Pipeline",
                "Ocean produced no usable companies. Stopping before Prospeo.",
            );
        }

        this.dependencies.presenter.stage(
            `Prospeo: finding decision-makers at ${companies.length} companies`,
        );
        const contacts = uniqueBy(
            await this.dependencies.contactFinder.findDecisionMakers(companies),
            (contact) => contact.linkedinUrl,
        );

        if (contacts.length === 0) {
            throw new AppError(
                "Pipeline",
                "Prospeo produced no usable contacts. Stopping before Eazyreach.",
            );
        }

        this.dependencies.presenter.stage(
            `Prospeo: resolving ${contacts.length} LinkedIn profiles`,
        );
        const enrichment =
            await this.dependencies.emailResolver.resolveVerifiedEmails(contacts);

        const recipients = uniqueBy(
            enrichment.contacts.filter(
                (contact) => !this.config.suppressionList.has(contact.email),
            ),
            (contact) => contact.email,
        );

        if (recipients.length === 0) {
            throw new AppError(
                "Pipeline",
                "No verified, non-suppressed email addresses remain.",
            );
        }

        const companiesByDomain = new Map(
            companies.map((company) => [company.domain, company]),
        );
        const messages = recipients.map((contact) =>
            createEmailMessage(
                contact,
                companiesByDomain.get(contact.companyDomain),
                this.config.emailContent,
            ),
        );

        const previewResult = {
            seedDomain,
            companies,
            contacts,
            recipients,
            messages,
            enrichmentSkipped: enrichment.skipped,
            enrichmentFailed: enrichment.failed,
        };
        this.dependencies.presenter.summary(previewResult, mode);

        if (mode === "mock" || mode === "live-data") {
            return {
                ...previewResult,
                deliveryResults: [],
                cancelled: false,
            };
        }

        if (!this.dependencies.emailSender) {
            throw new ConfigurationError("No email sender was configured.");
        }

        if (mode === "send" && messages.length > this.config.limits.maxRealEmails) {
            throw new AppError(
                "Safety",
                `Refusing to send ${messages.length} messages; MAX_REAL_EMAILS is ${this.config.limits.maxRealEmails}.`,
            );
        }

        const confirmed = await this.dependencies.confirmDelivery(
            mode,
            messages.length,
        );
        if (!confirmed) {
            this.dependencies.presenter.stage(
                "Confirmation did not match; cancelled",
            );
            return {
                ...previewResult,
                deliveryResults: [],
                cancelled: true,
            };
        }

        this.dependencies.presenter.stage(
            mode === "sandbox-email"
                ? "Brevo: validating messages in sandbox mode"
                : "Brevo: sending messages",
        );
        const deliveryResults = await this.dependencies.emailSender.send(
            messages,
            mode === "sandbox-email",
        );

        return {
            ...previewResult,
            deliveryResults,
            cancelled: false,
        };
    }
}
