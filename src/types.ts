


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

export interface CompanyFinder{
    findLookalikes(seedDomain:string): Promise<Company[]>;
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
