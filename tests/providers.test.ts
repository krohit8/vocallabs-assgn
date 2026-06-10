import pino from "pino";
import { describe, expect, it, vi } from "vitest";

import { BrevoClient } from "../src/providers/brevo.js";
import { EazyreachClient } from "../src/providers/eazyreach.js";
import { OceanClient } from "../src/providers/ocean.js";
import { ProspeoClient } from "../src/providers/prospeo.js";
import { HttpClient } from "../src/shared/http-client.js";
import type { Company, Contact, EmailMessage } from "../src/types.js";

const logger = pino({ level: "silent" });

function clientFor(fetchMock: ReturnType<typeof vi.fn>): HttpClient {
  return new HttpClient({
    timeoutMs: 1_000,
    maxRetries: 0,
    fetchImplementation: fetchMock as typeof fetch,
    logger,
  });
}

const company: Company = {
  domain: "acme.test",
  name: "Acme",
  description: "",
  industries: [],
  size: "",
  country: "",
};

const contact: Contact = {
  firstName: "Maya",
  lastName: "Chen",
  fullName: "Maya Chen",
  title: "VP Sales",
  linkedinUrl: "https://www.linkedin.com/in/maya",
  companyDomain: "acme.test",
  companyName: "Acme",
};

describe("provider adapters", () => {
  it("maps Ocean companies and sends the lookalike filter", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          companies: [
            {
              domain: "www.acme.test",
              name: "Acme",
              description: "Software",
              industries: ["Software"],
              companySize: "11-50",
              primaryCountry: "us",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const ocean = new OceanClient(clientFor(fetchMock), "token", 5, logger);

    await expect(ocean.findLookalikes("seed.test")).resolves.toEqual([
      {
        domain: "acme.test",
        name: "Acme",
        description: "Software",
        industries: ["Software"],
        size: "11-50",
        country: "us",
      },
    ]);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      companiesFilters: { lookalikeDomains: string[] };
    };
    expect(body.companiesFilters.lookalikeDomains).toEqual(["seed.test"]);
  });

  it("paginates Prospeo and normalizes LinkedIn URLs", async () => {
    const page = (number: number, total: number, suffix: string) =>
      new Response(
        JSON.stringify({
          results: [
            {
              person: {
                first_name: "Maya",
                last_name: suffix,
                full_name: `Maya ${suffix}`,
                current_job_title: "VP Sales",
                linkedin_url: `linkedin.com/in/maya-${suffix}/`,
              },
              company: { name: "Acme", domain: "acme.test" },
            },
          ],
          pagination: { current_page: number, total_page: total },
        }),
        { status: 200 },
      );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(1, 2, "one"))
      .mockResolvedValueOnce(page(2, 2, "two"));
    const prospeo = new ProspeoClient(
      clientFor(fetchMock),
      "key",
      2,
      3,
      logger,
    );

    const contacts = await prospeo.findDecisionMakers([company]);

    expect(contacts).toHaveLength(2);
    expect(contacts[0]?.linkedinUrl).toBe(
      "https://www.linkedin.com/in/maya-one",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps only verified Eazyreach emails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ auth_token: "token" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            emails: [
              { email: "probable@acme.test", verification: "probable" },
              { email: "VERIFIED@acme.test", verification: "verified" },
            ],
          }),
          { status: 200 },
        ),
      );
    const eazyreach = new EazyreachClient(
      clientFor(fetchMock),
      "client",
      "secret",
      logger,
    );

    const result = await eazyreach.resolveVerifiedEmails([contact]);

    expect(result.contacts[0]?.email).toBe("verified@acme.test");
    expect(result.skipped).toBe(0);
  });

  it("adds the Brevo sandbox header to the request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "message-1" }), {
        status: 201,
      }),
    );
    const brevo = new BrevoClient(
      clientFor(fetchMock),
      {
        apiKey: "key",
        senderEmail: "sender@example.com",
        senderName: "Sender",
      },
      logger,
    );
    const message: EmailMessage = {
      contact: {
        ...contact,
        email: "maya@acme.test",
        emailStatus: "verified",
      },
      subject: "Hello",
      textContent: "Plain text",
      htmlContent: "<p>HTML</p>",
    };

    await brevo.send([message], true);

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body)) as {
      headers: { "X-Sib-Sandbox": string };
    };
    expect(body.headers["X-Sib-Sandbox"]).toBe("drop");
  });
});
