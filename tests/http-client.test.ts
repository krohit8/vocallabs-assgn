import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ProviderError } from "../src/shared/error.js";
import { HttpClient } from "../src/shared/http-client.js";

const logger = pino({ level: "silent" });
const responseSchema = z.object({ ok: z.boolean() });

describe("HttpClient", () => {
  it("retries a 429 response and validates the successful response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "rate limited" }), {
          status: 429,
          headers: { "retry-after": "0.001" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    const client = new HttpClient({
      timeoutMs: 1_000,
      maxRetries: 1,
      fetchImplementation: fetchMock as typeof fetch,
      logger,
    });

    await expect(
      client.request("Test", "https://example.test", {}, responseSchema),
    ).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent 400 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "bad request" }), {
        status: 400,
      }),
    );
    const client = new HttpClient({
      timeoutMs: 1_000,
      maxRetries: 3,
      fetchImplementation: fetchMock as typeof fetch,
      logger,
    });

    await expect(
      client.request("Test", "https://example.test", {}, responseSchema),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
