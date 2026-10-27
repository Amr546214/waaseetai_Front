import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { IconTokens } from './icon-tokens';
import { IconsService } from '../core/icons.service';
import { AI_ICON_INNER } from '../../../../../core/constants/ai-icon';

// Round 2, «one editor per element»: the local icon library must not offer to replace/edit an icon the central identity page manages (the official AI mark).
const OFFICIAL = AI_ICON_INNER;
const CHANGED = '<circle cx="12" cy="12" r="9"/>';
const libs = () => [
	{ id: 'general', label: 'العامة', colorVar: '--teal', icons: [{ slot: 'i-ai', label: 'ذكاء اصطناعي', svg: CHANGED }, { slot: 'i-check', label: 'تحقق', svg: '<path d="M20 6L9 17l-5-5"/>' }] },
	{ id: 'ai', label: 'الذكاء', colorVar: '--ai', icons: [{ slot: 'ws-trust-ai', label: 'ثقة الذكاء', svg: OFFICIAL }, { slot: 'ws-ai-eye', label: 'عين الذكاء', svg: '<circle cx="12" cy="12" r="3"/>' }, { slot: 'ws-ai-bolt', label: 'صاعقة', svg: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>' }] },
];
function setup() {
	const reassign = vi.fn();
	const svc = { libraries: signal(libs()), loadError: signal(null), load: vi.fn(async () => undefined), reassignSlot: reassign, save: vi.fn(() => true), exportJson: vi.fn(), importJson: vi.fn() };
	TestBed.configureTestingModule({ imports: [IconTokens], providers: [provideRouter([]), { provide: IconsService, useValue: svc }] });
	const f = TestBed.createComponent(IconTokens); f.detectChanges();
	const root = () => (f.nativeElement as HTMLElement).shadowRoot!;
	return { f, c: f.componentInstance, root, reassign, svc, q: (id: string) => root().querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
}
describe('local icon library: slots managed by «الهوية»', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('only the official AI-mark slots (i-ai, ws-trust-ai) are managed; functional AI-themed icons stay local', () => {
		const t = setup();
		expect(t.c.managed('i-ai')).toBe(true); expect(t.c.managed('ws-trust-ai')).toBe(true); expect(t.c.managed('rp-i-ai')).toBe(true);
		for (const s of ['i-check', 'ws-ai-eye', 'ws-ai-bolt', 'ws-ai-spark', 'ai-chat', 'ws-ai-alert']) expect(t.c.managed(s), s).toBe(false);
	});
	it('general tab: i-ai shows «مُدار من صفحة الهوية» with a link, NO replace select and NO upload; other icons keep both', () => {
		const t = setup();
		expect(t.q('managed-i-ai')!.textContent).toContain('مُدار من صفحة الهوية');
		expect(t.q('managed-link-i-ai')!.getAttribute('href')).toBe('/supper-admin-overview/site-control/identity');
		expect(t.q('select-i-ai')).toBeNull();
		expect(t.q('managed-i-check')).toBeNull(); expect(t.q('select-i-check')).toBeTruthy();
		const card = t.q('managed-i-ai')!.closest('.icon-card')!;
		expect(card.querySelector('input[type=file]')).toBeNull();
	});
	it('the managed card draws the OFFICIAL glyph, never a local (edited/imported) copy', () => {
		const t = setup();
		const card = t.q('managed-i-ai')!.closest('.icon-card')!;
		expect(card.querySelector('svg')!.innerHTML.replace(/\s/g, '')).toContain('r="2"'); // the 7-circle mark, not the 9-radius circle
		expect(card.querySelector('svg')!.innerHTML).not.toContain('r="9"');
	});
	it('AI tab: ws-trust-ai is managed (locked), ws-ai-eye / ws-ai-bolt remain local sandbox with select + upload; managed glyphs are not offered as a copy source', () => {
		const t = setup(); t.c.selectLib('ai'); t.f.detectChanges();
		expect(t.q('managed-ws-trust-ai')).toBeTruthy(); expect(t.q('select-ws-trust-ai')).toBeNull();
		expect(t.q('select-ws-ai-eye')).toBeTruthy(); expect(t.q('select-ws-ai-bolt')).toBeTruthy();
		const opt = Array.from(t.q('select-ws-ai-eye')!.querySelectorAll('option')) as HTMLOptionElement[];
		expect(opt.find(o => o.value === 'ws-trust-ai')!.disabled).toBe(true);
		expect(opt.find(o => o.value === 'ws-ai-bolt')!.disabled).toBe(false);
	});
	it('programmatic replace/upload on a managed slot is refused as well (reassign never reaches the service)', async () => {
		const t = setup();
		const fake = { target: { value: 'i-check' } } as unknown as Event;
		t.c.onReassign('general', 'i-ai', fake);
		const sel = { target: { value: 'i-ai' } } as unknown as Event;
		t.c.onReassign('general', 'i-check', sel);
		expect(t.reassign).not.toHaveBeenCalled();
		t.c.onReassign('ai', 'ws-ai-eye', { target: { value: 'ws-ai-bolt' } } as unknown as Event);
		expect(t.reassign).toHaveBeenCalledTimes(1);
		await t.c.onUploadIcon('general', 'i-ai', { target: { files: [new File(['<svg/>'], 'a.svg')], value: '' } } as unknown as Event);
		expect(t.reassign).toHaveBeenCalledTimes(1);
	});
});
