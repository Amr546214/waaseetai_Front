/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IconsFile, IconsService } from './icons.service';
import { sanitizeLibrarySvg, sanitizeUploadedSvg } from './svg-sanitize';

// Owner report 2026-10-28: after changing an icon in the library and coming back, the library was EMPTY. Root cause: icons.json (and every saved copy) stores the INNER svg markup only;
// sanitizeUploadedSvg demands a full <svg> element, so on reload every saved icon was rejected and the library came back with zero icons.
const FILE: IconsFile = JSON.parse(readFileSync(join(__dirname, '../../../../../../../public/assets/site-control/icons.json'), 'utf8'));
const total = (libs: { icons: unknown[] }[]) => libs.reduce((n, l) => n + l.icons.length, 0);
const KEY = 'waseetai-dtp:icons';

describe('icon library state (load / save / load failure)', () => {
	let svc: IconsService; let http: HttpTestingController;
	beforeEach(() => {
		localStorage.clear(); TestBed.resetTestingModule();
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		svc = TestBed.inject(IconsService); http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => { http.verify(); localStorage.clear(); });
	const load = async (body: IconsFile | null, force = false) => {
		const p = svc.load(force); const r = http.expectOne('/assets/site-control/icons.json');
		if (body) r.flush(body); else r.flush('x', { status: 500, statusText: 'err' });
		await p;
	};

	it('the root cause: the stored form is inner markup, which the full-svg sanitiser rejects (so a saved copy used to vanish)', () => {
		const inner = FILE.libraries[0].icons[0].svg;
		expect(inner.startsWith('<svg')).toBe(false);
		expect(sanitizeUploadedSvg(inner)).toBeNull();
		expect(sanitizeLibrarySvg(inner)).toBeTruthy();
		expect(sanitizeLibrarySvg('<script>alert(1)</script>')).toBeNull(); expect(sanitizeLibrarySvg('<path d="M0 0" onclick="x()"/>')).not.toContain('onclick');
	});

	it('REGRESSION: save() then load() again keeps EVERY icon (the library is not empty after returning)', async () => {
		await load(FILE);
		expect(svc.phase()).toBe('ready'); const n = total(svc.libraries()); expect(n).toBe(total(FILE.libraries)); expect(n).toBeGreaterThan(100);
		svc.reassignSlot('general', 'i-bell', '<circle cx="12" cy="12" r="9"/>');
		expect(svc.save()).toBe(true);
		TestBed.resetTestingModule(); TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		svc = TestBed.inject(IconsService); http = TestBed.inject(HttpTestingController);
		await load(FILE);
		expect(total(svc.libraries())).toBe(n);
		expect(svc.libraries().find(l => l.id === 'general')!.icons.find(i => i.slot === 'i-bell')!.svg).toContain('r="9"');
		expect(svc.savedCopyNotice()).toBeNull();
	});

	it('a saved copy that yields nothing is NOT used and is NOT wiped from storage; the file defaults are shown with a notice', async () => {
		const bad = FILE.libraries.map(l => ({ ...l, icons: l.icons.map(i => ({ ...i, svg: '<script>x</script>' })) }));
		localStorage.setItem(KEY, JSON.stringify({ savedAt: 'x', data: bad }));
		await load(FILE);
		expect(total(svc.libraries())).toBe(total(FILE.libraries));
		expect(svc.savedCopyNotice()).toBeTruthy();
		expect(JSON.parse(localStorage.getItem(KEY)!).data).toEqual(bad);
	});

	it('LOAD FAILURE is an explicit error, never an empty ready library; the saved copy is untouched', async () => {
		localStorage.setItem(KEY, JSON.stringify({ savedAt: 'x', data: FILE.libraries }));
		const before = localStorage.getItem(KEY);
		await load(null);
		expect(svc.phase()).toBe('error'); expect(svc.loadError()).toContain('تعذّر'); expect(svc.libraries()).toEqual([]);
		expect(localStorage.getItem(KEY)).toBe(before);
		await load(FILE, true);
		expect(svc.phase()).toBe('ready'); expect(svc.loadError()).toBeNull(); expect(total(svc.libraries())).toBeGreaterThan(100);
	});

	it('a failed RE-load keeps the libraries already shown', async () => {
		await load(FILE); const n = total(svc.libraries());
		await load(null, true);
		expect(total(svc.libraries())).toBe(n); expect(svc.phase()).toBe('ready'); expect(svc.loadError()).toBeTruthy();
	});

	it('an empty file or a file with no icons is a failure too (never rendered as an empty library)', async () => {
		await load({ version: 1, libraries: [] });
		expect(svc.phase()).toBe('error');
	});

	it('save() never writes an empty library over a saved copy', () => {
		localStorage.setItem(KEY, 'keep');
		expect(svc.save()).toBe(false);
		expect(localStorage.getItem(KEY)).toBe('keep');
	});

	// ---- Round 7: the owner's OLD local customisations are listed FOR REVIEW (diff vs default), never applied to the page and never auto-published
	describe('legacy local customisations (review only)', () => {
		const bell = () => FILE.libraries.flatMap(l => l.icons).find(i => i.slot === 'i-bell')!;
		const withBell = (svg: string) => FILE.libraries.map(l => ({ ...l, icons: l.icons.map(i => (i.slot === 'i-bell' ? { ...i, svg } : i)) }));
		it('an old inner-markup copy with a changed bell is listed (default vs old), the shipped library stays pristine, storage is untouched', async () => {
			const raw = JSON.stringify({ savedAt: 'x', data: withBell('<circle cx="12" cy="12" r="9"/>') }); localStorage.setItem(KEY, raw);
			await load(FILE);
			const l = svc.legacy().find(x => x.slot === 'i-bell')!; expect(l).toBeTruthy(); expect(l.defaultInner).toBe(bell().svg); expect(l.legacyInner).toContain('circle');
			expect(svc.legacy().length).toBe(1);
			expect(svc.pristine().flatMap(x => x.icons).find(i => i.slot === 'i-bell')!.svg).toBe(bell().svg);
			expect(localStorage.getItem(KEY)).toBe(raw);
		});
		it('a copy saved as a FULL svg element is understood too; hostile content is sanitised before it is shown', async () => {
			localStorage.setItem(KEY, JSON.stringify({ savedAt: 'x', data: { libraries: withBell('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" onclick="x()"/><script>alert(1)</script></svg>') } }));
			await load(FILE);
			const l = svc.legacy().find(x => x.slot === 'i-bell')!; expect(l.legacyInner).toContain('rect'); expect(l.legacyInner).not.toContain('script'); expect(l.legacyInner).not.toContain('onclick');
		});
		it('an unchanged saved copy lists nothing; an unusable one lists nothing and is kept', async () => {
			localStorage.setItem(KEY, JSON.stringify({ savedAt: 'x', data: FILE.libraries })); await load(FILE); expect(svc.legacy()).toEqual([]);
			localStorage.setItem(KEY, JSON.stringify({ savedAt: 'x', data: withBell('<script>x</script>') })); await load(FILE, true); expect(svc.legacy()).toEqual([]); expect(localStorage.getItem(KEY)).toContain('script');
		});
		it('a saved copy that cannot be parsed is reported as unreadable and kept as it is', async () => {
			localStorage.setItem(KEY, '{not json'); await load(FILE);
			expect(svc.legacyUnreadable()).toBeTruthy(); expect(svc.legacy()).toEqual([]); expect(localStorage.getItem(KEY)).toBe('{not json'); expect(total(svc.pristine())).toBe(total(FILE.libraries));
		});
		it('ignoring one hides it from the list through a SEPARATE key; the old copy is not deleted; it survives a new service instance', async () => {
			const raw = JSON.stringify({ savedAt: 'x', data: withBell('<circle cx="12" cy="12" r="9"/>') }); localStorage.setItem(KEY, raw);
			await load(FILE); svc.ignoreLegacy('i-bell'); expect(svc.legacyIgnored()).toContain('i-bell'); expect(localStorage.getItem(KEY)).toBe(raw);
			TestBed.resetTestingModule(); TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
			svc = TestBed.inject(IconsService); http = TestBed.inject(HttpTestingController); await load(FILE);
			expect(svc.legacyIgnored()).toContain('i-bell'); svc.ignoreLegacy('i-bell', false); expect(svc.legacyIgnored()).not.toContain('i-bell');
		});
		it('no legacy copy at all: nothing to review, no notice', async () => { await load(FILE); expect(svc.legacy()).toEqual([]); expect(svc.legacyUnreadable()).toBeNull(); });
	});
});
