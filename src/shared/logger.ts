import pino, { type Logger } from "pino";

export function createLogger(level = process.env.LOG_LEVEL ?? "info"): Logger {
  return pino({
    level,
    base: null,
    redact: {
      paths: [
        "apiKey",
        "apiToken",
        "clientSecret",
        "authToken",
        "headers.api-key",
        "headers.X-Api-Token",
        "headers.Authorization",
      ],
      censor: "[REDACTED]",
    },
  });
}
