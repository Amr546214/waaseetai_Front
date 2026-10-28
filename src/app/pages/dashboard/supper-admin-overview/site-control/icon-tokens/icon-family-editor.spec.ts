import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { IconFamilyEditor } from './icon-family-editor';
import { IconFnStore } from './icon-fn.store';
import { IconFamilyPreview, SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { SiteIdentityService } from '../../../../../core/identity/site-identity.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { RealIconsService } from '../core/real-icons.service';
import { IconsService } from '../core/icons.service';
import { signal } from '@angular/core';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8"/></svg>';
const SHA = 'c'.repeat(64);
const member = (id: string, o: Record<string, unknown> = {}) => ({ symbolId: id, key: 'icon.fn.' + id, role: id === 'i-bell' ? 'primary' : 'copy', note: 'n', label: id, status: 'default', hasDraft: false, stateVersion: 0, activeVersion: null, activeSha256: null, ...o });
const FAM = { id: 'notifications-bell', label: 'جرس الإشعارات', description: 'وصف', members: [member('i-bell'), member('ws-bell'), member('td-pending-bell', { status: 'not-wired' })], counts: { members: 3, custom: 0, withDraft: 0 }, uniform: true };
const side = (custom: boolean) => ({ source: custom ? 'custom' : 'default', versionId: custom ? 'd1' : null, version: custom ? 1 : 0, sha256: custom ? SHA : 'd'.repeat(64), mime: 'image/svg+xml', width: 24, height: 24, previewUrl: null });
const PREVIEW = (n = 2): IconFamilyPreview => ({ familyId: FAM.id, label: FAM.label, mode: 'publish', previewDigest: 'f'.repeat(64), changedCount: n, canApply: true, items: ['i-bell', 'ws-bell'].slice(0, n).map(id => ({ key: 'icon.fn.' + id, symbolId: id, label: id, stateVersion: id === 'i-bell' ? 3 : 5, current: side(false) as never, target: side(true) as never, change: 'replace' as const })) });
const http = (status: number, body: unknown) => new HttpErrorResponse({ status, error: body });

function setup(over: Record<string, unknown> = {}, canEdit = true) {
	const api: Record<string, ReturnType<typeof vi.fn>> = {
		family: vi.fn(() => of({ success: true, data: FAM })),
		familyUpload: vi.fn(() => of({ success: true, data: { familyId: FAM.id, sha256: SHA, drafts: [{ key: 'icon.fn.i-bell', versionId: 'd1' }, { key: 'icon.fn.ws-bell', versionId: 'd2' }], skipped: [] } })),
		familyPreview: vi.fn(() => of({ success: true, data: PREVIEW() })),
		familyPublish: vi.fn(() => of({ success: true, data: { familyId: FAM.id, mode: 'publish', manifestVersion: 9, keys: [], changedKeys: ['icon.fn.i-bell', 'icon.fn.ws-bell'], unchangedKeys: [] } })),
		familyRestore: vi.fn(() => of({ success: true, data: { changedKeys: ['icon.fn.i-bell'] } })),
		familyDiscard: vi.fn(() => of({ success: true, data: {} })),
		previewBlob: vi.fn(() => of(new Blob([SVG], { type: 'image/svg+xml' }))),
		refreshPublic: vi.fn(async () => true), ...over,
	};
	const confirmSvc = { confirm: vi.fn(async () => true) };
	const store = { load: vi.fn(async () => undefined), rows: () => [{ id: 'i-star', key: 'icon.fn.i-star', label: 'تقييم', library: 'general' }], phase: () => 'ready' };
	const libs = { phase: () => 'ready', load: vi.fn(async () => undefined), pristine: signal([]) };
	const identity = { item: vi.fn(() => ({ sha256: SHA })) };
	const real = { load: vi.fn(async () => undefined), fullSvg: () => SVG, phase: () => 'ready', get: (id: string) => (id === 'i-star' ? { vb: '0 0 24 24', paint: {}, inner: '<path d="M1 1"/>', sha256: 'x', defs: 1, variants: 1, files: [] } : null) };
	TestBed.configureTestingModule({ imports: [IconFamilyEditor], providers: [{ provide: SiteIdentityAdminApi, useValue: api }, { provide: ConfirmModalService, useValue: confirmSvc }, { provide: IconFnStore, useValue: store }, { provide: SiteIdentityService, useValue: identity }, { provide: RealIconsService, useValue: real }, { provide: IconsService, useValue: libs }] });
	const f = TestBed.createComponent(IconFamilyEditor);
	f.componentRef.setInput('familyId', FAM.id); f.componentRef.setInput('canEdit', canEdit); f.detectChanges();
	const root = () => (f.nativeElement as HTMLElement).shadowRoot!;
	const q = (id: string) => root().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	const settle = async () => { for (let i = 0; i < 8; i++) { await f.whenStable(); await new Promise(r => setTimeout(r, 0)); f.detectChanges(); } };
	const pick = async () => { const el = q('fam-file') as HTMLInputElement; Object.defineProperty(el, 'files', { value: [new File([SVG], 'b.svg', { type: 'image/svg+xml' })], configurable: true }); el.dispatchEvent(new Event('change')); await settle(); };
	return { f, c: f.componentInstance, api, confirmSvc, store, q, root, settle, pick };
}

describe('icon family editor (one file, several keys, one atomic operation)', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('lists the members with their status; a not-wired member is not selectable; every member keeps a per-key «تعديل منفرد»', async () => {
		const t = setup(); await t.settle();
		expect(t.q('fam-member-i-bell')).toBeTruthy(); expect(t.q('fam-pick-td-pending-bell')!.hasAttribute('disabled')).toBe(true);
		expect(t.c.selectedKeys()).toEqual(['i-bell', 'ws-bell']);
		let opened = ''; t.c.openMember.subscribe(v => (opened = v)); t.q('fam-edit-ws-bell')!.click(); expect(opened).toBe('ws-bell');
	});

	it('upload stages the SAME file for the selected keys only (nothing published), then shows the exact diff', async () => {
		const t = setup(); await t.settle(); t.q('fam-pick-ws-bell')!.click(); t.f.detectChanges(); await t.pick();
		expect(t.api['familyUpload']).toHaveBeenCalledWith(FAM.id, expect.any(File), ['i-bell'], { kind: 'upload' });
		expect(t.api['familyPublish']).not.toHaveBeenCalled();
		expect(t.q('fam-review')!.textContent).toContain('لم يتغيّر الموقع بعد'); expect(t.q('fam-diff-i-bell')!.getAttribute('data-change')).toBe('replace');
	});

	it('apply needs the explicit confirmation, sends the digest + per-key state versions of the previewed diff, and reports success only after the manifest agrees', async () => {
		const t = setup(); await t.settle(); await t.pick();
		(t.q('fam-apply') as HTMLButtonElement).click(); await t.settle();
		expect(t.confirmSvc.confirm).toHaveBeenCalled(); expect((t.confirmSvc.confirm.mock.calls as unknown as { message: string }[][])[0][0].message).toContain('دفعة واحدة');
		expect(t.api['familyPublish']).toHaveBeenCalledWith(FAM.id, [{ key: 'icon.fn.i-bell', versionId: 'd1' }, { key: 'icon.fn.ws-bell', versionId: 'd2' }], { 'icon.fn.i-bell': 3, 'icon.fn.ws-bell': 5 }, 'f'.repeat(64));
		expect(t.api['refreshPublic']).toHaveBeenCalled(); expect(t.q('fam-notice')!.className).toContain('note-ok'); expect(t.q('fam-notice')!.textContent).toContain('2 أيقونة');
	});

	it('declining the confirmation sends nothing', async () => {
		const t = setup(); await t.settle(); await t.pick(); t.confirmSvc.confirm.mockResolvedValueOnce(false);
		(t.q('fam-apply') as HTMLButtonElement).click(); await t.settle(); expect(t.api['familyPublish']).not.toHaveBeenCalled();
	});

	it('server accepted but the public manifest does not show it yet: a warning, never a plain success', async () => {
		const t = setup(); await t.settle(); await t.pick();
		TestBed.inject(SiteIdentityService); (TestBed.inject(SiteIdentityService) as unknown as { item: ReturnType<typeof vi.fn> }).item.mockReturnValue({ sha256: 'z'.repeat(64) });
		(t.q('fam-apply') as HTMLButtonElement).click(); await t.settle();
		expect(t.q('fam-notice')!.className).toContain('note-warn');
	});

	it('a STALE preview (someone changed a key meanwhile) applies nothing, shows the fresh diff and asks again', async () => {
		const fresh = PREVIEW(1);
		const t = setup({ familyPublish: vi.fn(() => throwError(() => http(409, { code: 'SITE_IDENTITY_PREVIEW_STALE', message: 'تغيّرت', current: fresh }))) }); await t.settle(); await t.pick();
		(t.q('fam-apply') as HTMLButtonElement).click(); await t.settle();
		expect(t.q('fam-notice')!.className).toContain('note-conflict'); expect(t.q('fam-review')!.querySelectorAll('.fam-row').length).toBe(1);
	});

	it('a VERSION conflict reloads the family and never retries by itself', async () => {
		const t = setup({ familyPublish: vi.fn(() => throwError(() => http(409, { code: 'SITE_IDENTITY_VERSION_CONFLICT', message: 'عدّل آخر', current: { manifestVersion: 4, keys: [] } }))) }); await t.settle(); await t.pick();
		(t.q('fam-apply') as HTMLButtonElement).click(); await t.settle();
		expect(t.api['familyPublish']).toHaveBeenCalledTimes(1); expect(t.api['family'].mock.calls.length).toBeGreaterThan(1); expect(t.q('fam-notice')!.className).toContain('note-conflict');
	});

	it('a rejected file shows the server reason and stages nothing', async () => {
		const t = setup({ familyUpload: vi.fn(() => throwError(() => http(400, { code: 'SITE_IDENTITY_FILE_REJECTED', message: 'x', errors: [{ reason: 'ICON_NO_VIEWBOX', message: 'يجب أن يحمل الملف viewBox' }] }))) }); await t.settle(); await t.pick();
		expect(t.q('fam-notice')!.textContent).toContain('viewBox'); expect(t.q('fam-review')).toBeNull(); expect(t.api['familyPublish']).not.toHaveBeenCalled();
	});

	it('restoring the family to the originals goes through the same preview + confirmation (targets "default")', async () => {
		const t = setup({ family: vi.fn(() => of({ success: true, data: { ...FAM, members: [member('i-bell', { status: 'custom', activeVersion: 2 }), member('ws-bell')] } })), familyPreview: vi.fn(() => of({ success: true, data: { ...PREVIEW(1), mode: 'restore' } })) }); await t.settle();
		(t.q('fam-restore') as HTMLButtonElement).click(); await t.settle();
		expect(t.api['familyPreview']).toHaveBeenCalledWith(FAM.id, { mode: 'restore', targets: 'default' }); expect(t.api['familyRestore']).not.toHaveBeenCalled();
		(t.q('fam-apply') as HTMLButtonElement).click(); await t.settle();
		expect(t.api['familyRestore']).toHaveBeenCalledWith(FAM.id, 'default', { 'icon.fn.i-bell': 3 }, 'f'.repeat(64));
	});

	it('read failure is an explicit error with retry; read-only viewers get no upload', async () => {
		const bad = setup({ family: vi.fn(() => throwError(() => http(500, { message: 'x' }))) }); await bad.settle();
		expect(bad.q('fam-error')).toBeTruthy(); expect(bad.q('fam-retry')).toBeTruthy(); TestBed.resetTestingModule();
		const ro = setup({}, false); await ro.settle(); expect(ro.q('fam-readonly')).toBeTruthy(); expect(ro.q('fam-file')).toBeNull();
	});

	it('library pick for the WHOLE family: one copy staged under every selected key with sourceRef = the library icon, then the same exact diff and a confirmation that states the family scope', async () => {
		const t = setup(); await t.settle();
		(t.q('fam-pick-section') as HTMLDetailsElement).open = true; t.q('fam-pick-section')!.dispatchEvent(new Event('toggle')); t.f.detectChanges(); await t.settle();
		const pk = t.root().querySelector('sc-icon-picker')!.shadowRoot!;
		(pk.querySelector('[data-testid="pick-i-star"]') as HTMLButtonElement).click(); await t.settle();
		(t.q('fam-pick-apply') as HTMLButtonElement).click(); await t.settle();
		const c = t.api['familyUpload'].mock.calls[0]; expect(c[2]).toEqual(['i-bell', 'ws-bell']); expect(c[3]).toEqual({ kind: 'library', symbolId: 'i-star' });
		expect(t.api['familyPublish']).not.toHaveBeenCalled(); expect(t.q('fam-review')).toBeTruthy();
		(t.q('fam-apply') as HTMLButtonElement).click(); await t.settle();
		expect((t.confirmSvc.confirm.mock.calls as any)[0][0].message).toContain('للعائلة كلها وليس لأيقونة واحدة'); expect(t.api['familyPublish']).toHaveBeenCalled();
	});
});
