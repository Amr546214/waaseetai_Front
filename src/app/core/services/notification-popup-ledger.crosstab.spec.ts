import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { vi } from 'vitest';
import { NotificationPopupLedger } from './notification-popup-ledger.service';

/** local/mock: N "tabs" = N ledger instances (distinct tabId) sharing the one jsdom localStorage, optionally one simulated exclusive Web Lock. */
function makeLocks() {
	let tail: Promise<unknown> = Promise.resolve();
	return {
		request: (_name: string, _opts: any, cb: () => any) => {
			const run = tail.then(() => new Promise(r => setTimeout(r, 0))).then(cb); // yields, like a real lock hand-off
			tail = run.catch(() => undefined);
			return run;
		},
	};
}
function tabs(n: number, settleMs = 0): NotificationPopupLedger[] {
	return Array.from({ length: n }, () => {
		const l = new NotificationPopupLedger(); // PLATFORM_ID browser is provided via injection context below
		l.settleMs = settleMs; return l;
	});
}

describe('popup ledger: cross-tab claim', () => {
	const make = (n: number, settle = 0) => TestBed.runInInjectionContext(() => tabs(n, settle));
	beforeEach(() => {
		localStorage.clear();
		TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'browser' }] });
	});
	afterEach(() => { delete (navigator as any).locks; vi.useRealTimers(); TestBed.resetTestingModule(); });

	for (const mode of ['locks', 'fallback'] as const) {
		describe(mode + ' path', () => {
			beforeEach(() => { if (mode === 'locks') Object.defineProperty(navigator, 'locks', { value: makeLocks(), configurable: true }); });
			const settle = mode === 'fallback' ? 25 : 0;

			it('N simultaneous claimers: exactly one wins, the rest are told to retry later', async () => {
				const ts = make(8, settle);
				const rs = await Promise.all(ts.map(t => t.claim('u1', 'n1')));
				expect(rs.filter(r => r.won).length).toBe(1);
				expect(ts.every(t => t.lastPath === mode)).toBe(true);
				const winner = ts[rs.findIndex(r => r.won)]; await winner.commit('u1', 'n1');
				const again = await Promise.all(ts.map(t => t.claim('u1', 'n1')));
				expect(again.filter(r => r.won).length).toBe(0); // committed: nobody shows it again
				expect(again.every(r => r.retryInMs === undefined)).toBe(true);
			});

			it('repeated rounds with many ids never produce two winners', async () => {
				const ts = make(4, settle);
				for (let i = 0; i < 15; i++) {
					const rs = await Promise.all(ts.map(t => t.claim('u1', 'k' + i)));
					expect(rs.filter(r => r.won).length).toBe(1);
					await ts[rs.findIndex(r => r.won)].commit('u1', 'k' + i);
				}
			});

			it('staggered arrival: the late tab sees the claim/commit and does not win', async () => {
				const [a, b] = make(2, settle);
				const ra = await a.claim('u1', 's1');
				const rb = await b.claim('u1', 's1');
				expect([ra.won, rb.won]).toEqual([true, false]);
				expect(rb.retryInMs).toBeGreaterThan(0); // claim still live: would take over only if a dies
				await a.commit('u1', 's1');
				expect((await b.claim('u1', 's1')).won).toBe(false);
			});

			it('claimer dies before showing: after the lease another tab wins; if it had committed nobody does', async () => {
				vi.useFakeTimers({ toFake: ['Date'] });
				const [a, b, c] = make(3, settle);
				const ra = await a.claim('u1', 'd1'); expect(ra.won).toBe(true); // ...tab a then crashes: never commits
				const rb = await b.claim('u1', 'd1'); expect(rb.won).toBe(false);
				vi.setSystemTime(Date.now() + rb.retryInMs! + 1);
				const rb2 = await b.claim('u1', 'd1'); expect(rb2.won).toBe(true);
				expect((await c.claim('u1', 'd1')).won).toBe(false); // b holds the new lease
				await b.commit('u1', 'd1');
				vi.setSystemTime(Date.now() + 60_000);
				expect((await c.claim('u1', 'd1')).won).toBe(false);
			});

			it('refresh / reconnect with the same storage: a new tab instance cannot claim an id shown before', async () => {
				const [a] = make(1, settle);
				expect((await a.claim('u1', 'r1')).won).toBe(true); await a.commit('u1', 'r1');
				const [fresh] = make(1, settle);
				expect((await fresh.claim('u1', 'r1')).won).toBe(false);
				expect((await a.claim('u1', 'r1')).won).toBe(false); // same tab, socket reconnect
			});

			it('the same tab asking twice while its claim is pending does not win twice', async () => {
				const [a] = make(1, settle);
				const rs = await Promise.all([a.claim('u1', 'x'), a.claim('u1', 'x')]);
				expect(rs.filter(r => r.won).length).toBe(1);
			});

			it('account isolation: another user id (or the same user after a role switch) has its own / the same list', async () => {
				const [a, b] = make(2, settle);
				expect((await a.claim('u1', 'same')).won).toBe(true); await a.commit('u1', 'same');
				expect((await b.claim('u2', 'same')).won).toBe(true); await b.commit('u2', 'same');
				expect((await b.claim('u1', 'same')).won).toBe(false); // role switch keeps the user id => the same list
				expect(localStorage.getItem('ws.notif.popped.v1.u1')).toBe('["same"]');
				expect(localStorage.getItem('ws.notif.popped.v1.u2')).toBe('["same"]');
			});
		});
	}

	it('a Web Lock that never grants falls back to the claim-key path instead of losing the popup', async () => {
		Object.defineProperty(navigator, 'locks', { value: { request: (_n: string, o: any) => new Promise((_res, rej) => o.signal.addEventListener('abort', () => rej(new Error('aborted')))) }, configurable: true });
		const [a] = make(1, 0);
		const r = await a.claim('u1', 'z'); expect(r.won).toBe(true); expect(a.lastPath).toBe('fallback');
	}, 6000);

	it('seed marks the unread backlog as handled', async () => {
		const [a, b] = make(2);
		a.seed('u1', ['o1', 'o2']);
		expect((await b.claim('u1', 'o1')).won).toBe(false);
	});

	describe('frozen / resumed claimer and mixed lock + fallback paths', () => {
		/** a lock the test controls: requests wait while `held`; abort rejects; honorAbort=false lets a grant arrive after the abort */
		function controllable(honorAbort = true) {
			const st = { held: true, queue: [] as { cb: () => any; res: (v: any) => void; rej: (e: any) => void; aborted: boolean }[], ran: 0 };
			const drain = () => { if (st.held) return; const q = st.queue.splice(0); for (const r of q) { if (r.aborted && honorAbort) continue; st.ran++; Promise.resolve(r.cb()).then(r.res, r.rej); } };
			return { st, release: () => { st.held = false; drain(); },
				locks: { request: (_n: string, o: any, cb: () => any) => new Promise((res, rej) => {
					const r = { cb, res, rej, aborted: false }; st.queue.push(r);
					o?.signal?.addEventListener('abort', () => { r.aborted = true; rej(new DOMException('aborted', 'AbortError')); });
					drain();
				}) } };
		}

		it('winner frozen after the claim, another tab shows + commits after the lease, the first resumes and must NOT show', async () => {
			vi.useFakeTimers({ toFake: ['Date'] });
			const [a, b] = make(2, 0);
			expect((await a.claim('u1', 'f1')).won).toBe(true);
			expect(a.stillOwns('u1', 'f1')).toBe(true);
			// a is frozen; its lease runs out; b claims, shows, commits
			vi.setSystemTime(Date.now() + a.leaseMs + 10);
			expect((await b.claim('u1', 'f1')).won).toBe(true); expect(b.stillOwns('u1', 'f1')).toBe(true); await b.commit('u1', 'f1');
			expect(a.stillOwns('u1', 'f1')).toBe(false); // a resumes: old claim is worthless
		});

		it('lease expired and nobody else took over: the resumed tab still drops it (no display on an old claim)', async () => {
			vi.useFakeTimers({ toFake: ['Date'] });
			const [a] = make(1, 0);
			expect((await a.claim('u1', 'f2')).won).toBe(true);
			vi.setSystemTime(Date.now() + a.leaseMs + 1);
			expect(a.stillOwns('u1', 'f2')).toBe(false);
		});

		it('already committed by another tab while this one waited: stillOwns is false', async () => {
			const [a, b] = make(2, 0);
			expect((await a.claim('u1', 'f3')).won).toBe(true);
			b.seed('u1', ['f3']);
			expect(a.stillOwns('u1', 'f3')).toBe(false);
		});

		it('another tab\'s earlier-ordered claim or a replaced token means not the owner', async () => {
			const [a] = make(1, 0);
			expect((await a.claim('u1', 'f4')).won).toBe(true);
			localStorage.setItem('ws.notif.claim.v1.u1.f4.' + a.tabId, JSON.stringify({ exp: Date.now() + 5000, ts: Date.now(), tok: 'other' }));
			expect(a.stillOwns('u1', 'f4')).toBe(false);
		});

		it('lock times out (2 s) -> fallback claims; the lock is granted late: the late callback abandons, and a lock-path tab then loses to the fallback winner', async () => {
			const c = controllable(false); Object.defineProperty(navigator, 'locks', { value: c.locks, configurable: true });
			const [a, b] = make(2, 0);
			const ra = await a.claim('u1', 'm1'); // blocked lock -> after 2 s the fallback decides
			expect(ra.won).toBe(true); expect(a.lastPath).toBe('fallback');
			const pb = b.claim('u1', 'm1'); // also queued behind the held lock
			c.release(); // late grants: a's abandoned callback must not decide; b's decides and sees a's live claim
			const rb = await pb;
			expect(rb.won).toBe(false);
			expect(c.st.ran).toBe(2);
			await a.commit('u1', 'm1');
			expect((await b.claim('u1', 'm1')).won).toBe(false);
		}, 9000);

		it('both paths at once: a tab on the lock path and a tab on the fallback path never both win', async () => {
			for (let i = 0; i < 10; i++) {
				const c = controllable(); c.release(); Object.defineProperty(navigator, 'locks', { value: c.locks, configurable: true });
				const [viaLock, viaFallback] = make(2, 20);
				const origLocks = (navigator as any).locks;
				const rs = await Promise.all([
					viaLock.claim('u1', 'both' + i),
					(async () => { Object.defineProperty(navigator, 'locks', { value: undefined, configurable: true }); const r = viaFallback.claim('u1', 'both' + i); Object.defineProperty(navigator, 'locks', { value: origLocks, configurable: true }); return r; })(),
				]);
				expect(rs.filter(r => r.won).length).toBe(1);
			}
		});
	});
});
