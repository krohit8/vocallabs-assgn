import type { PipelinePresenter, PipelineResult, RunMode } from "../types.js";

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

const modeLabels: Record<RunMode, string> = {
  mock: "MOCK PREVIEW",
  "live-data": "LIVE DATA PREVIEW",
  "sandbox-email": "BREVO SANDBOX",
  send: "REAL SEND",
};

export class ConsolePresenter implements PipelinePresenter {
  stage(message: string): void {
    console.log(`[Pipeline] ${message}`);
  }

  summary(
    result: Omit<PipelineResult, "deliveryResults" | "cancelled">,
    mode: RunMode,
  ): void {
    console.log("\n================ SAFETY SUMMARY ================");
    console.log(`Mode: ${modeLabels[mode]}`);
    console.log(`Seed domain: ${result.seedDomain}`);
    console.log(`Lookalike companies: ${result.companies.length}`);
    console.log(`Decision-makers: ${result.contacts.length}`);
    console.log(`Verified recipients: ${result.recipients.length}`);
    console.log(`Prospeo enrich skipped: ${result.enrichmentSkipped}`);
    console.log(`Prospeo enrich failed: ${result.enrichmentFailed}`);

    console.table(
      result.messages.map((message, index) => ({
        number: index + 1,
        recipient: message.contact.fullName || "(name unavailable)",
        email: maskEmail(message.contact.email),
        company: message.contact.companyName,
        title: message.contact.title,
        subject: message.subject,
      })),
    );

    const firstMessage = result.messages[0];
    if (firstMessage) {
      console.log("\nFirst plain-text email preview:\n");
      console.log(firstMessage.textContent);
    }
    console.log("================================================\n");
  }
}

export function printFinalResult(result: PipelineResult, mode: RunMode): void {
  if (result.cancelled) {
    console.log("Run cancelled. No Brevo request was made.");
    return;
  }

  if (mode === "mock" || mode === "live-data") {
    console.log("Preview complete. No Brevo request was made.");
    return;
  }

  const accepted = result.deliveryResults.filter(
    (delivery) => delivery.ok,
  ).length;
  const failed = result.deliveryResults.length - accepted;
  console.log(`Delivery complete: ${accepted} accepted, ${failed} failed.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}
