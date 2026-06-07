import { AppError } from "../shared/error.js"

export function normalizeDomain(rawValue: string): string {
    if (!rawValue.trim()) {
        throw new AppError("Input", "A domain is required")
    }
    const candidate = rawValue.includes("://") ? rawValue : `https://${rawValue}`
    let hostname: string
    try {
        hostname = new URL(candidate).hostname.toLowerCase()
    } catch (error) {
        throw new AppError("Input", `${rawValue} is not a valid domain`)
    }
    const labels = hostname.split(".")
    const validLabels = labels.every(
        (label) =>
            label.length > 0 &&
            label.length <= 63 &&
            /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    )
    if (labels.length < 2 && !validLabels) {
        throw new AppError("Input", `${rawValue} is not a usable root domain`)
    }
    return hostname
}

export function tryNormalizeDomain(rawValue: string | null | undefined): string | null {
    if (!rawValue) {
        return null
    }
    try {
        return normalizeDomain(rawValue)
    } catch (error) {
        return null
    }
}
