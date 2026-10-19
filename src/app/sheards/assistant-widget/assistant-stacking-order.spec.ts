import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ASSISTANT_Z_INDEX, detectSidebarInset } from './assistant-avoidance';

// K-6: the widget host (one stacking context) must stay below every real overlay layer. Measured in real Chrome (local/mock);
// these static guards keep the ordering from drifting.
const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
const zOf = (css: string, selector: string): number => {
	const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const m = css.match(new RegExp(`${esc}\\s*{[^}]*?z-index:\\s*(\\d+)`));
	if (!m) throw new Error(`no z-index for ${selector}`);
	return Number(m[1]);
};

describe('z-index ordering around the assistant host', () => {
	it('bell panel (inside the top bar), top bar, mobile sidebar overlay, confirm dialogs and ws-select all sit above the widget', () => {
		const topbar = zOf(read('../dashboard/nav-dashboard/nav-dashboard.css'), '.topbar');
		const bell = zOf(read('../notification-bell/notification-bell.css'), '.nb-panel');
		const overlay = zOf(read('../../layouts/dashboard-layout/dashboard-layout.css'), '.sb-ov');
		const accDialog = zOf(read('../../pages/dashboard/supper-admin-overview/sa-accreditations/sa-accreditations.css'), '.acc-mov');
		const select = zOf(read('../../shared/forms/select.component.ts'), '.ws-sel-panel');
		for (const z of [topbar, overlay, accDialog, select]) expect(z).toBeGreaterThan(ASSISTANT_Z_INDEX);
		// the bell panel is a child of the top bar, so it is ranked by the top bar's layer
		expect(bell).toBeGreaterThan(0);
		expect(topbar).toBeGreaterThan(ASSISTANT_Z_INDEX);
		expect(read('../notification-popup/notification-popup.ts')).toContain('z-index: var(--ws-popup-z, 2147482000)');
	});

	it('the persistent sidebar (above the widget) is kept out of the avatar drag region', () => {
		const sidebar = zOf(read('../../layouts/dashboard-layout/dashboard-layout.css'), '.sidebar-wrapper');
		expect(sidebar).toBeGreaterThan(ASSISTANT_Z_INDEX);
		const ts = read('assistant-widget.ts');
		expect(ts).toContain('detectSidebarInset');
		expect(ts).toMatch(/width:\s*Math\.max\(0,\s*width - inset\.left - inset\.right\)/);
	});
});

describe('detectSidebarInset', () => {
	const doc = (wrapper: object | null, overlayOpen = false) => ({ querySelector: (s: string) => (s === '.sb-ov.show' ? (overlayOpen ? {} : null) : wrapper) }) as unknown as Document;
	const wrapper = (rect: Partial<DOMRect>, style: Partial<CSSStyleDeclaration> = {}) => ({ __rect: rect, __style: style });
	const win = (w: { __style?: object } | null, width = 1440) => ({ innerWidth: width, getComputedStyle: () => ({ display: 'block', visibility: 'visible', ...(w?.__style ?? {}) }) }) as unknown as Window;
	const withRect = (r: Partial<DOMRect>) => { const w = wrapper({ width: 0, ...r }) as any; w.getBoundingClientRect = () => ({ left: 0, right: 0, width: 0, ...r }); return w; };

	it('desktop sidebar on the right (RTL) -> right inset equal to its width', () => {
		const w = withRect({ left: 1180, right: 1440, width: 260 });
		expect(detectSidebarInset(doc(w), win(w))).toEqual({ left: 0, right: 260 });
	});
	it('sidebar on the left -> left inset', () => {
		const w = withRect({ left: 0, right: 260, width: 260 });
		expect(detectSidebarInset(doc(w), win(w))).toEqual({ left: 260, right: 0 });
	});
	it('off-canvas (mobile closed), hidden, absent or open as a modal overlay -> no inset', () => {
		const off = withRect({ left: 390, right: 650, width: 260 });
		expect(detectSidebarInset(doc(off), win(off, 390))).toEqual({ left: 0, right: 0 });
		const hidden = withRect({ left: 1180, right: 1440, width: 260 });
		expect(detectSidebarInset(doc(hidden), { innerWidth: 1440, getComputedStyle: () => ({ display: 'none', visibility: 'visible' }) } as unknown as Window)).toEqual({ left: 0, right: 0 });
		expect(detectSidebarInset(doc(null), win(null))).toEqual({ left: 0, right: 0 });
		const open = withRect({ left: 130, right: 390, width: 260 });
		expect(detectSidebarInset(doc(open, true), win(open, 390))).toEqual({ left: 0, right: 0 });
	});
});
