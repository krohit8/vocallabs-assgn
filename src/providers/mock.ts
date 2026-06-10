import { uniqueBy } from "../domain/deduplicate.js";
import { normalizeLinkedinUrl } from "../domain/normalize.js";
import type {
  Company,
  CompanyFinder,
  Contact,
  ContactFinder,
  EmailResolver,
  EnrichedContact,
  EnrichmentResult,
} from "../types.js";

export class MockCompanyFinder implements CompanyFinder {
  async findLookalikes(seedDomain: string): Promise<Company[]> {
    const companies: Company[] = [
      {
        domain: "northstar-analytics.test",
        name: "Northstar Analytics",
        description: "Analytics software for operations teams.",
        industries: ["Analytics", "Software"],
        size: "51-200",
        country: "us",
      },
      {
        domain: "harbor-workflows.test",
        name: "Harbor Workflows",
        description: "Workflow automation for growing businesses.",
        industries: ["Automation", "B2B"],
        size: "11-50",
        country: "gb",
      },
      {
        domain: "northstar-analytics.test",
        name: "Duplicate Northstar",
        description: "This record demonstrates deduplication.",
        industries: ["Software"],
        size: "51-200",
        country: "us",
      },
    ];

    return uniqueBy(
      companies.filter((company) => company.domain !== seedDomain),
      (company) => company.domain,
    );
  }
}

export class MockContactFinder implements ContactFinder {
  async findDecisionMakers(companies: Company[]): Promise<Contact[]> {
    const contacts = [
      {
        firstName: "Maya",
        lastName: "Chen",
        fullName: "Maya Chen",
        title: "Chief Revenue Officer",
        linkedinUrl: "https://www.linkedin.com/in/maya-chen-example",
        companyDomain: companies[0]?.domain ?? "",
        companyName: companies[0]?.name ?? "",
      },
      {
        firstName: "Arjun",
        lastName: "Rao",
        fullName: "Arjun Rao",
        title: "VP Sales",
        linkedinUrl: "https://www.linkedin.com/in/arjun-rao-example/",
        companyDomain: companies[1]?.domain ?? "",
        companyName: companies[1]?.name ?? "",
      },
      {
        firstName: "Arjun",
        lastName: "Rao",
        fullName: "Duplicate Arjun",
        title: "VP Sales",
        linkedinUrl:
          "https://www.linkedin.com/in/arjun-rao-example/?tracking=duplicate",
        companyDomain: companies[1]?.domain ?? "",
        companyName: companies[1]?.name ?? "",
      },
    ];

    return uniqueBy(
      contacts.flatMap((contact) => {
        const linkedinUrl = normalizeLinkedinUrl(contact.linkedinUrl);
        return linkedinUrl && contact.companyDomain
          ? [{ ...contact, linkedinUrl }]
          : [];
      }),
      (contact) => contact.linkedinUrl,
    );
  }
}

export class MockEmailResolver implements EmailResolver {
  async resolveVerifiedEmails(contacts: Contact[]): Promise<EnrichmentResult> {
    const fakeEmails = [
      "maya@northstar-analytics.test",
      "arjun@harbor-workflows.test",
    ];

    const enriched: EnrichedContact[] = contacts.map((contact, index) => ({
      ...contact,
      email: fakeEmails[index] ?? `person${index + 1}@example.test`,
      emailStatus: "verified",
    }));

    return {
      contacts: uniqueBy(enriched, (contact) => contact.email),
      skipped: 0,
      failed: 0,
    };
  }
}
