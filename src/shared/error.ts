export class AppError extends Error {
    readonly stage: string
    readonly status?: number
    readonly body?: unknown

    constructor(
        stage: string,
        message: string,
        details: { status?: number; body?: unknown; cause?: unknown } = {},
    ) {
        super(`[${stage}] ${message}`, { cause: details.cause })
        this.name = "AppError"
        this.stage = stage

        if (details.status !== undefined) {
            this.status = details.status
        }
        if (details.body !== undefined) {
            this.body = details.status
        }
    }
}

export class ConfigurationError extends AppError {
    constructor(message: string, cause?: unknown) {
        super("Configuration", message, { cause })
        this.name = "ConfigurationError"
    }
}

export class ProviderError extends AppError {
    constructor(
        stage: string,
        message: string,
        details: { status?: number; body?: unknown; cause?: unknown } = {},
    ) {
        super(stage, message, details)
        this.name = "ProviderError"
    }
}
