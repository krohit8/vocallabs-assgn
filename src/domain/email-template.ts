import type { AppConfig } from "../config.js";
import type { Company, EmailMessage, EnrichedContact } from "../types.js";

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

export function createEmailMessage(
    contact: EnrichedContact,
    company: Company | undefined,
    content: AppConfig["emailContent"],
): EmailMessage {
    const firstName = contact.firstName || "there";
    const companyName =
        contact.companyName || company?.name || contact.companyDomain;
    const roleContext = contact.title
        ? `Given your role as ${contact.title} at ${companyName},`
        : `Given your work at ${companyName},`;
    const subject = `${firstName}, a quick question about ${companyName}`;

    const textContent = `Hi ${firstName},

${roleContext} I thought this might be relevant.

${content.offer}

Would a short conversation next week be useful?

${content.signatureName}
${content.companyName}
${content.postalAddress}

If you do not want future messages from me, reply "no" and I will remove you.`;

    const htmlContent = `<p>Hi ${escapeHtml(firstName)},</p>
<p>${escapeHtml(roleContext)} I thought this might be relevant.</p>
<p>${escapeHtml(content.offer)}</p>
<p>Would a short conversation next week be useful?</p>
<p>${escapeHtml(content.signatureName)}<br>
${escapeHtml(content.companyName)}<br>
${escapeHtml(content.postalAddress)}</p>
<p><small>If you do not want future messages from me, reply "no" and I will remove you.</small></p>`;

    return {
        contact,
        subject,
        textContent,
        htmlContent,
    };
}
