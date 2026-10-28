import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { IconFnEditor } from './icon-fn-editor';
import { IconFnStore } from './icon-fn.store';
import { IconFnItem, IconFnRow, IdentityAssetMeta, SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { SiteIdentityService } from '../../../../../core/identity/site-identity.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8"/></svg>';
const SHA = 'c'.repeat(64);
const meta = (o: Partial<IdentityAssetMeta> = {}): IdentityAssetMeta => ({ versionId: 'v' + (o.version ?? 1), key: 'icon.fn.i-bell', version: 1, status: 'STAGED', mime: 'image/svg+xml', sha256: SHA, width: 24, height: 24, byteSize: 120, note: null, createdBy: { id: 'u1', name: 'سارة' }, createdAt: '2026-10-28T10:00:00Z', url: null, previewUrl: '/p', isMine: true, ...o });
const item = (o: Partial<IconFnItem> = {}): IconFnItem => ({
	key: 'icon.fn.i-bell', group: 'icon', label: 'إشعارات', description: 'd', kind: 'svg', allowedMimes: ['image/svg+xml'], maxBytes: 65536, dimensions: {}, rules: [], defaultAsset: { type: 'inline-symbol', symbolId: 'i-bell', source: 's' },
	defaultFingerprint: { mime: 'image/svg+xml', width: 24, height: 24, byteSize: 95, sha256: 'd'.repeat(64) }, usages: [], notes: [], wired: true, editable: true, notWiredReason: null,
	state: { stateVersion: 0, isDefault: true, active: null, updatedAt: null, updatedBy: null }, staged: [], history: [], ...o });
const ROW: IconFnRow = { id: 'i-bell', key: 'icon.fn.i-bell', label: 'إشعارات', library: null, status: 'default', reason: null, hasDraft: false, stateVersion: 0, activeVersion: null, defs: 6, variants: 2, viewBox: '0 0 24 24' };
const http = (status: number, body: unknown = {}) => new HttpErrorResponse({ status, error: body });

function setup(over: Record<string, unknown> = {}, opts: { canEdit?: boolean; item?: IconFnItem } = {}) {
	const api: Record<string, ReturnType<typeof vi.fn>> = {
		iconItem: vi.fn(() => of({ success: true, data: opts.item ?? item() })),
		upload: vi.fn(() => of({ success: true, data: { ...meta(), current: {} } })),
		publish: vi.fn(() => of({ success: true, data: { fromVersion: 0, toVersion: 1 } })),
		restore: vi.fn(() => of({ success: true, data: { isDefault: true, toVersion: 0 } })),
		discard: vi.fn(() => of({ success: true, data: {} })),
		previewBlob: vi.fn(() => of(new Blob([SVG], { type: 'image/svg+xml' }))),
		refreshPublic: vi.fn(async () => true), ...over,
	};
	const confirmSvc = { confirm: vi.fn(async () => true) };
	const store = { load: vi.fn(async () => undefined) };
	const identity = { item: vi.fn(() => ({ sha256: SHA })), manifest: () => ({ items: {} }) };
	TestBed.configureTestingModule({ imports: [IconFnEditor], providers: [{ provide: SiteIdentityAdminApi, useValue: api }, { provide: ConfirmModalService, useValue: confirmSvc }, { provide: IconFnStore, useValue: store }, { provide: SiteIdentityService, useValue: identity }] });
	const f = TestBed.createComponent(IconFnEditor);
	f.componentRef.setInput('symbolId', 'i-bell'); f.componentRef.setInput('row', ROW); f.componentRef.setInput('canEdit', opts.canEdit ?? true); f.componentRef.setInput('defaultSvg', '<path d="M18 8"/>');
	f.detectChanges();
	const root = () => (f.nativeElement as HTMLElement).shadowRoot!;
	const q = (id: string) => root().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	const settle = async () => { for (let i = 0; i < 8; i++) { await f.whenStable(); await new Promise(r => setTimeout(r, 0)); f.detectChanges(); } };
	const pick = async () => { const el = q('fn-file') as HTMLInputElement; Object.defineProperty(el, 'files', { value: [new File([SVG], 'bell.svg', { type: 'image/svg+xml' })], configurable: true }); el.dispatchEvent(new Event('change')); await settle(); };
	return { f, c: f.componentInstance, api, confirmSvc, store, root, q, settle, pick };
}

describe('function-icon editor (icon.fn.<symbolId>, central flow)', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('opens the icon from the server, says where it changes and how many templates define it (variants warned)', async () => {
		const t = setup(); await t.settle();
		expect(t.api['iconItem']).toHaveBeenCalledWith('i-bell');
		expect(t.q('fn-state')!.textContent).toContain('لا تخصيص');
		const w = t.q('fn-where')!.textContent!; expect(w).toContain('كل موضع'); expect(w).toContain('6 قالب'); expect(w).toContain('2 أشكال');
	});

	it('the notifications icon lists where it changes AND where it does not (sidebar entry is not followed)', async () => {
		const t = setup(); await t.settle();
		expect(t.q('fn-places-follow')!.textContent).toContain('الشريط العلوي'); expect(t.q('fn-places-not')!.textContent).toContain('القائمة الجانبية');
		expect(t.q('fn-places-not')!.textContent).toContain('ws-bell');
	});

	it('upload stores a DRAFT only (nothing published), then shows the review with the dark/light/size previews', async () => {
		const t = setup(); await t.settle(); await t.pick();
		expect(t.api['upload']).toHaveBeenCalledWith('icon.fn.i-bell', expect.any(File)); expect(t.api['publish']).not.toHaveBeenCalled();
		expect(t.q('fn-review')!.textContent).toContain('لم يتغيّر الموقع بعد'); expect(t.q('fn-ctx-dark')!.querySelector('svg polygon')).not.toBeNull(); expect(t.q('fn-ctx-light')!.querySelector('svg polygon')).not.toBeNull();
		expect(t.q('fn-notice')!.textContent).toContain('مسودة');
	});

	it('apply asks for confirmation, publishes the draft BOUND to the state seen, refreshes this tab and the list', async () => {
		const t = setup({}, { item: item({ state: { stateVersion: 4, isDefault: true, active: null, updatedAt: null, updatedBy: null } }) }); await t.settle(); await t.pick();
		(t.q('fn-apply') as HTMLButtonElement).click(); await t.settle();
		expect(t.confirmSvc.confirm).toHaveBeenCalledTimes(1);
		expect(t.api['publish']).toHaveBeenCalledWith('icon.fn.i-bell', 'v1', 4);
		expect(t.api['refreshPublic']).toHaveBeenCalled(); expect(t.store.load).toHaveBeenCalledWith(true);
		expect(t.q('fn-notice')!.textContent).toContain('طُبّقت');
	});

	it('declined confirmation changes nothing', async () => {
		const t = setup(); await t.settle(); await t.pick(); t.confirmSvc.confirm.mockResolvedValueOnce(false);
		(t.q('fn-apply') as HTMLButtonElement).click(); await t.settle();
		expect(t.api['publish']).not.toHaveBeenCalled();
	});

	it('CONFLICT (someone else changed it first): nothing overwritten, the winner is named, current state re-read', async () => {
		const t = setup({ publish: vi.fn(() => throwError(() => http(409, { code: 'SITE_IDENTITY_VERSION_CONFLICT', current: { isDefault: false, active: { version: 3, sha256: 'e'.repeat(64) } } }))) });
		await t.settle(); await t.pick();
		(t.q('fn-apply') as HTMLButtonElement).click(); await t.settle();
		const n = t.q('fn-notice')!; expect(n.classList.contains('note-conflict')).toBe(true); expect(n.textContent).toContain('النسخة 3'); expect(t.q('fn-reload')).toBeTruthy();
		expect(t.api['iconItem'].mock.calls.length).toBeGreaterThan(1);
	});

	it('a REJECTED upload shows the server\'s reason and keeps the site and the draft area untouched', async () => {
		const t = setup({ upload: vi.fn(() => throwError(() => http(400, { code: 'SITE_IDENTITY_FILE_REJECTED', errors: [{ field: 'file', reason: 'ICON_NO_VIEWBOX', message: 'يجب أن يحمل الملف viewBox.' }] }))) });
		await t.settle(); await t.pick();
		expect(t.q('fn-notice')!.textContent).toContain('viewBox'); expect(t.q('fn-review')).toBeNull(); expect(t.api['publish']).not.toHaveBeenCalled();
	});

	it('cancel discards the server draft', async () => {
		const t = setup(); await t.settle(); await t.pick();
		(t.q('fn-cancel') as HTMLButtonElement).click(); await t.settle();
		expect(t.api['discard']).toHaveBeenCalledWith('icon.fn.i-bell', 'v1'); expect(t.q('fn-review')).toBeNull();
	});

	it('restore to default is offered only for a customised icon and needs confirmation', async () => {
		const active = meta({ version: 2, status: 'PUBLISHED', versionId: 'a2' });
		const t = setup({}, { item: item({ state: { stateVersion: 2, isDefault: false, active, updatedAt: null, updatedBy: null }, history: [active, meta({ version: 1, status: 'SUPERSEDED', versionId: 'a1' })] }) }); await t.settle();
		expect(t.q('fn-state')!.textContent).toContain('مخصّصة');
		(t.q('fn-restore-default') as HTMLButtonElement).click(); await t.settle();
		expect(t.confirmSvc.confirm).toHaveBeenCalled(); expect(t.api['restore']).toHaveBeenCalledWith('icon.fn.i-bell', 'default', 2);
		expect(t.q('fn-history')).toBeTruthy();
	});

	it('LOAD FAILURE of the icon is an explicit error with a retry, not an empty editor', async () => {
		const t = setup({ iconItem: vi.fn(() => throwError(() => http(500, {}))) }); await t.settle();
		expect(t.q('fn-error')).toBeTruthy(); expect(t.q('fn-retry')).toBeTruthy(); expect(t.q('fn-file')).toBeNull();
	});

	it('read-only viewers see the icon but get no upload / restore', async () => {
		const t = setup({}, { canEdit: false }); await t.settle();
		expect(t.q('fn-readonly')).toBeTruthy(); expect(t.q('fn-file')).toBeNull(); expect(t.q('fn-restore-default')).toBeNull();
	});
});
