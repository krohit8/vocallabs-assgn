import type { Logger } from "pino";
import type { ZodType } from "zod";
import { ProviderError } from "./error.js";

export interface HttpClientOptions {
    timeoutMs: number;
    maxRetries: number;
    fetchImplementation?: typeof fetch;
    logger: Logger;
}

export class HttpClient {
    readonly #timeoutMs: number;
    readonly #maxRetries: number;
    readonly #fetch: typeof fetch;
    readonly #logger: Logger;

    constructor(options: HttpClientOptions) {
        this.#timeoutMs = options.timeoutMs;
        this.#maxRetries = options.maxRetries;
        this.#fetch = options.fetchImplementation ?? fetch;
        this.#logger = options.logger;

    }
    async request<T>(
        stage: string,
        url: string,
        init: RequestInit,
        schema: ZodType<T>
    ) {
        for (let attempt = 0; attempt <= this.#maxRetries; attempt += 1) {
            let response: Response;
            try {
                response = await this.#fetch(url, {
                    ...init,
                    signal: AbortSignal.timeout(this.#timeoutMs)
                })
            } catch (error) {
                if (attempt < this.#maxRetries) {
                    await this.#waitBeforeRetry(stage, attempt, 0)
                    continue;
                }
                throw new ProviderError(stage, "Network request failed", {
                    cause: error,
                })
            }
            const body = await this.#readBody(response)
            if (response.ok) {
                const parsed = schema.safeParse(body)
                if (!parsed.success) {
                    throw new ProviderError(stage, "Provider returned an unexpected response",
                        {
                            status: response.status,
                            body: parsed.error.flatten()
                        }
                    )
                }
                return parsed.data
            }
            const retryable = response.status === 429 ||
                [500, 502, 503, 504].includes(response.status);
            if (retryable && attempt < this.#maxRetries) {
                await this.#waitBeforeRetry(
                    stage,
                    attempt,
                    this.#retryAfterMilliseconds(response)
                )
                continue
            }
            throw new ProviderError(
                stage,
                this.#providerMessage(body, response.status), {
                status: response.status,
                body
            }
            )
        }
        throw new ProviderError(stage, "Retry loop ended unexpectedly.");
    }

    async #readBody(response: Response): Promise<unknown> {
        const text = await response.text()
        if (!text) {
            return null;
        }
        try {
            return JSON.parse(text)
        } catch (error) {
            return { raw: text.slice(0, 500) }
        }
    }
    #providerMessage(body: unknown, status: number): string {
        if (body && typeof body === "object") {
            for (const key of ["detail", "message", "error_code", "error"]) {
                const value = Reflect.get(body, key);
                if (typeof value === "string" && value) {
                    return value;
                }
            }
        }
        return `HTTP ${status}`;
    }

    async #retryAfterMilliseconds(response: Response): number {
        const retryAfter = response.headers.get("retry-after")
        if (!retryAfter) {
            return 0
        }
        const seconds = Number.parseFloat(retryAfter);
        if (Number.isFinite(seconds)) {
            return Math.max(0, seconds * 1_000);
        }

        const dateDelay = Date.parse(retryAfter) - Date.now();
        return Number.isFinite(dateDelay) ? Math.max(0, dateDelay) : 0;
    }

    async #waitBeforeRetry(stage: string, attempt: number, requestDelay: number): Promise<void> {
        const delay = requestDelay || 500 * 2 ** attempt;
        this.#logger.warn({
            stage, attempt: attempt + 1, delay
        },
            "Retrying API request"
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
    }
}

