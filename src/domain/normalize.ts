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
    return hostname.replace(/^www\./, "")
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

export function normalizeLinkedinUrl(
    rawValue: string | null | undefined
): string | null {
    if (!rawValue) {
        return null
    }
    const candidate = rawValue.includes("://") ? rawValue : `https://${rawValue}`
    try {
        const url = new URL(candidate)
        const hostname = url.hostname.toLowerCase().replace(/^www\./, "")
        if (hostname !== 'linkedin.com' && !hostname.endsWith(".linkedin.com")) {
            return null;
        }
        const pathname = url.pathname.replace(/\/+$/, "");
        return pathname ? `https://www.linkedin.com${pathname}` : null
    } catch {
        return null;
    }
}

export function normalizeEmail(rawValue: string): string | null {
    const value = rawValue.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}