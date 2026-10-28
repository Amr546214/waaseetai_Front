import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TokenEditor } from './token-editor';
import { PlatformTokensStore } from './platform-tokens.store';
import { SiteIdentityAdminApi, IdentityAssetMeta, IdentityItemInfo, IdentityOverview } from '../../../../../core/identity/site-identity-admin.api';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';

const meta = (o: Partial<IdentityAssetMeta> = {}): IdentityAssetMeta => ({ versionId: 'v-' + (o.version ?? 1), key: 'tokens.colors.dark', version: 1, status: 'PUBLISHED', mime: 'application/json', sha256: 'a'.repeat(64), width: null, height: null, byteSize: 40, note: null, createdBy: { id: 'u1', name: 'سارة' }, createdAt: '2026-10-27T10:00:00Z', url: '/public/x', previewUrl: '/p', value: {}, ...o });
const TOKENS = [
	{ name: '--teal', type: 'color' as const, label: 'اللون الأساسي', default: '#2bd4c7' },
	{ name: '--pg', type: 'color' as const, label: 'خلفية الصفحة', default: '#070b15' },
	{ name: '--grad', type: 'paint' as const, label: 'التدرّج', default: 'linear-gradient(135deg,#2bd4c7,#2b7fff)' },
];
const item = (o: Partial<IdentityItemInfo> = {}): IdentityItemInfo => ({
	key: 'tokens.colors.dark', group: 'token', label: 'ألوان الوضع الداكن', description: 'd', kind: 'json', allowedMimes: ['application/json'], maxBytes: 8192, dimensions: {}, rules: [],
	defaultAsset: { type: 'tokens' }, defaultFingerprint: { mime: 'application/json', width: null, height: null, byteSize: 2, sha256: 'b'.repeat(64) }, usages: [], notes: [], wired: true, editable: true, notWiredReason: null, tokens: TOKENS,
	state: { stateVersion: 0, isDefault: true, active: null, updatedAt: null, updatedBy: null }, staged: [], history: [], ...o,
});
const overview = (items: IdentityItemInfo[], canManage = true): IdentityOverview => ({ manifestVersion: 0, canManage, groups: ['token'], items, notIdentity: [], unregisteredAssets: [] });
const http = (status: number, body: unknown = {}) => new HttpErrorResponse({ status, error: body });

function setup(ov: IdentityOverview | HttpErrorResponse, extra: Record<string, unknown> = {}, can: (id: string) => boolean = () => true, keys = ['tokens.colors.dark']) {
	const api: Record<string, ReturnType<typeof vi.fn>> = {
		overview: vi.fn(() => (ov instanceof HttpErrorResponse ? throwError(() => ov) : of({ success: true, data: ov }))),
		uploadTokens: vi.fn(), publish: vi.fn(), restore: vi.fn(), discard: vi.fn(), refreshPublic: vi.fn(async () => true), liveManifest: vi.fn(() => ({ items: {} })), ...extra,
	};
	const confirmSvc = { confirm: vi.fn(async () => true) };
	TestBed.configureTestingModule({ imports: [TokenEditor], providers: [{ provide: SiteIdentityAdminApi, useValue: api }, { provide: ConfirmModalService, useValue: confirmSvc }, { provide: AdminAccessService, useValue: { allows: () => true, can, access: signal(null) } }] });
	const f = TestBed.createComponent(TokenEditor);
	f.componentRef.setInput('keys', keys);
	f.detectChanges();
	const root = () => (f.nativeElement as HTMLElement).shadowRoot!;
	const q = (id: string) => root().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	const settle = async () => { for (let i = 0; i < 6; i++) { await f.whenStable(); await new Promise(r => setTimeout(r, 0)); f.detectChanges(); } };
	const type = async (name: string, value: string) => { const el = q('pt-input-' + name) as HTMLInputElement; el.value = value; el.dispatchEvent(new Event('change')); await settle(); };
	return { f, c: f.componentInstance, api, confirmSvc, root, q, settle, type, store: TestBed.inject(PlatformTokensStore) };
}

describe('platform design-token editor (central flow)', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('shows the platform defaults from the SERVER, says it is linked to the site and explains the literal colours are not bound', async () => {
		const t = setup(overview([item()])); await t.settle();
		expect(t.q('pt-linked')!.textContent).toContain('مرتبط بالموقع');
		expect(t.q('pt-scope')!.textContent).toContain('17,200'); expect(t.q('pt-scope')!.textContent).toContain('15,000'); expect(t.q('pt-scope')!.textContent).toContain('2,300');
		expect(t.q('pt-pub---teal')!.textContent).toBe('#2bd4c7'); expect(t.q('pt-state')!.textContent).toContain('الأصل الافتراضي');
		expect(t.q('pt-row---pg')).toBeTruthy();
	});

	it('check -> review -> apply: only the entered values are sent, the server draft is reviewed name by name, apply publishes the draft bound to the state seen, refreshes this tab and clears the form', async () => {
		const draft = meta({ version: 1, status: 'STAGED', value: { '--teal': '#14b8a6' } });
		const t = setup(overview([item()]), {
			uploadTokens: vi.fn(() => of({ success: true, data: draft })),
			publish: vi.fn(() => of({ success: true, data: { key: 'tokens.colors.dark', stateVersion: 1, manifestVersion: 3, isDefault: false, active: draft, updatedAt: null, updatedBy: null, previous: null, fromVersion: 0, toVersion: 1 } })),
			liveManifest: vi.fn(() => ({ items: { 'tokens.colors.dark': { sha256: draft.sha256 } } })),
		});
		await t.settle();
		await t.type('--teal', '#14B8A6 '.trim());
		expect((t.q('pt-stage-tokens.colors.dark') as HTMLButtonElement).disabled).toBe(false);
		t.q('pt-stage-tokens.colors.dark')!.click(); await t.settle();
		expect(t.api['uploadTokens']).toHaveBeenCalledWith('tokens.colors.dark', { '--teal': '#14B8A6' });
		expect(t.q('pt-review-tokens.colors.dark')).toBeTruthy();
		expect(t.q('pt-diff-tokens.colors.dark')!.textContent).toContain('#2bd4c7'); expect(t.q('pt-diff-tokens.colors.dark')!.textContent).toContain('#14b8a6');
		expect(t.api['publish']).not.toHaveBeenCalled(); // nothing is live while only a draft
		t.api['overview'].mockReturnValue(of({ success: true, data: overview([item({ state: { stateVersion: 1, isDefault: false, active: draft, updatedAt: null, updatedBy: null } })]) }));
		t.q('pt-apply-tokens.colors.dark')!.click(); await t.settle();
		expect(t.confirmSvc.confirm).toHaveBeenCalled();
		expect(t.api['publish']).toHaveBeenCalledWith('tokens.colors.dark', draft.versionId, 0);
		expect(t.api['refreshPublic']).toHaveBeenCalled();
		expect(t.q('pt-review-tokens.colors.dark')).toBeNull();
		expect(t.q('pt-notice-tokens.colors.dark')!.textContent).toContain('طُبّقت');
	});

	it('success is declared ONLY when the public manifest shows the new version: otherwise a warning with a re-check, and the re-check turns it into success once the manifest catches up', async () => {
		const draft = meta({ version: 1, status: 'STAGED', value: { '--teal': '#14b8a6' } });
		let live = false;
		const t = setup(overview([item()]), {
			uploadTokens: vi.fn(() => of({ success: true, data: draft })),
			publish: vi.fn(() => of({ success: true, data: { key: 'tokens.colors.dark', stateVersion: 1, manifestVersion: 3, isDefault: false, active: draft, updatedAt: null, updatedBy: null, previous: null, fromVersion: 0, toVersion: 1 } })),
			liveManifest: vi.fn(() => ({ items: live ? { 'tokens.colors.dark': { sha256: draft.sha256 } } : {} })),
		});
		await t.settle(); await t.type('--teal', '#14b8a6');
		t.q('pt-stage-tokens.colors.dark')!.click(); await t.settle();
		t.q('pt-apply-tokens.colors.dark')!.click(); await new Promise(r => setTimeout(r, 900)); await t.settle();
		const n = t.q('pt-notice-tokens.colors.dark')!;
		expect(n.className).toContain('note-warn'); expect(n.textContent).toContain('لم يظهر بعد في بيان الموقع العام'); expect(n.textContent).not.toContain('طُبّقت');
		live = true;
		t.q('pt-recheck-tokens.colors.dark')!.click(); await t.settle();
		expect(t.q('pt-notice-tokens.colors.dark')!.className).toContain('note-ok'); expect(t.q('pt-notice-tokens.colors.dark')!.textContent).toContain('تأكّد الآن');
		expect(t.api['publish']).toHaveBeenCalledTimes(1); // the re-check never saves again
	});

	it('the apply / restore confirmations list the exact change (name, old value, new value) that was previewed', async () => {
		const active = meta({ version: 2, value: { '--teal': '#14b8a6' } }), prev = meta({ version: 1, status: 'SUPERSEDED', value: { '--pg': '#0b1020' } });
		const t = setup(overview([item({ state: { stateVersion: 2, isDefault: false, active, updatedAt: null, updatedBy: null }, history: [active, prev] })]), { restore: vi.fn(() => of({ success: true, data: { key: 'tokens.colors.dark', stateVersion: 3, manifestVersion: 4, isDefault: true, active: null, updatedAt: null, updatedBy: null, previous: active } })) });
		await t.settle();
		t.q('pt-restore-1')!.click(); await t.settle();
		const msg = (t.confirmSvc.confirm.mock.calls[0] as unknown as [{ message: string }])[0].message;
		expect(msg).toContain('--teal'); expect(msg).toContain('#14b8a6 ← #2bd4c7'); expect(msg).toContain('--pg'); expect(msg).toContain('#070b15 ← #0b1020');
	});

	it('a value equal to the platform default is not an override (no check offered); an empty field = back to the platform value', async () => {
		const t = setup(overview([item()])); await t.settle();
		await t.type('--teal', '#2bd4c7');
		expect((t.q('pt-stage-tokens.colors.dark') as HTMLButtonElement).disabled).toBe(true);
		expect(t.api['uploadTokens']).not.toHaveBeenCalled();
	});

	it('a server rejection (strict grammar) is shown in Arabic with the offending value kept for correction; nothing is applied', async () => {
		const t = setup(overview([item()]), { uploadTokens: vi.fn(() => throwError(() => http(400, { code: 'SITE_IDENTITY_FILE_REJECTED', message: 'مرفوض', errors: [{ field: 'value', message: 'القيمة --teal غير صالحة: صيغة غير مسموحة', reason: 'FORBIDDEN_SYNTAX', name: '--teal' }] }))) });
		await t.settle(); await t.type('--teal', 'url(http://evil)');
		t.q('pt-stage-tokens.colors.dark')!.click(); await t.settle();
		expect(t.q('pt-notice-tokens.colors.dark')!.textContent).toContain('غير صالحة');
		expect(t.q('pt-review-tokens.colors.dark')).toBeNull(); expect(t.api['publish']).not.toHaveBeenCalled();
		expect((t.q('pt-input---teal') as HTMLInputElement).value).toBe('url(http://evil)');
	});

	it('conflict: someone else changed it first -> the conflict message with the winner, a reload action, and nothing is overwritten', async () => {
		const draft = meta({ status: 'STAGED', value: { '--teal': '#14b8a6' } });
		const t = setup(overview([item()]), { uploadTokens: vi.fn(() => of({ success: true, data: draft })), publish: vi.fn(() => throwError(() => http(409, { code: 'SITE_IDENTITY_VERSION_CONFLICT', message: 'عدّل شخصٌ آخر', current: { key: 'tokens.colors.dark', stateVersion: 4, manifestVersion: 9, isDefault: false, active: meta({ version: 4 }), updatedAt: null, updatedBy: null } })) ) });
		await t.settle(); await t.type('--teal', '#14b8a6');
		t.q('pt-stage-tokens.colors.dark')!.click(); await t.settle(); t.q('pt-apply-tokens.colors.dark')!.click(); await t.settle();
		const n = t.q('pt-notice-tokens.colors.dark')!;
		expect(n.className).toContain('note-conflict'); expect(n.textContent).toContain('عدّل شخصٌ آخر'); expect(n.textContent).toContain('النسخة 4');
		expect(t.q('pt-reload')).toBeTruthy();
		expect(t.api['overview'].mock.calls.length).toBeGreaterThan(1); // the current state was re-read
	});

	it('cancel discards the server draft and the pending edits; the site is untouched', async () => {
		const draft = meta({ status: 'STAGED', value: { '--teal': '#14b8a6' } });
		const t = setup(overview([item()]), { uploadTokens: vi.fn(() => of({ success: true, data: draft })), discard: vi.fn(() => of({ success: true, data: {} })) });
		await t.settle(); await t.type('--teal', '#14b8a6');
		t.q('pt-stage-tokens.colors.dark')!.click(); await t.settle(); t.q('pt-cancel2-tokens.colors.dark')!.click(); await t.settle();
		expect(t.api['discard']).toHaveBeenCalledWith('tokens.colors.dark', draft.versionId);
		expect(t.q('pt-review-tokens.colors.dark')).toBeNull(); expect(t.api['publish']).not.toHaveBeenCalled();
		expect((t.q('pt-input---teal') as HTMLInputElement).value).toBe('');
	});

	it('restore: back to the platform default and a previous version, both through the restore API bound to the state version', async () => {
		const active = meta({ version: 2, value: { '--teal': '#14b8a6' } }), prev = meta({ version: 1, status: 'SUPERSEDED', value: { '--pg': '#0b1020' } });
		const t = setup(overview([item({ state: { stateVersion: 2, isDefault: false, active, updatedAt: null, updatedBy: null }, history: [active, prev] })]), { restore: vi.fn(() => of({ success: true, data: { key: 'tokens.colors.dark', stateVersion: 3, manifestVersion: 4, isDefault: true, active: null, updatedAt: null, updatedBy: null, previous: active } })) });
		await t.settle();
		expect(t.q('pt-pub---teal')!.textContent).toBe('#14b8a6');
		t.q('pt-restore-1')!.click(); await t.settle();
		expect(t.api['restore']).toHaveBeenCalledWith('tokens.colors.dark', prev.versionId, 2);
		t.q('pt-default-tokens.colors.dark')!.click(); await t.settle();
		expect(t.api['restore']).toHaveBeenCalledWith('tokens.colors.dark', 'default', 2);
		expect(t.api['refreshPublic']).toHaveBeenCalled();
	});

	it('read-only (site.view / no edit capability): values visible, NO inputs and NO actions', async () => {
		const t = setup(overview([item()], false), {}, id => id === 'site.view'); await t.settle();
		expect(t.q('pt-readonly')).toBeTruthy(); expect(t.root().querySelectorAll('input').length).toBe(0); expect(t.q('pt-stage-tokens.colors.dark')).toBeNull();
		expect(t.q('pt-row---teal')).toBeTruthy();
	});
	it('legacy site_control.manage (server canManage true) edits', async () => {
		const t = setup(overview([item()], true), {}, id => id === 'site_control.manage'); await t.settle();
		expect(t.q('pt-readonly')).toBeNull(); expect(t.q('pt-input---teal')).toBeTruthy();
	});

	it('a key that is not wired (typography today): shown with the server reason and NO edit control', async () => {
		const t = setup(overview([item({ key: 'tokens.typography', label: 'الخط العام', wired: false, notWiredReason: 'يحتاج إثبات التطابق', tokens: [{ name: '--font-family', type: 'font-family', label: 'الخط', default: "'Tajawal',system-ui,sans-serif" }] })]), {}, () => true, ['tokens.typography']); await t.settle();
		expect(t.q('pt-notwired-reason')!.textContent).toContain('يحتاج إثبات التطابق'); expect(t.q('pt-input---font-family')).toBeNull(); expect(t.q('pt-stage-tokens.typography')).toBeNull();
	});

	it('load failures: 403 -> no permission state, 500 -> error with retry; never an editor', async () => {
		const d = setup(http(403, { code: 'ADMIN_PERMISSION_DENIED', message: 'ليست لديك صلاحية' })); await d.settle();
		expect(d.q('pt-denied')).toBeTruthy(); expect(d.q('pt-input---teal')).toBeNull();
		TestBed.resetTestingModule();
		const e = setup(http(500, {})); await e.settle();
		expect(e.q('pt-error')).toBeTruthy(); expect(e.q('pt-retry')).toBeTruthy();
	});

	it('the store exposes every platform name so the local sandboxes can lock them (one editor per element)', async () => {
		const t = setup(overview([item(), item({ key: 'tokens.colors.light', label: 'فاتح', tokens: [{ name: '--surface', type: 'paint', label: 's', default: '#ffffff' }] })])); await t.settle();
		expect(t.store.names().has('--teal')).toBe(true); expect(t.store.names().has('--surface')).toBe(true); expect(t.store.names().has('--nonsense')).toBe(false);
	});
});
