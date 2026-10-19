import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ASSISTANT_Z_INDEX, LOWEST_OVERLAY_Z_INDEX, MAX_DETECTED_LIFT_PX, assistantReservePx, detectBottomBarHeight, isTextEntryElement } from './assistant-avoidance';

// D-CM1: the floating assistant must never hide primary actions or sit over modals. Real-browser geometry (bounding-box overlap, elementFromPoint, keyboard)
// is measured with Playwright against a local mock; these guards keep the contract from regressing.
const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');

describe('assistant stacking and reserved space (D-CM1)', () => {
	const css = read('assistant-widget.css');
	const ts = read('assistant-widget.ts');
	const layoutCss = read('../../layouts/dashboard-layout/dashboard-layout.css');

	it('the widget host layer comes from ASSISTANT_Z_INDEX and stays below every app overlay', () => {
		expect(css).toContain(`z-index: var(--ws-assistant-z, ${ASSISTANT_Z_INDEX});`);
		expect(ASSISTANT_Z_INDEX).toBeLessThan(LOWEST_OVERLAY_Z_INDEX);
		expect(css).not.toMatch(/:host\s*{[^}]*z-index:\s*9\d\d/);
		// dashboard sidebar overlay is the lowest overlay the widget must stay under
		expect(layoutCss).toMatch(new RegExp(`\\.sb-ov\\s*{[^}]*z-index:\\s*${LOWEST_OVERLAY_Z_INDEX}`));
	});

	it('steps aside for the on-screen keyboard without intercepting pointers', () => {
		expect(css).toMatch(/:host\(\.is-kbd-hidden\)\s*{\s*visibility:\s*hidden/);
		expect(ts).toContain("'[class.is-kbd-hidden]': 'keyboardHidden()'");
		expect(ts).toContain('isTextEntryElement');
	});

	it('honours the safe-area inset and publishes the reserved space the dashboard content uses', () => {
		expect(ts).toContain('env(safe-area-inset-bottom');
		expect(ts).toContain('--ws-assistant-reserve');
		expect(layoutCss).toMatch(/padding:\s*22px 24px calc\(22px \+ var\(--ws-assistant-reserve, 0px\)\)/);
		expect(layoutCss).toMatch(/padding:\s*14px 16px calc\(14px \+ var\(--ws-assistant-reserve, 0px\)\)/);
	});

	it('small screens start with the compact pill and collapse it on an outside tap', () => {
		expect(ts).toContain("window.matchMedia('(max-width: 640px)').matches");
		expect(ts).toContain('onDocumentPointerDown');
	});

	it('the reserve covers avatar + gap + toolbar for both avatar sizes', () => {
		expect(assistantReservePx(96)).toBeGreaterThanOrEqual(96 + 8 + 44);
		expect(assistantReservePx(72)).toBeGreaterThanOrEqual(72 + 8 + 42);
	});
});

describe('detectBottomBarHeight', () => {
	const win = (styles: Map<unknown, Record<string, string>>) => ({
		innerHeight: 800, innerWidth: 1200,
		getComputedStyle: (el: unknown) => ({ position: 'static', pointerEvents: 'auto', visibility: 'visible', ...(styles.get(el) ?? {}) }),
	}) as unknown as Window;
	const el = (rect: Partial<DOMRect>, parent: unknown = null) => ({ parentElement: parent, getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 0, width: 0, ...rect }) }) as unknown as Element;
	const doc = (stack: Element[]) => ({ body: {}, documentElement: {}, elementsFromPoint: () => stack }) as unknown as Document;

	it('returns the height of a fixed bar hugging the floor', () => {
		const bar = el({ top: 724, bottom: 800, height: 76, width: 1200 });
		expect(detectBottomBarHeight(doc([bar]), win(new Map([[bar, { position: 'fixed' }]])), () => false)).toBe(76);
	});

	it('finds a fixed ancestor of the hit element and ignores non-bottom, tall or narrow fixed elements', () => {
		const bar = el({ top: 710, bottom: 800, height: 90, width: 1200 });
		const child = el({}, bar);
		expect(detectBottomBarHeight(doc([child]), win(new Map([[bar, { position: 'sticky' }]])), () => false)).toBe(90);
		const header = el({ top: 0, bottom: 56, height: 56, width: 1200 });
		const overlay = el({ top: 0, bottom: 800, height: 800, width: 1200 });
		const fab = el({ top: 740, bottom: 800, height: 60, width: 60 });
		const styles = new Map([[header, { position: 'fixed' }], [overlay, { position: 'fixed' }], [fab, { position: 'fixed' }]]);
		expect(detectBottomBarHeight(doc([header, overlay, fab]), win(styles), () => false)).toBe(0);
	});

	it('ignores the widget itself and click-through layers, and caps the lift', () => {
		const own = el({ top: 700, bottom: 800, height: 100, width: 1200 });
		expect(detectBottomBarHeight(doc([own]), win(new Map([[own, { position: 'fixed' }]])), e => e === own)).toBe(0);
		const through = el({ top: 700, bottom: 800, height: 100, width: 1200 });
		expect(detectBottomBarHeight(doc([through]), win(new Map([[through, { position: 'fixed', pointerEvents: 'none' }]])), () => false)).toBe(0);
		const tall = el({ top: 400, bottom: 800, height: 400, width: 1200 });
		expect(detectBottomBarHeight(doc([tall]), win(new Map([[tall, { position: 'fixed' }]])), () => false)).toBe(0);
		expect(MAX_DETECTED_LIFT_PX).toBe(200);
	});
});

describe('isTextEntryElement', () => {
	it('is false for missing nodes and non-text controls', () => {
		expect(isTextEntryElement(null)).toBe(false);
		expect(isTextEntryElement(undefined)).toBe(false);
	});
	it('recognises text inputs and textareas but not checkboxes, selects or buttons', () => {
		const make = (tag: string, type?: string) => { const e = document.createElement(tag); if (type) (e as HTMLInputElement).type = type; return e; };
		expect(isTextEntryElement(make('input', 'text'))).toBe(true);
		expect(isTextEntryElement(make('input', 'email'))).toBe(true);
		expect(isTextEntryElement(make('textarea'))).toBe(true);
		expect(isTextEntryElement(make('input', 'checkbox'))).toBe(false);
		expect(isTextEntryElement(make('input', 'submit'))).toBe(false);
		expect(isTextEntryElement(make('select'))).toBe(false);
		expect(isTextEntryElement(make('button'))).toBe(false);
	});
});
