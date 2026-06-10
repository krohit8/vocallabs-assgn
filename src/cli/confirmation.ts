import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import type { DeliveryConfirmation } from "../types.js";

export const confirmDelivery: DeliveryConfirmation = async (
  mode,
  messageCount,
) => {
  const phrase =
    mode === "sandbox-email"
      ? `SANDBOX ${messageCount}`
      : `SEND ${messageCount}`;
  const readline = createInterface({ input: stdin, output: stdout });

  try {
    const answer = await readline.question(
      `Type "${phrase}" exactly to continue: `,
    );
    return answer.trim() === phrase;
  } finally {
    readline.close();
  }
};
