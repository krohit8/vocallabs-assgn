


export interface Company {
    domain: string
    name: string,
    description: string,
    companySize: string,
    primaryCountry: string,
    industries: string[],
}

export interface CompanyFinder{
    findLookalikes(seedDomain:string): Promise<Company[]>;
}