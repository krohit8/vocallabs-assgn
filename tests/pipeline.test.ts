import { describe, expect, it, vi } from "vitest";

import { loadConfig } from "../src/config.js";
import { OutreachPipeline } from "../src/pipeline.js";
import {
  MockCompanyFinder,
  MockContactFinder,
  MockEmailResolver,
} from "../src/providers/mock.js";
import type {
  EmailSender,
  PipelinePresenter,
  PipelineResult,
} from "../src/types.js";

const presenter: PipelinePresenter = {
  stage: vi.fn(),
  summary: vi.fn(),
};

describe("OutreachPipeline", () => {
  it("runs the complete mock flow without an email sender", async () => {
    const pipeline = new OutreachPipeline(loadConfig("mock", {}), {
      companyFinder: new MockCompanyFinder(),
      contactFinder: new MockContactFinder(),
      emailResolver: new MockEmailResolver(),
      emailSender: null,
      presenter,
      confirmDelivery: vi.fn(),
    });

    const result = await pipeline.run("https://www.example.com/path", "mock");

    expect(result.seedDomain).toBe("example.com");
    expect(result.messages).toHaveLength(2);
    expect(result.deliveryResults).toEqual([]);
  });

  it("does not call the sender when confirmation is rejected", async () => {
    const sender: EmailSender = {
      send: vi.fn(async () => []),
    };
    const config = loadConfig("mock", {});
    const pipeline = new OutreachPipeline(config, {
      companyFinder: new MockCompanyFinder(),
      contactFinder: new MockContactFinder(),
      emailResolver: new MockEmailResolver(),
      emailSender: sender,
      presenter,
      confirmDelivery: vi.fn(async () => false),
    });

    const result: PipelineResult = await pipeline.run(
      "example.com",
      "sandbox-email",
    );

    expect(result.cancelled).toBe(true);
    expect(sender.send).not.toHaveBeenCalled();
  });
});
