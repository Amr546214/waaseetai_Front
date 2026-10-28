import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { Identity } from './identity';
import { SiteIdentityAdminApi, IdentityAssetMeta, IdentityItemInfo, IdentityOverview } from '../../../../../core/identity/site-identity-admin.api';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { previousVersion, describeFailure, bytesText } from './identity-view';

const meta = (o: Partial<IdentityAssetMeta> = {}): IdentityAssetMeta => ({ versionId: 'v-' + (o.version ?? 1), key: 'icon.ai', version: 1, status: 'PUBLISHED', mime: 'image/svg+xml', sha256: 'a'.repeat(64), width: 24, height: 24, byteSize: 300, note: null, createdBy: { id: 'u1u1u1u1-x', name: 'سارة الأحمد' }, createdAt: '2026-10-27T10:00:00Z', url: '/public/x', previewUrl: '/p', ...o });
const item = (o: Partial<IdentityItemInfo> = {}): IdentityItemInfo => ({
	key: 'icon.ai', group: 'icon', label: 'أيقونة الذكاء الاصطناعي', description: 'd', kind: 'svg', allowedMimes: ['image/svg+xml'], maxBytes: 65536, dimensions: {}, rules: ['SVG فقط'],
	defaultAsset: { type: 'inline-symbol', symbolId: 'i-ai', source: 's' }, defaultFingerprint: { mime: 'image/svg+xml', width: 24, height: 24, byteSize: 338, sha256: 'b'.repeat(64) },
	usages: [{ where: 'مكان', ref: 'r' }], notes: [], wired: true, editable: true, notWiredReason: null,
	state: { stateVersion: 0, isDefault: true, active: null, updatedAt: null, updatedBy: null }, staged: [], history: [], ...o
});
const overview = (items: IdentityItemInfo[], canManage = true, manifestVersion = 0): IdentityOverview => ({ manifestVersion, canManage, groups: ['logo', 'favicon', 'icon', 'character'], items, notIdentity: ['أيقونات الوظائف ليست هوية'], unregisteredAssets: [] });
const http = (status: number, body: unknown = {}) => new HttpErrorResponse({ status, error: body });

function setup(ov: IdentityOverview | HttpErrorResponse, extra: Record<string, unknown> = {}, confirm = true, can: (id: string) => boolean = () => true) {
	const live: { items: Record<string, { sha256: string }>; version: number } = { items: {}, version: 0 };
	const api: Record<string, ReturnType<typeof vi.fn>> = {
		overview: vi.fn(() => (ov instanceof HttpErrorResponse ? throwError(() => ov) : of({ success: true, data: ov }))),
		history: vi.fn(() => of({ success: true, data: { manifest: [], hasMore: false, nextBefore: null, versions: [] } })),
		previewBlob: vi.fn(() => of(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>'], { type: 'image/svg+xml' }))),
		upload: vi.fn(), publish: vi.fn(), restore: vi.fn(), restoreSet: vi.fn(), restoreSetPreview: vi.fn(), discard: vi.fn(),
		refreshPublic: vi.fn(async () => true), liveManifest: vi.fn(() => live),
		...extra
	};
	const confirmSvc = { confirm: vi.fn(async () => confirm) };
	TestBed.configureTestingModule({ imports: [Identity], providers: [provideRouter([]), { provide: SiteIdentityAdminApi, useValue: api }, { provide: ConfirmModalService, useValue: confirmSvc }, { provide: AdminAccessService, useValue: { allows: () => true, can, access: signal(null) } }] });
	(URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:test';
	const f = TestBed.createComponent(Identity);
	f.detectChanges();
	const root = () => (f.nativeElement as HTMLElement).shadowRoot!;
	const q = (id: string) => root().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	const settle = async () => { for (let i = 0; i < 6; i++) { await f.whenStable(); await new Promise(r => setTimeout(r, 0)); f.detectChanges(); } };
	return { f, c: f.componentInstance, api, live, confirmSvc, root, q, settle };
}
const file = () => new File(['<svg/>'], 'new.svg', { type: 'image/svg+xml' });
const pick = async (t: ReturnType<typeof setup>, key = 'icon.ai') => {
	const input = t.q(`file-${key}`) as HTMLInputElement;
	Object.defineProperty(input, 'files', { value: [file()], configurable: true });
	input.dispatchEvent(new Event('change')); t.f.detectChanges();
};

describe('«الهوية» page', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('loading: shows the loading state before the server answers', () => {
		const never = new Subject<never>();
		const t = setup(overview([]), { overview: vi.fn(() => never) });
		expect(t.q('identity-loading')).toBeTruthy();
	});
	it('load failure: clear Arabic error with a retry that reloads', async () => {
		const t = setup(http(500, { message: 'x' })); await t.settle();
		expect(t.q('identity-error')?.textContent).toContain('تعذّر تحميل الصفحة');
		t.api['overview'].mockReturnValue(of({ success: true, data: overview([item()]) }));
		t.q('identity-retry')!.click(); await t.settle();
		expect(t.q('identity-key-icon.ai')).toBeTruthy();
	});
	it('403: a "no permission" state, never the editor', async () => {
		const t = setup(http(403, { code: 'ADMIN_PERMISSION_DENIED', message: 'لا' })); await t.settle();
		expect(t.q('identity-denied')?.textContent).toContain('site.view');
		expect(t.q('identity-key-icon.ai')).toBeNull();
	});
	it('503 migration missing: says the service is not ready', async () => {
		const t = setup(http(503, { code: 'SITE_IDENTITY_UNAVAILABLE', message: 'خدمة الهوية غير جاهزة' })); await t.settle();
		expect(t.q('identity-unavailable')?.textContent).toContain('غير جاهزة');
	});
	it('read-only (site.view): a note and NO upload / apply / restore controls', async () => {
		const t = setup(overview([item({ state: { stateVersion: 1, isDefault: false, active: meta({ version: 1 }), updatedAt: '2026-10-27T10:00:00Z', updatedBy: { id: 'u', name: 'سارة الأحمد' } }, history: [meta({ version: 1 }), meta({ version: 2, status: 'SUPERSEDED' })] })], false)); await t.settle();
		expect(t.q('identity-readonly')).toBeTruthy();
		expect(t.root().querySelectorAll('input[type=file]').length).toBe(0);
		expect(t.root().querySelectorAll('[data-testid^="apply-"],[data-testid^="restore-"],[data-testid^="upload-"],[data-testid^="set-restore-"]').length).toBe(0);
		expect(t.q('identity-key-icon.ai')).toBeTruthy(); // still readable
	});
	it('not-wired key: «غير مرتبط بالموقع بعد» + the reason, NO upload control at all; the platform name is read-only with a link', async () => {
		const t = setup(overview([item({ key: 'logo.boot', group: 'logo', kind: 'raster', defaultAsset: { type: 'file', path: '/assets/brand/waseet-mark.png' }, wired: false, editable: false, notWiredReason: 'يُرسم قبل JavaScript' })])); await t.settle();
		const c = t.q('identity-key-logo.boot')!;
		expect(c.querySelector('input[type=file]')).toBeNull();
		expect(c.querySelector('[data-testid="status-logo.boot"]')?.textContent).toContain('غير مرتبط بالموقع بعد');
		expect(c.querySelector('[data-testid="not-wired-logo.boot"]')?.textContent).toContain('يُرسم قبل JavaScript');
		expect(t.q('identity-platform-name')?.querySelector('a')?.getAttribute('href')).toContain('system-settings');
		expect(t.q('identity-not-identity')?.textContent).toContain('ليست هوية');
	});
	it('shows light AND dark previews, small sizes, source, type, dimensions, size, usages, last-modified', async () => {
		const t = setup(overview([item()])); await t.settle();
		const c = t.q('identity-key-icon.ai')!;
		expect(c.querySelectorAll('[data-testid="cur-icon.ai-big"] [data-tone]').length).toBe(2);
		expect(c.querySelectorAll('[data-testid="cur-icon.ai-sizes"] .pv-size').length).toBe(8); // 4 sizes x light + dark
		const facts = c.querySelector('[data-testid="facts-icon.ai"]')!.textContent!;
		expect(facts).toContain('الأصل الافتراضي'); expect(facts).toContain('SVG'); expect(facts).toContain('24×24'); expect(c.querySelector('[data-testid="usages-icon.ai"]')).toBeTruthy();
	});

	it('upload → server preview → apply: success only after 200 AND the manifest shows the version; then refreshPublic', async () => {
		const staged = meta({ version: 1, status: 'STAGED', versionId: 'st1', sha256: 'c'.repeat(64) });
		const applied = { key: 'icon.ai', stateVersion: 1, manifestVersion: 1, isDefault: false, active: { ...staged, status: 'PUBLISHED' }, updatedAt: 'x', updatedBy: { id: 'u', name: 'سارة الأحمد' }, previous: null };
		const t = setup(overview([item()]), {});
		t.api['upload'].mockReturnValue(of({ success: true, data: { ...staged, current: {} } }));
		t.api['publish'].mockImplementation(() => { t.live.items['icon.ai'] = { sha256: 'c'.repeat(64) }; return of({ success: true, data: applied }); });
		await t.settle(); await pick(t);
		t.q('upload-icon.ai')!.click(); await t.settle();
		expect(t.api['upload']).toHaveBeenCalledWith('icon.ai', expect.any(File));
		expect(t.api['previewBlob']).toHaveBeenCalledWith('icon.ai', 'st1'); // the SERVER's version is what is previewed
		expect(t.q('compare-icon.ai')).toBeTruthy();
		expect(t.api['publish']).not.toHaveBeenCalled(); // nothing live yet
		expect(t.api['refreshPublic']).not.toHaveBeenCalled();
		t.q('apply-icon.ai')!.click(); await t.settle();
		expect(t.api['publish']).toHaveBeenCalledWith('icon.ai', 'st1', 0);
		expect(t.api['refreshPublic']).toHaveBeenCalled();
		const n = t.q('notice-icon.ai')!; expect(n.getAttribute('data-type')).toBe('ok'); expect(n.textContent).toContain('طُبِّقت');
		expect(t.q('compare-icon.ai')).toBeNull();
	});
	it('apply saved but the manifest does not show it: a WARNING with re-check, never a success', async () => {
		const staged = meta({ status: 'STAGED', versionId: 'st1', sha256: 'c'.repeat(64) });
		const t = setup(overview([item()]));
		t.api['upload'].mockReturnValue(of({ success: true, data: { ...staged, current: {} } }));
		t.api['publish'].mockReturnValue(of({ success: true, data: { key: 'icon.ai', stateVersion: 1, manifestVersion: 1, isDefault: false, active: { ...staged, status: 'PUBLISHED' }, updatedAt: null, updatedBy: null, previous: null } }));
		await t.settle(); await pick(t); t.q('upload-icon.ai')!.click(); await t.settle();
		t.q('apply-icon.ai')!.click(); await t.settle(); await new Promise(r => setTimeout(r, 500)); await t.settle();
		expect(t.q('notice-icon.ai')!.getAttribute('data-type')).toBe('warn');
		expect(t.q('retry-icon.ai')!.textContent).toContain('إعادة التحقق');
	});
	it('cancel discards the staged upload on the server and leaves the site alone', async () => {
		const staged = meta({ status: 'STAGED', versionId: 'st1' });
		const t = setup(overview([item()]));
		t.api['upload'].mockReturnValue(of({ success: true, data: { ...staged, current: {} } }));
		t.api['discard'].mockReturnValue(of({ success: true, data: { ...staged, status: 'DISCARDED', current: {} } }));
		await t.settle(); await pick(t); t.q('upload-icon.ai')!.click(); await t.settle();
		t.q('cancel-icon.ai')!.click(); await t.settle();
		expect(t.api['discard']).toHaveBeenCalledWith('icon.ai', 'st1');
		expect(t.q('compare-icon.ai')).toBeNull(); expect(t.api['publish']).not.toHaveBeenCalled(); expect(t.api['refreshPublic']).not.toHaveBeenCalled();
	});
	it('double click on «تطبيق» sends exactly one publish', async () => {
		const staged = meta({ status: 'STAGED', versionId: 'st1' }); const gate = new Subject<unknown>();
		const t = setup(overview([item()]));
		t.api['upload'].mockReturnValue(of({ success: true, data: { ...staged, current: {} } }));
		t.api['publish'].mockReturnValue(gate);
		await t.settle(); await pick(t); t.q('upload-icon.ai')!.click(); await t.settle();
		// Round 2: «تطبيق» first opens the confirmation dialog (one dialog for two fast clicks); the publish follows the confirmation
		const b = t.q('apply-icon.ai') as HTMLButtonElement; b.click(); b.click(); await t.settle();
		expect(t.confirmSvc.confirm).toHaveBeenCalledTimes(1);
		expect(t.api['publish']).toHaveBeenCalledTimes(1);
		expect((t.q('apply-icon.ai') as HTMLButtonElement).disabled).toBe(true); // controls are disabled while it runs
		expect((t.q('cancel-icon.ai') as HTMLButtonElement).disabled).toBe(true);
	});
	it('409 conflict: shows the winner, keeps the staged file, never overwrites; reload reads the new state', async () => {
		const staged = meta({ status: 'STAGED', versionId: 'st1' });
		const cur = { key: 'icon.ai', stateVersion: 5, manifestVersion: 9, isDefault: false, active: meta({ version: 4 }), updatedAt: '2026-10-27T10:00:00Z', updatedBy: { id: 'abcd1234-z', name: 'خالد' } };
		const t = setup(overview([item()]));
		t.api['upload'].mockReturnValue(of({ success: true, data: { ...staged, current: {} } }));
		t.api['publish'].mockReturnValue(throwError(() => http(409, { code: 'SITE_IDENTITY_VERSION_CONFLICT', message: 'عدّل شخصٌ آخر', current: cur })));
		await t.settle(); await pick(t); t.q('upload-icon.ai')!.click(); await t.settle();
		t.q('apply-icon.ai')!.click(); await t.settle();
		expect(t.q('notice-icon.ai')!.getAttribute('data-type')).toBe('conflict');
		expect(t.q('conflict-icon.ai')!.textContent).toContain('النسخة 4'); expect(t.q('conflict-icon.ai')!.textContent).toContain('abcd1234');
		expect(t.api['refreshPublic']).not.toHaveBeenCalled();
		expect(t.q('compare-icon.ai')).toBeTruthy();
		const calls = t.api['overview'].mock.calls.length; t.q('conflict-reload-icon.ai')!.click(); await t.settle();
		expect(t.api['overview'].mock.calls.length).toBeGreaterThan(calls);
		expect(t.api['publish']).toHaveBeenCalledTimes(1); // no silent second attempt
	});
	it('rejected file (FILE_REJECTED): Arabic reason, selection cleared, nothing staged, site untouched', async () => {
		const t = setup(overview([item()]));
		t.api['upload'].mockReturnValue(throwError(() => http(400, { code: 'SITE_IDENTITY_FILE_REJECTED', message: 'مرفوض', errors: [{ field: 'file', message: 'الملف ليس SVG صالحًا', reason: 'NO_SVG_ROOT' }] })));
		await t.settle(); await pick(t); t.q('upload-icon.ai')!.click(); await t.settle();
		const n = t.q('notice-icon.ai')!; expect(n.getAttribute('data-type')).toBe('error'); expect(n.textContent).toContain('الملف ليس SVG صالحًا');
		expect(t.q('compare-icon.ai')).toBeNull(); expect(t.q('filename-icon.ai')).toBeNull(); expect(t.q('retry-icon.ai')).toBeNull();
	});
	it('network failure on upload: message, the chosen file is KEPT and retry uploads it without choosing again', async () => {
		const staged = meta({ status: 'STAGED', versionId: 'st1' });
		const t = setup(overview([item()]));
		t.api['upload'].mockReturnValueOnce(throwError(() => http(0))).mockReturnValue(of({ success: true, data: { ...staged, current: {} } }));
		await t.settle(); await pick(t); t.q('upload-icon.ai')!.click(); await t.settle();
		expect(t.q('notice-icon.ai')!.textContent).toContain('تعذّر الاتصال'); expect(t.q('filename-icon.ai')).toBeTruthy();
		t.q('retry-icon.ai')!.click(); await t.settle();
		expect(t.api['upload']).toHaveBeenCalledTimes(2); expect(t.q('compare-icon.ai')).toBeTruthy();
	});
	it('save failure (500) on apply: message + retry, current identity untouched, staged file kept', async () => {
		const staged = meta({ status: 'STAGED', versionId: 'st1' });
		const t = setup(overview([item()]));
		t.api['upload'].mockReturnValue(of({ success: true, data: { ...staged, current: {} } }));
		t.api['publish'].mockReturnValue(throwError(() => http(500, { message: 'خطأ داخلي' })));
		await t.settle(); await pick(t); t.q('upload-icon.ai')!.click(); await t.settle();
		t.q('apply-icon.ai')!.click(); await t.settle();
		expect(t.q('notice-icon.ai')!.getAttribute('data-type')).toBe('error'); expect(t.q('retry-icon.ai')).toBeTruthy(); expect(t.q('compare-icon.ai')).toBeTruthy();
		expect(t.api['refreshPublic']).not.toHaveBeenCalled();
	});

	const withHistory = () => item({ state: { stateVersion: 3, isDefault: false, active: meta({ version: 3, versionId: 'v-3' }), updatedAt: '2026-10-27T10:00:00Z', updatedBy: { id: 'u', name: 'سارة الأحمد' } }, history: [meta({ version: 3, versionId: 'v-3' }), meta({ version: 2, versionId: 'v-2', status: 'SUPERSEDED' }), meta({ version: 1, versionId: 'v-1', status: 'SUPERSEDED' })] });
	it('restore previous: dialog names the key and both versions; confirmed → restore(expectedVersion) → verified', async () => {
		const t = setup(overview([withHistory()]));
		t.api['restore'].mockImplementation(() => { t.live.items['icon.ai'] = { sha256: 'a'.repeat(64) }; return of({ success: true, data: { key: 'icon.ai', stateVersion: 4, manifestVersion: 4, isDefault: false, active: meta({ version: 2, versionId: 'v-2' }), updatedAt: null, updatedBy: null, previous: null } }); });
		await t.settle();
		t.q('restore-prev-icon.ai')!.click(); await t.settle();
		const cfg = (t.confirmSvc.confirm.mock.calls[0] as unknown as [{ message: string; title: string }])[0];
		expect(cfg.message).toContain('icon.ai'); expect(cfg.message).toContain('النسخة 3'); expect(cfg.message).toContain('النسخة 2');
		expect(t.api['restore']).toHaveBeenCalledWith('icon.ai', 'v-2', 3);
		expect(t.q('notice-icon.ai')!.getAttribute('data-type')).toBe('ok');
	});
	it('restore declined in the dialog: nothing is sent', async () => {
		const t = setup(overview([withHistory()]), {}, false); await t.settle();
		t.q('restore-default-icon.ai')!.click(); await t.settle();
		expect(t.confirmSvc.confirm).toHaveBeenCalled(); expect(t.api['restore']).not.toHaveBeenCalled();
	});
	it('restore default: target "default" and the dialog says the original is restored', async () => {
		const t = setup(overview([withHistory()]));
		t.api['restore'].mockImplementation(() => of({ success: true, data: { key: 'icon.ai', stateVersion: 4, manifestVersion: 4, isDefault: true, active: null, updatedAt: null, updatedBy: null, previous: null } }));
		await t.settle(); t.q('restore-default-icon.ai')!.click(); await t.settle();
		expect(t.api['restore']).toHaveBeenCalledWith('icon.ai', 'default', 3);
		expect((t.confirmSvc.confirm.mock.calls[0] as unknown as [{ message: string }])[0].message).toContain('الأصل الافتراضي');
	});
	it('version history lists version, date, who, sha prefix and restore-to-this-version (not for the active one)', async () => {
		const t = setup(overview([withHistory()])); await t.settle();
		const h = t.q('history-icon.ai')!;
		expect(h.querySelectorAll('.ver').length).toBe(3);
		expect(h.textContent).toContain('aaaaaaaaaa'); expect(h.textContent).toContain('u1u1u1u1');
		expect(t.q('restore-ver-v-3')).toBeNull(); expect(t.q('restore-ver-v-1')).toBeTruthy();
	});
	// ---------------------------------------------------------------- Round 2: exact diff, bound confirmation
	const side = (o: Record<string, unknown> = {}) => ({ source: 'default', versionId: null, version: 0, sha256: 'b'.repeat(64), mime: 'image/svg+xml', width: 24, height: 24, previewUrl: null, ...o });
	const row = (key: string, change: string, cur: Record<string, unknown> = {}, tgt: Record<string, unknown> = {}) => ({ key, label: key === 'icon.ai' ? 'أيقونة الذكاء الاصطناعي' : key, group: key.startsWith('icon') ? 'icon' : 'logo', change, current: side(cur), target: side(tgt) });
	const digest = 'd'.repeat(64);
	const preview = (items: unknown[], cur = 3, tgt = 1, d = digest) => ({ currentManifestVersion: cur, targetManifestVersion: tgt, previewDigest: d, changedCount: items.filter((r: any) => r.change !== 'unchanged').length, canApply: items.some((r: any) => r.change !== 'unchanged'), items });
	const hist = () => ({ history: vi.fn(() => of({ success: true, data: { manifest: [{ manifestVersion: 3, reason: 'publish', createdAt: '2026-10-27T10:00:00Z', createdBy: { id: 'u', name: 'سارة' }, changedKeys: ['icon.ai'] }, { manifestVersion: 1, reason: 'publish', createdAt: '2026-10-27T09:00:00Z', createdBy: { id: 'u', name: 'سارة' }, changedKeys: ['icon.ai'] }], hasMore: false, nextBefore: null, versions: [] } })) });
	const three = [row('icon.ai', 'replace', { source: 'custom', versionId: 'v-3', version: 3, sha256: 'c'.repeat(64) }, { source: 'custom', versionId: 'v-1', version: 1, sha256: 'a'.repeat(64) }), row('logo.mark', 'to-default', { source: 'custom', versionId: 'lm-2', version: 2, mime: 'image/png', sha256: 'e'.repeat(64) }, { sha256: 'f'.repeat(64), mime: 'image/png', width: 614, height: 371 }), row('favicon.tab', 'unchanged')];

	it('set restore: choosing a version loads the EXACT preview and shows current vs target per key (kind, source, version, sha), unchanged keys collapsed; nothing executes yet', async () => {
		const t = setup(overview([withHistory()], true, 3), { ...hist(), restoreSetPreview: vi.fn(() => of({ success: true, data: preview(three) })) });
		await t.settle(); t.q('set-restore-1')!.click(); await t.settle();
		expect(t.api['restoreSetPreview']).toHaveBeenCalledWith(1);
		expect(t.api['restoreSet']).not.toHaveBeenCalled();
		expect(t.q('set-preview-summary')!.textContent).toContain('#3'); expect(t.q('set-preview-summary')!.textContent).toContain('#1'); expect(t.q('set-preview-summary')!.textContent).toContain('2 مفاتيح');
		expect(t.q('diff-kind-icon.ai')!.textContent).toContain('استبدال');
		expect(t.q('diff-kind-logo.mark')!.textContent).toContain('العودة للأصل'); expect(t.q('diff-kind-logo.mark')!.textContent).toContain('إزالة التخصيص');
		expect(t.q('diff-source-cur-icon.ai')!.textContent).toContain('مخصّص — النسخة 3'); expect(t.q('diff-source-new-logo.mark')!.textContent).toContain('الأصل الافتراضي');
		expect(t.q('diff-cur-icon.ai')!.textContent).toContain('cccccccccc'); expect(t.q('diff-new-icon.ai')!.textContent).toContain('aaaaaaaaaa');
		expect(t.q('diff-favicon.tab')).toBeNull(); // unchanged = collapsed, not a diff card
		expect(t.q('set-preview-unchanged')!.textContent).toContain('favicon.tab');
		// small previews on light AND dark for both sides
		const sideEl = t.q('diff-cur-icon.ai')!; expect(sideEl.querySelectorAll('[data-tone="light"]').length).toBeGreaterThan(0); expect(sideEl.querySelectorAll('[data-tone="dark"]').length).toBeGreaterThan(0);
		expect(t.api['previewBlob']).toHaveBeenCalledWith('icon.ai', 'v-3'); expect(t.api['previewBlob']).toHaveBeenCalledWith('icon.ai', 'v-1');
	});
	it('set restore confirm is BOUND to the displayed state: restoreSet(target, shown current manifest, digest of the preview) and the dialog lists the shown diff', async () => {
		const t = setup(overview([withHistory()], true, 3), { ...hist(), restoreSetPreview: vi.fn(() => of({ success: true, data: preview(three) })) });
		t.api['restoreSet'].mockReturnValue(of({ success: true, data: { manifestVersion: 4, snapshot: {}, keys: [], changedKeys: ['icon.ai', 'logo.mark'] } }));
		t.live.version = 4; await t.settle();
		t.q('set-restore-1')!.click(); await t.settle();
		t.q('set-preview-confirm')!.click(); await t.settle();
		const msg = (t.confirmSvc.confirm.mock.calls[0] as unknown as [{ message: string }])[0].message;
		expect(msg).toContain('أيقونة الذكاء الاصطناعي'); expect(msg).toContain('مخصّص — النسخة 3'); expect(msg).toContain('العودة للأصل'); expect(msg).not.toContain('favicon.tab');
		expect(t.api['restoreSet']).toHaveBeenCalledWith(1, 3, digest);
		expect(t.q('identity-set-notice')!.textContent).toContain('استُعيدت');
		expect(t.q('set-preview')).toBeNull();
	});
	it('stale preview (409 SITE_IDENTITY_PREVIEW_STALE): NOTHING executed, the FRESH preview is shown and the editor must review and confirm again (a new digest is sent, never the old one)', async () => {
		const fresh = preview([row('icon.ai', 'to-default', { source: 'custom', versionId: 'v-9', version: 9, sha256: '9'.repeat(64) })], 5, 1, '9'.repeat(64));
		const t = setup(overview([withHistory()], true, 3), { ...hist(), restoreSetPreview: vi.fn(() => of({ success: true, data: preview(three) })) });
		t.api['restoreSet'].mockReturnValueOnce(throwError(() => http(409, { code: 'SITE_IDENTITY_PREVIEW_STALE', message: 'تغيّرت', current: fresh }))).mockReturnValue(of({ success: true, data: { manifestVersion: 6, snapshot: {}, keys: [], changedKeys: ['icon.ai'] } }));
		await t.settle(); t.q('set-restore-1')!.click(); await t.settle();
		t.q('set-preview-confirm')!.click(); await t.settle();
		expect(t.api['restoreSet']).toHaveBeenCalledTimes(1);
		expect(t.q('set-preview-stale')).toBeTruthy(); expect(t.q('set-preview')!.getAttribute('data-stale')).toBe('true');
		expect(t.q('diff-kind-icon.ai')!.textContent).toContain('العودة للأصل'); expect(t.q('diff-logo.mark')).toBeNull(); // the FRESH diff replaced the old one
		expect(t.q('set-preview-summary')!.textContent).toContain('#5');
		expect(t.q('identity-set-notice')!.getAttribute('class')).toContain('conflict');
		t.q('set-preview-confirm')!.click(); await t.settle();
		expect(t.api['restoreSet']).toHaveBeenLastCalledWith(1, 5, '9'.repeat(64));
	});
	it('no-change preview cannot be applied; a failed preview shows the error with a retry; cancel closes it', async () => {
		const t = setup(overview([withHistory()], true, 3), { ...hist(), restoreSetPreview: vi.fn(() => of({ success: true, data: preview([row('icon.ai', 'unchanged')]) })) });
		await t.settle(); t.q('set-restore-1')!.click(); await t.settle();
		expect(t.q('set-preview-nochange')).toBeTruthy(); expect((t.q('set-preview-confirm') as HTMLButtonElement).disabled).toBe(true);
		t.q('set-preview-cancel')!.click(); t.f.detectChanges(); expect(t.q('set-preview')).toBeNull();
		t.api['restoreSetPreview'].mockReturnValue(throwError(() => http(500, { message: 'x' })));
		t.q('set-restore-1')!.click(); await t.settle();
		expect(t.q('set-preview-error')).toBeTruthy(); expect(t.q('set-preview-confirm')).toBeNull(); expect(t.api['restoreSet']).not.toHaveBeenCalled();
	});
	it('restore-to-all-defaults (version 0) goes through the same preview', async () => {
		const t = setup(overview([withHistory()], true, 3), { ...hist(), restoreSetPreview: vi.fn(() => of({ success: true, data: preview(three, 3, 0) })) });
		await t.settle(); t.q('set-restore-0')!.click(); await t.settle();
		expect(t.api['restoreSetPreview']).toHaveBeenCalledWith(0);
		expect(t.q('set-preview')!.textContent).toContain('الأصل الكامل');
		t.api['restoreSet'].mockReturnValue(of({ success: true, data: { manifestVersion: 4, snapshot: {}, keys: [], changedKeys: [] } }));
		t.q('set-preview-confirm')!.click(); await t.settle();
		expect(t.api['restoreSet']).toHaveBeenCalledWith(0, 3, digest);
	});
	it('whole-set conflict (VERSION_CONFLICT) is shown, not overwritten', async () => {
		const t = setup(overview([item()], true, 3), { ...hist(), restoreSetPreview: vi.fn(() => of({ success: true, data: preview(three) })) });
		t.api['restoreSet'].mockReturnValue(throwError(() => http(409, { code: 'SITE_IDENTITY_VERSION_CONFLICT', message: 'تغيّر البيان', current: { manifestVersion: 7 } })));
		await t.settle(); t.q('set-restore-1')!.click(); await t.settle(); t.q('set-preview-confirm')!.click(); await t.settle();
		expect(t.q('identity-set-conflict')!.textContent).toContain('7');
	});

	// ---------------------------------------------------------------- Round 2: apply confirmation
	it('«تطبيق» opens a confirmation naming the element (label + key), from -> to version and the usages; only then publishes the ALREADY STAGED id (no second upload)', async () => {
		const staged = meta({ status: 'STAGED', versionId: 'st1', version: 2, isMine: true });
		const t = setup(overview([item({ usages: [{ where: 'الشريط العلوي', ref: 'a' }, { where: 'التذييل', ref: 'b' }], state: { stateVersion: 1, isDefault: false, active: meta({ version: 1, versionId: 'v-1', sha256: 'c'.repeat(64) }), updatedAt: null, updatedBy: null } })]));
		t.api['upload'].mockReturnValue(of({ success: true, data: { ...staged, current: {} } }));
		t.api['publish'].mockReturnValue(of({ success: true, data: { key: 'icon.ai', stateVersion: 2, manifestVersion: 2, isDefault: false, active: { ...staged, status: 'PUBLISHED' }, updatedAt: null, updatedBy: null, previous: null } }));
		t.live.items['icon.ai'] = { sha256: staged.sha256 }; t.live.version = 2;
		await t.settle(); await pick(t); t.q('upload-icon.ai')!.click(); await t.settle();
		t.q('apply-icon.ai')!.click(); await t.settle();
		const cfg = (t.confirmSvc.confirm.mock.calls[0] as unknown as [{ message: string; title: string }])[0];
		expect(cfg.title).toContain('أيقونة الذكاء الاصطناعي'); expect(cfg.message).toContain('(icon.ai)');
		expect(cfg.message).toContain('من: النسخة 1'); expect(cfg.message).toContain('إلى: النسخة 2');
		expect(cfg.message).toContain('• الشريط العلوي'); expect(cfg.message).toContain('• التذييل'); expect(cfg.message).toContain('لا يُعاد رفع الملف');
		expect(t.api['publish']).toHaveBeenCalledWith('icon.ai', 'st1', 1);
		expect(t.api['upload']).toHaveBeenCalledTimes(1);
	});
	it('cancelling the apply confirmation publishes nothing and keeps the draft; two fast clicks open ONE dialog', async () => {
		const staged = meta({ status: 'STAGED', versionId: 'st1', isMine: true });
		let resolve!: (v: boolean) => void;
		const t = setup(overview([item()]), {}, true);
		t.confirmSvc.confirm.mockImplementation(() => new Promise<boolean>(r => { resolve = r; }));
		t.api['upload'].mockReturnValue(of({ success: true, data: { ...staged, current: {} } }));
		await t.settle(); await pick(t); t.q('upload-icon.ai')!.click(); await t.settle();
		t.q('apply-icon.ai')!.click(); t.q('apply-icon.ai')!.click(); await t.settle();
		expect(t.confirmSvc.confirm).toHaveBeenCalledTimes(1);
		resolve(false); await t.settle();
		expect(t.api['publish']).not.toHaveBeenCalled(); expect(t.q('compare-icon.ai')).toBeTruthy();
	});
	it('a staged draft that is gone/stale: the SERVER error is shown, nothing is re-uploaded', async () => {
		const staged = meta({ status: 'STAGED', versionId: 'st1', isMine: true });
		const t = setup(overview([item()]));
		t.api['upload'].mockReturnValue(of({ success: true, data: { ...staged, current: {} } }));
		t.api['publish'].mockReturnValue(throwError(() => http(409, { code: 'SITE_IDENTITY_VERSION_NOT_STAGED', message: 'هذه المسودة لم تعد جاهزة للتطبيق' })));
		await t.settle(); await pick(t); t.q('upload-icon.ai')!.click(); await t.settle();
		t.q('apply-icon.ai')!.click(); await t.settle();
		expect(t.q('notice-icon.ai')!.textContent).toContain('هذه المسودة لم تعد جاهزة للتطبيق');
		expect(t.api['upload']).toHaveBeenCalledTimes(1);
	});
	it('a draft uploaded by ANOTHER admin cannot be applied by this one (no apply button, a note, discard stays)', async () => {
		const other = meta({ status: 'STAGED', versionId: 'st9', isMine: false, createdBy: { id: 'zzzzzzzz-1', name: 'خالد' } });
		const t = setup(overview([item({ staged: [other] })]));
		await t.settle();
		expect(t.q('draft-notmine-st9')).toBeTruthy(); expect(t.q('draft-by-st9-name')!.textContent).toBe('خالد');
		(t.q('draft-open-st9') as HTMLElement).click(); await t.settle();
		expect(t.q('draft-notmine-note')!.textContent).toContain('خالد');
		expect(t.q('apply-icon.ai')).toBeNull(); expect(t.q('cancel-icon.ai')).toBeTruthy();
	});

	// ---------------------------------------------------------------- Round 2: who changed it
	it('«by whom» shows the NAME and the stable id (short inline, full id in title, copyable); null name = «غير معروف»; no e-mail anywhere', async () => {
		const t = setup(overview([item({ state: { stateVersion: 3, isDefault: false, active: meta({ version: 3, versionId: 'v-3' }), updatedAt: '2026-10-27T10:00:00Z', updatedBy: { id: 'f3a9c1d2-7777-4abc-9def-000000000001', name: 'منى العتيبي' } }, history: [meta({ version: 3, versionId: 'v-3', createdBy: { id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: null } }), meta({ version: 2, versionId: 'v-2', status: 'SUPERSEDED', createdBy: { id: 'u2u2u2u2-1', name: 'نور' } })] })], true, 3),
			{ history: vi.fn(() => of({ success: true, data: { manifest: [{ manifestVersion: 3, reason: 'p', createdAt: '2026-10-27T10:00:00Z', createdBy: { id: 'u3u3u3u3-9', name: 'هدى' }, changedKeys: ['icon.ai'] }], hasMore: false, nextBefore: null, versions: [] } })) });
		await t.settle();
		expect(t.q('updated-by-icon.ai-name')!.textContent).toBe('منى العتيبي');
		const idEl = t.q('updated-by-icon.ai-id')!; expect(idEl.textContent).toBe('f3a9c1d2'); expect(idEl.getAttribute('title')).toBe('f3a9c1d2-7777-4abc-9def-000000000001');
		expect(t.q('ver-by-v-3-name')!.textContent).toBe('غير معروف'); expect(t.q('ver-by-v-2-name')!.textContent).toBe('نور');
		expect(t.q('set-by-3-name')!.textContent).toBe('هدى');
		expect(t.root().textContent).not.toMatch(/@[a-z0-9.-]+\.[a-z]{2,}/i);
		const write = vi.fn(async () => undefined); Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
		(t.q('updated-by-icon.ai')!.querySelector('.btn-copy') as HTMLElement).click(); await t.settle();
		expect(write).toHaveBeenCalledWith('f3a9c1d2-7777-4abc-9def-000000000001');
	});
	it('conflict message names who changed it (name + id)', async () => {
		const staged = meta({ status: 'STAGED', versionId: 'st1', isMine: true });
		const cur = { key: 'icon.ai', stateVersion: 5, manifestVersion: 9, isDefault: false, active: meta({ version: 4 }), updatedAt: '2026-10-27T10:00:00Z', updatedBy: { id: 'abcd1234-z', name: 'خالد' } };
		const t = setup(overview([item()]));
		t.api['upload'].mockReturnValue(of({ success: true, data: { ...staged, current: {} } }));
		t.api['publish'].mockReturnValue(throwError(() => http(409, { code: 'SITE_IDENTITY_VERSION_CONFLICT', message: 'عدّل شخصٌ آخر', current: cur })));
		await t.settle(); await pick(t); t.q('upload-icon.ai')!.click(); await t.settle(); t.q('apply-icon.ai')!.click(); await t.settle();
		expect(t.q('conflict-by-icon.ai-name')!.textContent).toBe('خالد'); expect(t.q('conflict-by-icon.ai-id')!.textContent).toBe('abcd1234');
	});

	// ---------------------------------------------------------------- Round 2: permissions on the page
	it('Round 5: legacy site_control.manage = the edit capability (the server answers canManage:true): full controls, no read-only note; the server stays authoritative (canManage:false = read-only even with the grant)', async () => {
		const t = setup(overview([item({ state: { stateVersion: 1, isDefault: false, active: meta({ version: 1 }), updatedAt: null, updatedBy: null }, history: [meta({ version: 1 }), meta({ version: 2, status: 'SUPERSEDED' })] })], true, 2), {}, true, (id: string) => id === 'site_control.manage');
		await t.settle();
		expect(t.q('identity-readonly')).toBeNull();
		expect(t.q('file-icon.ai')).toBeTruthy();
		expect(t.root().querySelectorAll('[data-testid^="restore-"]').length).toBeGreaterThan(0);
		TestBed.resetTestingModule();
		const ro = setup(overview([item()], false), {}, true, (id: string) => id === 'site_control.manage'); await ro.settle();
		expect(ro.q('identity-readonly')).toBeTruthy(); expect(ro.q('file-icon.ai')).toBeNull();
	});
	it('site.view only: read-only with the site.view note; site.manage: full controls', async () => {
		const ro = setup(overview([item()], false), {}, true, (id: string) => id === 'site.view'); await ro.settle();
		expect(ro.q('identity-readonly')).toBeTruthy(); expect(ro.q('file-icon.ai')).toBeNull();
		TestBed.resetTestingModule();
		const rw = setup(overview([item()]), {}, true, (id: string) => id === 'site.manage'); await rw.settle();
		expect(rw.q('identity-readonly')).toBeNull(); expect(rw.q('file-icon.ai')).toBeTruthy();
	});
});

describe('identity view helpers', () => {
	it('previousVersion = the highest-numbered SUPERSEDED version', () => {
		const it = item({ state: { stateVersion: 3, isDefault: false, active: meta({ version: 3, versionId: 'v-3' }), updatedAt: null, updatedBy: null }, history: [meta({ version: 3, versionId: 'v-3' }), meta({ version: 1, versionId: 'v-1', status: 'SUPERSEDED' }), meta({ version: 2, versionId: 'v-2', status: 'SUPERSEDED' })] });
		expect(previousVersion(it)?.version).toBe(2);
		expect(previousVersion(item())).toBeNull();
	});
	it('describeFailure maps every failure to an Arabic kind', () => {
		expect(describeFailure(http(0), 'x').kind).toBe('network');
		expect(describeFailure(http(409, { code: 'SITE_IDENTITY_VERSION_CONFLICT', current: {} }), 'x').kind).toBe('conflict');
		expect(describeFailure(http(413, { code: 'SITE_IDENTITY_FILE_REJECTED', errors: [{ message: 'كبير', reason: 'TOO_BIG' }] }), 'x').message).toContain('كبير');
		expect(describeFailure(http(403, {}), 'x').kind).toBe('denied');
		expect(describeFailure(http(500, {}), 'x').message).toMatch(/[؀-ۿ]/);
		expect(bytesText(2048)).toContain('ك.ب');
	});
});
