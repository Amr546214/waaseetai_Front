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

// ---- Isolation between spec files -------------------------------------------------------------------------------------------------------
// The Angular unit-test builder runs vitest with `isolate: false`: every spec file in a worker shares ONE module registry (esbuild chunks such as
// anti-cheat.service / notification-engine.service are evaluated once per worker) and ONE jsdom window (document.cookie, storage). Two kinds of
// state therefore leaked from whichever spec ran first in a worker into the next one, and which spec that was depended on the scheduling
// (vitest orders files by the results cache, workers pick them up as they free up) -> failures that "passed alone / on the next run":
//  1) vi.mock('socket.io-client') in a spec file only binds modules that are first evaluated AFTER it: a service chunk already evaluated under
//     another spec keeps ITS fake socket forever. Fix: ONE mock registered here whose `io` delegates to globalThis.__socketIoModule, which each
//     spec points at its own fake (`__socketIoModule = () => ({ io: ... })`) and which is reset to a harmless default for every file.
//  2) AuthStore.authenticate() writes the waseet_* cookies on the shared document (and storage); the next spec's AuthStore then boots signed in
//     as that user (e.g. a PROVIDER, so a CLIENT notification becomes "role-unavailable" and navigateByUrl is never called). Fix: wipe them
//     before every test.
import { afterAll, beforeEach, vi } from 'vitest';

const sockets = globalThis as any;
const defaultSocket = { connected: false, on: () => defaultSocket, once: () => defaultSocket, off: () => defaultSocket, emit: () => defaultSocket, disconnect: () => defaultSocket, removeAllListeners: () => defaultSocket };
sockets.__socketIoModule = () => ({ io: () => defaultSocket });

vi.mock('socket.io-client', () => {
	const call = (...args: any[]) => {
		const mod = sockets.__socketIoModule();
		const factory = mod.io ?? mod.default;
		return factory(...args);
	};
	return { default: call, io: call };
});

function clearSharedBrowserState() {
	try {
		if (typeof document !== 'undefined') {
			for (const part of document.cookie.split(';')) {
				const name = part.split('=')[0]?.trim();
				if (name) document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
			}
		}
	} catch { /* no document */ }
	for (const name of ['localStorage', 'sessionStorage'] as const) {
		try {
			const s = (globalThis as any)[name];
			if (s && typeof s.clear === 'function') s.clear();
		} catch { /* a spec-stubbed storage without clear() */ }
	}
}
beforeEach(clearSharedBrowserState);

//  3) vi.stubGlobal('localStorage', {...no clear()...}) in specs that never unstub (cart.service.*, project-details.*) stayed installed for
//     the next file in the worker (create-request.milestone-typing: "localStorage.clear is not a function"). Fix: drop leftover stubs when a
//     file starts (this setup file runs before each spec file's own body) and when it ends.
vi.unstubAllGlobals();
afterAll(() => { vi.unstubAllGlobals(); });
