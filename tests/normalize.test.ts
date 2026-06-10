import { describe, expect, it } from "vitest";

import {
  normalizeDomain,
  normalizeEmail,
  normalizeLinkedinUrl,
} from "../src/domain/normalize.js";

describe("normalization", () => {
  it.each([
    ["example.com", "example.com"],
    ["https://www.Example.com/path", "example.com"],
    ["www.example.com/", "example.com"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it("rejects an invalid domain", () => {
    expect(() => normalizeDomain("not a domain")).toThrow("not a valid domain");
  });

  it("removes LinkedIn tracking data and trailing slashes", () => {
    expect(
      normalizeLinkedinUrl(
        "https://linkedin.com/in/example-person/?tracking=ignored",
      ),
    ).toBe("https://www.linkedin.com/in/example-person");
  });

  it("rejects non-LinkedIn profile URLs", () => {
    expect(normalizeLinkedinUrl("https://example.com/in/person")).toBeNull();
  });

  it("normalizes valid email addresses", () => {
    expect(normalizeEmail(" Person@Example.COM ")).toBe("person@example.com");
    expect(normalizeEmail("invalid")).toBeNull();
  });
});
