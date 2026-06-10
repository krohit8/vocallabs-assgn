import { z } from "zod"
import type { Company, CompanyFinder } from "../types.js";
import type { HttpClient } from "../shared/http-client.js";
import type { Logger } from "pino";
import { tryNormalizeDomain } from "../domain/normalize.js";
import { uniqueBy } from "../domain/deduplicate.js";

const OCEAN_URL = "https://api.ocean.io/v3/search/companies";

const oceanResponseSchema = z.object({
    companies: z.array(
        z.object({
            domain: z.string().nullish(),
            name: z.string().nullish(),
            companySize: z.string().nullish(),
            primaryCountry: z.string().nullish(),
            industries: z.array(z.string()).nullish(),
            technologies: z.string().nullish(),
            description: z.string().nullish(),
        })
    )
        .default([]),
    missingDomains: z.record(z.string(), z.string()).optional()
})
    .loose();

export class OceanClient implements CompanyFinder {
    constructor(
        private readonly http: HttpClient,
        private readonly apiToken: string,
        private readonly maxCompanies: number,
        private readonly logger: Logger
    ) { }
    async findLookalikes(seedDomain: string): Promise<Company[]> {
        const response = await this.http.request(
            "Ocean",
            OCEAN_URL,
            {
                method: 'POST',
                headers: {
                    'X-Api-Token': this.apiToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    companiesFilters: {
                        lookalikeDomains: [seedDomain],
                        excludeDomains: [seedDomain],
                        companyMatchingMode: "precise",
                    },
                    size: this.maxCompanies + 1,
                    fields: [
                        "domain",
                        "name",
                        "description",
                        "industries",
                        "companySize",
                        "primaryCountry",
                    ]
                }),
            },
            oceanResponseSchema
        )
        const missingStatus = response.missingDomains?.[seedDomain]
        if (missingStatus) {
            this.logger.warn(
                { seedDomain, missingStatus },
                "Ocean reported a seed-domain indexing status"
            )
        }
        const companies = response.companies.flatMap((company) => {
            const domain = tryNormalizeDomain(company.domain)
            if (!domain || domain === seedDomain) {
                return []
            }
            return [
                {
                    domain,
                    name: company.name || domain,
                    description: company.description || "",
                    industries: company.industries ?? [],
                    size: company.companySize || "",
                    country: company.primaryCountry || "",
                }
            ]
        })
        return uniqueBy(companies, (company) => company.domain).slice(0, this.maxCompanies)
    }
}