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
});
