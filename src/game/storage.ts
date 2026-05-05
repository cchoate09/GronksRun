function logStorageError(op: 'read' | 'write', key: string, error: unknown): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[storage] ${op} failed for "${key}": ${message}`);
}

export function readNumber(key: string, fallback: number): number {
    try {
        const raw = window.localStorage?.getItem(key);
        if (raw == null) return fallback;
        const value = Number(raw);
        if (Number.isFinite(value)) return value;
        console.warn(`[storage] read returned non-finite number for "${key}": ${raw}`);
        return fallback;
    } catch (error) {
        logStorageError('read', key, error);
        return fallback;
    }
}

export function writeNumber(key: string, value: number): void {
    try {
        window.localStorage?.setItem(key, String(value));
    } catch (error) {
        logStorageError('write', key, error);
    }
}

export function readString(key: string, fallback: string): string {
    try {
        return window.localStorage?.getItem(key) ?? fallback;
    } catch (error) {
        logStorageError('read', key, error);
        return fallback;
    }
}

export function writeString(key: string, value: string): void {
    try {
        window.localStorage?.setItem(key, value);
    } catch (error) {
        logStorageError('write', key, error);
    }
}

export function readStringList(key: string, fallback: string[]): string[] {
    try {
        const raw = window.localStorage?.getItem(key);
        if (!raw) return [...fallback];
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === 'string');
        console.warn(`[storage] read returned non-array for "${key}", resetting to fallback.`);
        return [...fallback];
    } catch (error) {
        logStorageError('read', key, error);
        return [...fallback];
    }
}

export function writeStringList(key: string, values: string[]): void {
    try {
        window.localStorage?.setItem(key, JSON.stringify([...new Set(values)]));
    } catch (error) {
        logStorageError('write', key, error);
    }
}
