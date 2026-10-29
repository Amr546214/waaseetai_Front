/**
 * Layout/stacking rules that keep the floating assistant from hiding page content.
 * Pure helpers (no Angular) so they are unit-testable and shared by the widget and the specs.
 */

/**
 * The widget's own stacking level. It sits ABOVE page content and sticky headers/footers
 * (<= 50) but BELOW every overlay the app opens: dashboard sidebar overlay and modal backdrops
 * (85), sidebar (90), top bar (100), website modals (150/200), confirm modal (400), ws-select
 * panel (2000) and the notification popup (2147482000). Inner layers of the widget (panel,
 * bubble, dock) only order themselves inside this one stacking context.
 */
export const ASSISTANT_Z_INDEX = 80;

/** Lowest z-index of any app overlay/modal the widget must stay under. */
export const LOWEST_OVERLAY_Z_INDEX = 85;

/** Height of the widget (avatar + gap + toolbar + floor gap) at the two avatar sizes, plus slack. */
export function assistantReservePx(avatarSize: number): number {
	return avatarSize + 8 + 46 + 12 + 16;
}

/** Cap for the automatic lift so a tall fixed element can never push the avatar off-screen. */
export const MAX_DETECTED_LIFT_PX = 200;

/** Gap kept between the widget and a detected bottom bar. */
export const BAR_CLEARANCE_PX = 12;

/**
 * Height (px from the viewport floor) of the tallest fixed/sticky bar that hugs the bottom of
 * the viewport (action bars like "التالي / السابق", cookie banners). 0 when there is none.
 * Samples a few points along the bottom edge; cheap enough to run on scroll/resize/route change.
 */
export function detectBottomBarHeight(doc: Document, win: Window, ignore: (el: Element) => boolean): number {
	const height = win.innerHeight;
	const width = win.innerWidth;
	if (!height || !width || typeof doc.elementsFromPoint !== 'function') return 0;
	let best = 0;
	for (const fraction of [0.1, 0.3, 0.5, 0.7, 0.9]) {
		const stack = doc.elementsFromPoint(Math.round(width * fraction), height - 2);
		for (const hit of stack) {
			for (let el: Element | null = hit; el && el !== doc.body && el !== doc.documentElement; el = el.parentElement) {
				if (ignore(el)) break;
				const style = win.getComputedStyle(el);
				if (style.position !== 'fixed' && style.position !== 'sticky') continue;
				if (style.pointerEvents === 'none' || style.visibility === 'hidden') continue;
				const rect = el.getBoundingClientRect();
				if (rect.height <= 0 || rect.height > height * 0.4 || rect.width < width * 0.4) continue;
				if (rect.bottom < height - 4 || rect.bottom > height + 4) continue;
				best = Math.max(best, Math.round(height - rect.top));
			}
		}
	}
	return Math.min(best, MAX_DETECTED_LIFT_PX);
}

/** Width (px) of the persistent dashboard sidebar on each side; 0 when it is off-canvas, hidden, or open as a modal overlay. */
export interface SidebarInset { left: number; right: number }

/**
 * The dashboard sidebar (z 90) sits above the widget (z 80), so an avatar dragged under it would vanish behind it.
 * Instead of lifting the widget above overlays, the drag region is cut to the content area: the persistent sidebar's
 * footprint is excluded from the viewport the widget moves in. Off-canvas (mobile) or overlay-open (.sb-ov.show) -> no inset.
 */
export function detectSidebarInset(doc: Document, win: Window): SidebarInset {
	const none: SidebarInset = { left: 0, right: 0 };
	if (doc.querySelector('.sb-ov.show')) return none;
	const el = doc.querySelector('.sidebar-wrapper');
	if (!el) return none;
	const style = win.getComputedStyle(el);
	if (style.display === 'none' || style.visibility === 'hidden') return none;
	const rect = el.getBoundingClientRect();
	const width = win.innerWidth;
	if (rect.width <= 0 || rect.right <= 0 || rect.left >= width) return none;
	// fully inside the viewport only: a half-slid drawer is a transition, not a persistent sidebar
	if (rect.left < 0 || rect.right > width) return none;
	return rect.left + rect.width / 2 > width / 2
		? { left: 0, right: Math.round(width - rect.left) }
		: { left: Math.round(rect.right), right: 0 };
}

/** True for form controls where the on-screen keyboard appears. */
export function isTextEntryElement(el: Element | null | undefined): boolean {
	if (!el || !(el instanceof HTMLElement)) return false;
	if (el.isContentEditable) return true;
	if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
	if (el instanceof HTMLSelectElement) return false;
	if (el instanceof HTMLInputElement) {
		return !el.readOnly && !el.disabled && !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden'].includes(el.type);
	}
	return false;
}
