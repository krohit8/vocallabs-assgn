#!/usr/bin/env node

import { loadEnvFile } from "node:process";

import { Command } from "commander";

import { confirmDelivery } from "./cli/confirmation.js";
import { ConsolePresenter, printFinalResult } from "./cli/output.js";
import { loadConfig } from "./config.js";
import { OutreachPipeline } from "./pipeline.js";
import { BrevoClient } from "./providers/brevo.js";
import {
  MockCompanyFinder,
  MockContactFinder,
  MockEmailResolver,
} from "./providers/mock.js";
import { OceanClient } from "./providers/ocean.js";
import { ProspeoClient } from "./providers/prospeo.js";
import { AppError } from "./shared/error.js";
import { HttpClient } from "./shared/http-client.js";
import { createLogger } from "./shared/logger.js";
import type {
  CompanyFinder,
  ContactFinder,
  EmailResolver,
  EmailSender,
  RunMode,
} from "./types.js";

interface CliOptions {
  liveData?: boolean;
  sandboxEmail?: boolean;
  send?: boolean;
}

function loadLocalEnvironment(): void {
  try {
    loadEnvFile(".env");
  } catch (error) {
    if (
      !(
        error &&
        typeof error === "object" &&
        Reflect.get(error, "code") === "ENOENT"
      )
    ) {
      throw error;
    }
  }
}

function selectMode(options: CliOptions): RunMode {
  const modes: RunMode[] = [];
  if (options.liveData) modes.push("live-data");
  if (options.sandboxEmail) modes.push("sandbox-email");
  if (options.send) modes.push("send");

  if (modes.length > 1) {
    throw new AppError("CLI", "Choose only one execution mode.");
  }
  return modes[0] ?? "mock";
}

async function main(): Promise<void> {
  loadLocalEnvironment();

  const program = new Command()
    .name("outreach")
    .description("Run the automated outreach pipeline.")
    .argument("<domain>", "seed company domain, for example example.com")
    .option("--live-data", "use live sourcing APIs and preview only")
    .option(
      "--sandbox-email",
      "use live APIs and validate email in Brevo sandbox",
    )
    .option("--send", "request real Brevo delivery")
    .showHelpAfterError();

  program.parse();
  const domain = program.args[0];
  const mode = selectMode(program.opts<CliOptions>());
  const config = loadConfig(mode);
  const logger = createLogger();
  const presenter = new ConsolePresenter();
  const http = new HttpClient({
    ...config.http,
    logger,
  });

  let companyFinder: CompanyFinder;
  let contactFinder: ContactFinder;
  let emailResolver: EmailResolver;
  let emailSender: EmailSender | null = null;

  if (mode === "mock") {
    companyFinder = new MockCompanyFinder();
    contactFinder = new MockContactFinder();
    emailResolver = new MockEmailResolver();
  } else {
    if (!config.liveCredentials) {
      throw new AppError("Configuration", "Live credentials were not loaded.");
    }

    companyFinder = new OceanClient(
      http,
      config.liveCredentials.oceanApiToken,
      config.limits.maxCompanies,
      logger,
    );
    const prospeo = new ProspeoClient(
      http,
      config.liveCredentials.prospeoApiKey,
      config.limits.maxContactsPerCompany,
      config.limits.maxProspeoPages,
      logger,
    );
    contactFinder = prospeo;
    emailResolver = prospeo;
  }

  if (mode === "sandbox-email" || mode === "send") {
    if (!config.brevo) {
      throw new AppError(
        "Configuration",
        "Brevo configuration was not loaded.",
      );
    }
    emailSender = new BrevoClient(http, config.brevo, logger);
  }

  const pipeline = new OutreachPipeline(config, {
    companyFinder,
    contactFinder,
    emailResolver,
    emailSender,
    presenter,
    confirmDelivery,
  });
  const result = await pipeline.run(domain ?? "", mode);
  printFinalResult(result, mode);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
