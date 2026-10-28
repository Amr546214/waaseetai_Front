import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { IconFnStore } from './icon-fn.store';
import { SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { SiteIdentityService } from '../../../../../core/identity/site-identity.service';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';

const FILE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>';
const rows = Array.from({ length: 300 }, (_, i) => ({ id: 'i-' + i, key: 'icon.fn.i-' + i, label: 'x', library: null, status: 'custom', reason: null, hasDraft: false, stateVersion: 1, activeVersion: 1, defs: 1, variants: 1, viewBox: '0 0 24 24' }));
describe('icon list store: custom glyphs are fetched lazily', () => {
	it('with 300 customised icons only the ones on screen are fetched, once per sha, with bounded concurrency', async () => {
		const items = Object.fromEntries(rows.map(r => ['icon.fn.' + r.id, { url: '/f/' + r.id, sha256: 's-' + r.id, mime: 'image/svg+xml', width: 24, height: 24, version: 1 }]));
		let live = 0, peak = 0; const urls: string[] = [];
		vi.stubGlobal('fetch', vi.fn(async (u: string) => { urls.push(u); live++; peak = Math.max(peak, live); await new Promise(r => setTimeout(r, 1)); live--; return new Response(FILE, { status: 200 }); }));
		TestBed.configureTestingModule({ providers: [IconFnStore, { provide: SiteIdentityAdminApi, useValue: { iconList: () => of({ success: true, data: { total: 300, counts: { default: 0, custom: 300, notWired: 0, withDraft: 0 }, limits: { maxCustom: 355, maxDraftsTotal: 240 }, rows } }) } },
			{ provide: SiteIdentityService, useValue: { manifest: () => ({ items }), absoluteUrl: (u: string) => u } }, { provide: AdminAccessService, useValue: { can: () => true } }] });
		const s = TestBed.inject(IconFnStore); await s.load();
		await s.ensureGlyphs(rows.slice(0, 40).map(r => r.id));
		expect(urls.length).toBe(40); expect(peak).toBeLessThanOrEqual(8); expect(Object.keys(s.customGlyphs()).length).toBe(40);
		await s.ensureGlyphs(rows.slice(0, 60).map(r => r.id));
		expect(urls.length).toBe(60); // the first 40 were not fetched again
		vi.unstubAllGlobals();
	});
});
