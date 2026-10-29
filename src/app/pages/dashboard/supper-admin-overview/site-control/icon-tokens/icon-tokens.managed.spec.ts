import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { computed, signal } from '@angular/core';
import { vi } from 'vitest';
import { IconTokens } from './icon-tokens';
import { IconFnStore } from './icon-fn.store';
import { IconsService } from '../core/icons.service';
import { RealIconsService } from '../core/real-icons.service';
import { IconUsageService } from '../core/icon-usage.service';
import { SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { of } from 'rxjs';
import { IconFnRow } from '../../../../../core/identity/site-identity-admin.api';
import { AI_ICON_INNER } from '../../../../../core/constants/ai-icon';

// Round 6: the icon library is the SERVER-backed manager of the function icons. A load failure is an error state, never an empty library; an icon nothing follows is never offered as editable;
// the official AI mark stays managed by «الهوية».
const row = (o: Partial<IconFnRow> & { id: string }): IconFnRow => ({ key: 'icon.fn.' + o.id, label: o.id, library: null, status: 'default', reason: null, hasDraft: false, stateVersion: 0, activeVersion: null, defs: 1, variants: 1, viewBox: '0 0 24 24', ...o });
const ROWS: IconFnRow[] = [
	row({ id: 'i-bell', label: 'إشعارات' }),
	row({ id: 'i-check', label: 'تحقق', status: 'custom', activeVersion: 2, stateVersion: 2 }),
	row({ id: 'i-coin', label: 'عملة', key: null, library: 'general', status: 'not-wired', reason: { code: 'LIBRARY_ONLY', text: 'موجودة في المكتبة فقط' } }),
	row({ id: 'i-unused', label: 'غير مستعملة', key: null, library: 'general', status: 'not-wired', reason: { code: 'LIBRARY_ONLY', text: 'موجودة في المكتبة فقط' } }),
	row({ id: 'i-ai', label: 'ذكاء', key: null, status: 'not-wired', managedBy: 'icon.ai', reason: { code: 'MANAGED_BY_ICON_AI', text: 'تُدار من الهوية' } }),
	row({ id: 'ws-trust-ai', label: 'ثقة', key: null, library: 'ai', status: 'not-wired', managedBy: 'icon.ai', reason: { code: 'MANAGED_BY_ICON_AI', text: 'تُدار من الهوية' } }),
];
function setup(phase: 'loading' | 'ready' | 'error' | 'denied' = 'ready', over: { stale?: string; localError?: boolean; canManage?: boolean } = {}) {
	const rows = signal(ROWS);
	const store = {
		phase: signal(phase), message: signal('تعذّر الاتصال بالخادم'), staleWarning: signal(over.stale ?? ''), rows,
		list: computed(() => (phase === 'ready' ? { total: ROWS.length, counts: { default: 1, custom: 1, notWired: 3, withDraft: 0 }, limits: { maxCustom: 50, maxDraftsTotal: 60 }, rows: rows() } : null)),
		canManage: signal(over.canManage ?? true), customGlyphs: signal({}), shownIds: signal<string[]>([]), ensureGlyphs: vi.fn(async () => undefined), load: vi.fn(async () => undefined), row: (id: string) => ROWS.find(r => r.id === id) ?? null,
	};
	const libs = signal([{ id: 'general', label: 'العامة', colorVar: '--teal', icons: [{ slot: 'i-bell', label: 'إشعارات', svg: '<path d="M18 8A6 6 0 0 0 6 8"/>' }, { slot: 'i-check', label: 'تحقق', svg: '<path d="M20 6L9 17l-5-5"/>' }, { slot: 'i-coin', label: 'عملة', svg: '<circle cx="12" cy="12" r="9"/>' }, { slot: 'i-ai', label: 'ذكاء', svg: '<circle cx="12" cy="12" r="9"/>' }] }]);
	const icons = {
		libraries: libs, pristine: libs, legacy: signal([]), legacyUnreadable: signal<string | null>(null), legacyIgnored: signal<string[]>([]), ignoreLegacy: vi.fn(),
		loadError: signal(over.localError ? 'تعذّر تحميل ملف الأيقونات' : null), phase: signal(over.localError ? 'error' : 'ready'), savedCopyNotice: signal<string | null>(null), load: vi.fn(async () => undefined), exportJson: vi.fn(),
	};
	const real = { load: vi.fn(async () => undefined), get: (id: string) => (id === 'i-bell' ? { vb: '0 0 24 24', paint: { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, inner: '<path d="M18 8A6 6 0 0 0 6 8"/>', sha256: 'x', defs: 6, variants: 2, files: [] } : null), phase: signal('ready'), fullSvg: () => null };
	const U: Record<string, { status: string; drawnElsewhere?: number }> = { 'i-coin': { status: 'USED_UNBOUND', drawnElsewhere: 3 }, 'i-unused': { status: 'UNUSED' } };
	const usage = { unboundPlaces: signal([{ file: 'src/a.html', line: 3, reason: 'DYNAMIC', why: 'رسم يُختار وقت التشغيل من بيانات' }]), groupedUnbound: () => [{ reason: 'DYNAMIC', label: 'رسم يُختار وقت التشغيل', items: [{ file: 'src/a.html', line: 3, reason: 'DYNAMIC', why: 'رسم يُختار وقت التشغيل من بيانات' }] }], load: vi.fn(async () => undefined), get: (id: string) => U[id] ?? null, reason: (id: string) => (U[id]?.status === 'USED_UNBOUND' ? 'مستعملة في الموقع (3 موضعًا برسم مطابق) لكن لا موضع يتبع هذا المفتاح تحديدًا' : U[id]?.status === 'UNUSED' ? 'غير مستعملة حاليًا (محفوظة ولا تُحذف).' : null) };
	TestBed.configureTestingModule({ imports: [IconTokens], providers: [provideRouter([]), { provide: IconUsageService, useValue: usage }, { provide: IconFnStore, useValue: store }, { provide: IconsService, useValue: icons }, { provide: RealIconsService, useValue: real }, { provide: SiteIdentityAdminApi, useValue: { families: () => of({ success: true, data: { families: [], revision: 'x' } }) } }] });
	const f = TestBed.createComponent(IconTokens); f.detectChanges();
	const root = () => (f.nativeElement as HTMLElement).shadowRoot!;
	return { f, c: f.componentInstance, store, icons, root, q: (id: string) => root().querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
}
describe('icon library page (server-backed)', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('the official AI-mark slots (i-ai, ws-trust-ai, rp-i-ai) are managed by «الهوية»; functional AI-themed icons are not', () => {
		const t = setup();
		for (const s of ['i-ai', 'ws-trust-ai', 'rp-i-ai']) expect(t.c.managed(s), s).toBe(true);
		for (const s of ['i-check', 'ws-ai-eye', 'ws-ai-bolt', 'ws-ai-spark', 'ai-chat', 'ws-ai-alert']) expect(t.c.managed(s), s).toBe(false);
	});

	it('statuses: default / custom / not-wired; only wired icons get an editor button; the not-wired one shows its reason and NO button', () => {
		const t = setup();
		expect(t.q('icon-status-i-bell')!.textContent).toContain('افتراضية'); expect(t.q('icon-open-i-bell')!.textContent).toContain('تخصيص');
		expect(t.q('icon-status-i-check')!.textContent).toContain('مخصّصة'); expect(t.q('icon-open-i-check')!.textContent).toContain('تعديل');
		expect(t.q('icon-status-i-coin')!.textContent).toContain('غير مربوطة'); expect(t.q('notwired-i-coin')!.textContent).toContain('مستعملة وغير مربوطة'); expect(t.q('notwired-i-coin')!.getAttribute('title')).toContain('لا موضع يتبع هذا المفتاح');
		expect(t.c.statusText(ROWS.find(r => r.id === 'i-unused')!)).toBe('غير مستعملة'); expect(t.q('notwired-i-unused')!.textContent).toContain('غير مستعملة'); expect(t.q('notwired-i-unused')!.getAttribute('data-kind')).toBe('unused'); expect(t.q('notwired-i-unused')!.getAttribute('title')).toContain('لا تُحذف');
		expect(t.q('icon-open-i-coin')).toBeNull();
		expect(t.q('icon-card-i-coin')!.querySelector('input[type=file], select')).toBeNull();
	});

	it('managed AI slots: a link to «الهوية», the official glyph, no editor, no file input', () => {
		const t = setup();
		expect(t.q('managed-i-ai')!.textContent).toContain('مُدار من صفحة الهوية');
		expect(t.q('managed-link-i-ai')!.getAttribute('href')).toBe('/supper-admin-overview/site-control/identity');
		expect(t.q('icon-open-i-ai')).toBeNull();
		expect(t.q('icon-card-i-ai')!.querySelector('svg')!.innerHTML.replace(/\s/g, '')).toContain('r="2"');
		expect(t.q('icon-card-i-ai')!.querySelector('svg')!.innerHTML).not.toContain('r="9"');
	});

	it('the icons that can really change are listed first inside a tab, then the ones nothing follows', () => {
		const t = setup();
		const ids = Array.from(t.root().querySelectorAll('.icon-card')).map(c => c.getAttribute('data-testid'));
		expect(ids.indexOf('icon-card-i-check')).toBeLessThan(ids.indexOf('icon-card-i-bell'));
		expect(ids.indexOf('icon-card-i-bell')).toBeLessThan(ids.indexOf('icon-card-i-coin'));
	});

	it('LOAD FAILURE is an error with a retry and NO grid, NO tabs, NO counts: it never looks like an empty library', () => {
		const t = setup('error');
		expect(t.q('icons-load-error')!.textContent).toContain('وليس مكتبة فارغة');
		expect(t.q('icons-retry')).toBeTruthy(); expect(t.q('icons-grid-section')).toBeNull(); expect(t.root().querySelectorAll('.lib-tab').length).toBe(0);
		t.q('icons-retry')!.click(); expect(t.store.load).toHaveBeenCalledWith(true); expect(t.icons.load).toHaveBeenCalledWith(true);
	});

	it('LOADING is visible, not an empty grid', () => {
		const t = setup('loading');
		expect(t.q('icons-loading')).toBeTruthy(); expect(t.q('icons-grid-section')).toBeNull();
	});

	it('a failed REFRESH keeps the last good list and says so', () => {
		const t = setup('ready', { stale: 'تعذّر التحديث. المعروض هو آخر ما قرأناه.' });
		expect(t.q('icons-stale')!.textContent).toContain('آخر ما قرأناه'); expect(t.q('icon-card-i-bell')).toBeTruthy();
	});

	it('a failed local icons.json only removes the default drawings, never the server list', () => {
		const t = setup('ready', { localError: true });
		expect(t.q('icons-local-error')).toBeTruthy(); expect(t.q('icon-card-i-bell')).toBeTruthy();
	});

	it('read-only viewers get «عرض» buttons and a read-only note; no upload control exists on the page itself', () => {
		const t = setup('ready', { canManage: false });
		expect(t.q('icons-readonly')).toBeTruthy(); expect(t.q('icon-open-i-bell')!.textContent).toContain('عرض');
		expect(t.root().querySelector('.icon-card input[type=file]')).toBeNull();
	});

	it('the page states what it cannot reach (inline svg, TS-built svg, CSS, img) and that a swap happens after the page loaded', () => {
		const t = setup(); const txt = t.q('icons-limits')!.textContent!;
		for (const w of ['data-ws-icon', 'CSS', 'img', 'بعد اكتمال تحميل الصفحة']) expect(txt, w).toContain(w);
	});

	it('the old browser-only replace / upload / save / import controls are gone and the page says so; export stays as a read-only local copy', () => {
		const t = setup(); expect(t.root().querySelector('.btn-save')).toBeNull(); expect(t.root().querySelector('input[type=file]')).toBeNull();
		expect(t.q('icons-local-removed')!.textContent).toContain('حلّ محلّها'); expect(t.q('icons-export')!.textContent).toContain('للقراءة');
		t.q('icons-export')!.click(); expect(t.icons.exportJson).toHaveBeenCalled();
		expect(t.root().textContent).not.toContain('جزئي'); expect(t.q('icon-follows-i-bell')!.textContent).toContain('تتبعها'); expect(t.q('icon-follows-i-check')).toBeNull();
		expect(t.q('icon-card-i-bell')!.querySelector('svg')!.getAttribute('data-glyph')).toBe('real');
		expect(t.root().textContent).not.toContain('لا تغيّر هذه المكتبة أيقونات المنصة');
		expect(AI_ICON_INNER).toContain('circle');
		expect(t.root().querySelector('.panel-header')!.textContent).not.toContain('محلي'); expect(t.q('icons-limits')!.querySelector('summary')!.textContent).toContain('تفاصيل الاستخدام');
	});
});
