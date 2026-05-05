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

export function readString(key: string, fallback: string): string {
    try {
        return window.localStorage?.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}

export function writeString(key: string, value: string): void {
    try {
        window.localStorage?.setItem(key, value);
    } catch {
        // Persistence is optional in WebView smoke contexts with opaque origins.
    }
}

export function readStringList(key: string, fallback: string[]): string[] {
    try {
        const raw = window.localStorage?.getItem(key);
        if (!raw) return [...fallback];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [...fallback];
    } catch {
        return [...fallback];
    }
}

export function writeStringList(key: string, values: string[]): void {
    try {
        window.localStorage?.setItem(key, JSON.stringify([...new Set(values)]));
    } catch {
        // Persistence is optional in WebView smoke contexts with opaque origins.
    }
}
