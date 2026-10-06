// Shared vitest setup (registered in angular.json -> test.options.setupFiles). Test environment only; no production code reads this.
//
// Node >= 25 ships an experimental global `localStorage` that has no methods unless the process is started with `--localstorage-file`
// (it only prints "localStorage is not available because --localstorage-file was not provided"). Code such as AuthStore.initAuth() then
// throws "Cannot read properties of undefined (reading 'getItem')" in every spec that does not stub the storage itself, and whether a
// spec passed depended on which spec ran before it in the same worker. This installs a small in-memory Storage when the global one is
// missing or unusable; specs that stub it with vi.stubGlobal keep working (vitest restores THIS fallback on unstub, not the broken one).
function memoryStorage(): Storage {
	const data = new Map<string, string>();
	return {
		get length() { return data.size; },
		clear: () => data.clear(),
		getItem: (key: string) => (data.has(String(key)) ? data.get(String(key))! : null),
		key: (index: number) => Array.from(data.keys())[index] ?? null,
		removeItem: (key: string) => { data.delete(String(key)); },
		setItem: (key: string, value: string) => { data.set(String(key), String(value)); },
	} as Storage;
}

function usable(name: 'localStorage' | 'sessionStorage'): boolean {
	try {
		const s = (globalThis as any)[name];
		return !!s && typeof s.getItem === 'function' && typeof s.setItem === 'function';
	} catch {
		return false;
	}
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
	if (!usable(name)) {
		Object.defineProperty(globalThis, name, { value: memoryStorage(), configurable: true, writable: true });
	}
}
