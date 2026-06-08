import { describe, expect, it } from "vitest";
import { normalizeDomain } from "../src/domain/normalize.js";

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
});
