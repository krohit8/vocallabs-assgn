export function uniqueBy<T>(items: readonly T[], keyFunction: (item: T) => string | null) {
    const seen = new Set<string>()
    const unique: T[] = []

    for (const item of items) {
        const key = keyFunction(item)
        if (!key || seen.has(key)) {
            continue
        }
        seen.add(key)
        unique.push(item)
    }
    return unique
}
