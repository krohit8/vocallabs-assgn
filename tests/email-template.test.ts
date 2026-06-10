import { describe, expect, it } from "vitest";

import { createEmailMessage } from "../src/domain/email-template.js";
import type { EnrichedContact } from "../src/types.js";

const contact: EnrichedContact = {
  firstName: "",
  lastName: "",
  fullName: "",
  title: "",
  linkedinUrl: "https://www.linkedin.com/in/example",
  companyDomain: "example.com",
  companyName: "Example & Sons",
  email: "person@example.com",
  emailStatus: "verified",
};

describe("email template", () => {
  it("uses safe fallbacks and escapes HTML", () => {
    const message = createEmailMessage(contact, undefined, {
      signatureName: "Asha",
      companyName: "Sender <Company>",
      offer: "We improve sales & operations.",
      postalAddress: "123 Example Street",
    });

    expect(message.textContent).toContain("Hi there");
    expect(message.textContent).not.toContain("undefined");
    expect(message.htmlContent).toContain("Example &amp; Sons");
    expect(message.htmlContent).toContain("Sender &lt;Company&gt;");
  });
});
