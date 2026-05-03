export function readNumber(key: string, fallback: number): number {
    try {
        const raw = window.localStorage?.getItem(key);
        if (raw == null) return fallback;
        const value = Number(raw);
        return Number.isFinite(value) ? value : fallback;
    } catch {
        return fallback;
    }
}

export function writeNumber(key: string, value: number): void {
    try {
        window.localStorage?.setItem(key, String(value));
    } catch {
        // Persistence is optional in WebView smoke contexts with opaque origins.
    }
}
