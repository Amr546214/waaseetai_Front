/**
 * Test helper (no framework import): replaces the global `localStorage` with a small in-memory Storage and returns the restore function.
 * Wait timers persist their end timestamps, and some other specs leave a half-stubbed `localStorage` behind in the shared test worker;
 * the countdown specs install this so they never depend on what ran before them.
 */
export function installMemoryStorage(): () => void {
	const data = new Map<string, string>();
	const storage: Storage = {
		get length() { return data.size; },
		clear: () => data.clear(),
		getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
		key: (i: number) => Array.from(data.keys())[i] ?? null,
		removeItem: (k: string) => { data.delete(k); },
		setItem: (k: string, v: string) => { data.set(k, String(v)); },
	};
	const g = globalThis as any;
	const own = Object.getOwnPropertyDescriptor(g, 'localStorage');
	Object.defineProperty(g, 'localStorage', { configurable: true, writable: true, value: storage });
	return () => {
		if (own) Object.defineProperty(g, 'localStorage', own); else delete g.localStorage;
	};
}
