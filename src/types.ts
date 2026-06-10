


export interface Company {
    domain: string
    name: string,
    description: string,
    companySize: string,
    primaryCountry: string,
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