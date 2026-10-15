import { MappedHttpError } from '../../core/forms/http-error';

/**
 * ONE place for "this form could not be submitted, show the user exactly where":
 *  - reportProblems(): marks every problem field (red border, aria-invalid, aria-describedby -> its message, role=alert
 *    message right under it), opens the wizard step / tab that holds the first one (callback), scrolls it below the
 *    sticky header and focuses it. Works for reactive, template-driven and signal based forms alike because it only
 *    needs the DOM element, found by `field` (#id, [data-field], [name], [formcontrolname]).
 *  - reportBackendError(): maps a 400/422 with field names onto the controls. A network / 429 / 5xx / 401 / 403 / 409 is
 *    NEVER turned into a field error: it returns handled=false and the caller shows its honest generic message.
 *  - SubmitGuard: a second click / Enter while a request is in flight does nothing (one request only).
 * The inputs themselves are never touched (values, uploaded files stay).
 */

export const INVALID_CLASS = 'ws-invalid';
export const FIELD_MSG_CLASS = 'ws-field-msg';

export interface FieldProblem {
	/** What to tell the user (Arabic). */
	message: string;
	/** #id, data-field, name or formcontrolname of the control. Ignored when `el` is given. */
	field?: string;
	el?: HTMLElement | null;
	/** Wizard step / tab that holds the control (passed to `openStep`). */
	step?: string | number | null;
	/** Arabic label (for summaries). */
	label?: string;
}

export interface ReportOptions {
	/** Opens the step / tab (may be async). Called only when the control is not rendered/visible yet. */
	openStep?: (step: string | number) => void | Promise<void>;
	/** Extra px kept free above the focused control, on top of the sticky header. Default 16. */
	gap?: number;
	/** Do not move focus (still marks). */
	noFocus?: boolean;
}

export interface ReportResult {
	focused: HTMLElement | null;
	/** Problems that matched no control on the page (the caller must show them in a banner, never drop them). */
	unresolved: FieldProblem[];
}

let seq = 0;
const messageOf = new WeakMap<HTMLElement, HTMLElement>();
const cleanup = new WeakMap<HTMLElement, () => void>();

/** Bottom edge (px) of whatever fixed/sticky bar covers the top of the viewport. */
export function stickyHeaderOffset(doc: Document = document): number {
	let bottom = 0;
	const view = doc.defaultView;
	if (!view) return 0;
	for (const el of Array.from(doc.querySelectorAll<HTMLElement>('header, nav, [data-sticky-header], .topnav, .t-bar'))) {
		const cs = view.getComputedStyle(el);
		if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
		const r = el.getBoundingClientRect();
		if (r.height > 0 && r.top <= 1 && r.top > -r.height) bottom = Math.max(bottom, r.bottom);
	}
	return Math.round(bottom);
}

/** True when the element is rendered (not in a closed step / display:none / detached). */
export function isRendered(el: HTMLElement | null | undefined): el is HTMLElement {
	if (!el || !el.isConnected) return false;
	if ((el as HTMLInputElement).type === 'hidden') return false;
	if (el.closest('[hidden], [aria-hidden="true"]')) return false;
	const view = el.ownerDocument.defaultView;
	if (view) {
		for (let n: HTMLElement | null = el; n; n = n.parentElement) {
			const cs = view.getComputedStyle(n);
			if (cs.display === 'none' || cs.visibility === 'hidden') return false;
		}
	}
	return true;
}

/** Scrolls the control into view BELOW the sticky header and focuses it (focus never scrolls by itself). */
export function scrollFocus(el: HTMLElement, gap = 16): void {
	const doc = el.ownerDocument;
	const offset = stickyHeaderOffset(doc) + gap;
	el.style.scrollMarginTop = `${offset}px`;
	if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start', behavior: 'smooth' });
	if (typeof el.focus === 'function') el.focus({ preventScroll: true });
}

/** Finds a control by #id, [data-field], [name], [formcontrolname], [data-testid] (first match in DOM order). */
export function resolveField(root: ParentNode, field: string): HTMLElement | null {
	const sel = `[id="${field}"], [data-field="${field}"], [name="${field}"], [formcontrolname="${field}"], [data-testid="${field}"]`;
	const hits = Array.from(root.querySelectorAll<HTMLElement>(sel));
	return hits.find((h) => isRendered(h)) ?? hits[0] ?? null;
}

/** Red border + aria-invalid + a role=alert message right after the control, wired with aria-describedby. */
export function markInvalid(el: HTMLElement, message: string): void {
	clearInvalid(el);
	el.classList.add(INVALID_CLASS);
	el.setAttribute('aria-invalid', 'true');
	const doc = el.ownerDocument;
	const host = el.closest<HTMLElement>('[data-field-wrap]') ?? el;
	const msg = doc.createElement('p');
	msg.id = `ws-field-msg-${++seq}`;
	msg.className = `${FIELD_MSG_CLASS} mt-1 block text-[11px] font-bold leading-relaxed text-red-500`;
	msg.setAttribute('role', 'alert');
	msg.setAttribute('data-testid', 'field-error');
	msg.textContent = message;
	host.insertAdjacentElement('afterend', msg);
	messageOf.set(el, msg);
	const ids = new Set((el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
	ids.add(msg.id);
	el.setAttribute('aria-describedby', Array.from(ids).join(' '));
	const off = () => clearInvalid(el);
	el.addEventListener('input', off, { once: true });
	el.addEventListener('change', off, { once: true });
	cleanup.set(el, () => { el.removeEventListener('input', off); el.removeEventListener('change', off); });
}

/** Removes the mark made by markInvalid (leaves any reactive ws-field-error alone). */
export function clearInvalid(el: HTMLElement): void {
	const msg = messageOf.get(el);
	cleanup.get(el)?.();
	cleanup.delete(el);
	if (msg) {
		const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x && x !== msg.id);
		if (ids.length) el.setAttribute('aria-describedby', ids.join(' ')); else el.removeAttribute('aria-describedby');
		msg.remove();
		messageOf.delete(el);
	}
	if (el.classList.contains(INVALID_CLASS)) {
		el.classList.remove(INVALID_CLASS);
		el.removeAttribute('aria-invalid');
	}
}

export function clearAllInvalid(root: ParentNode | null | undefined): void {
	if (!root) return;
	root.querySelectorAll<HTMLElement>(`.${INVALID_CLASS}`).forEach(clearInvalid);
}

const settle = () => new Promise<void>((r) => setTimeout(() => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : r()), 0));

function inDomOrder(a: HTMLElement, b: HTMLElement): number {
	if (a === b) return 0;
	return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

/**
 * Marks all problems and focuses the FIRST one in page order. If the first problem (by the order given, which is the
 * order of the form) lives in a closed step it is opened first. Problems whose control is not rendered (another closed
 * step) come back as `unresolved` so the caller can list them in the summary.
 */
export async function reportProblems(root: ParentNode | null | undefined, problems: FieldProblem[], opts: ReportOptions = {}): Promise<ReportResult> {
	const unresolved: FieldProblem[] = [];
	if (!root || !problems.length) return { focused: null, unresolved };
	clearAllInvalid(root);

	const find = (p: FieldProblem) => p.el ?? (p.field ? resolveField(root, p.field) : null);
	// The first problem decides which step opens: look at it before anything else.
	const first = problems[0];
	let firstEl = find(first);
	if (first.step != null && opts.openStep && !isRendered(firstEl)) {
		await opts.openStep(first.step);
		await settle();
		firstEl = find(first);
	}

	const marked: HTMLElement[] = [];
	for (const p of problems) {
		const el = p === first ? firstEl : find(p);
		if (!el || !isRendered(el)) {
			unresolved.push(p);
			continue;
		}
		markInvalid(el, p.message);
		marked.push(el);
	}
	marked.sort(inDomOrder);
	const focused = marked[0] ?? null;
	if (focused && !opts.noFocus) scrollFocus(focused, opts.gap ?? 16);
	return { focused, unresolved };
}

export interface BackendErrorResult {
	/** True when the error was a 400/422 whose field names matched controls (the message is under the field). */
	handled: boolean;
	/** True for kind 'backend-validation' (field-keyed or not). Anything else must stay a generic message. */
	validation: boolean;
	/** Field messages that matched no control: put them in the banner. */
	unresolved: Record<string, string>;
	focused: HTMLElement | null;
}

/**
 * Server field errors -> controls. Only a 400/422 may become a field error; network, 429, 5xx, 401, 403, 404, 409 return
 * `validation:false, handled:false` and the caller shows `mapped.message` as the honest generic message.
 * `resolve` maps a server field name to a control name/id when they differ ({ firstName: 'fname' }).
 */
export async function reportBackendError(
	root: ParentNode | null | undefined,
	mapped: MappedHttpError,
	opts: ReportOptions & { resolve?: Record<string, string>; steps?: Record<string, string | number>; labels?: Record<string, string> } = {},
): Promise<BackendErrorResult> {
	const empty: BackendErrorResult = { handled: false, validation: false, unresolved: {}, focused: null };
	if (mapped.kind !== 'backend-validation') return empty;
	const entries = Object.entries(mapped.fieldErrors ?? {});
	if (!root || !entries.length) return { ...empty, validation: true };
	const problems: FieldProblem[] = entries.map(([name, message]) => {
		const field = opts.resolve?.[name] ?? name;
		return { field, message, step: opts.steps?.[name] ?? opts.steps?.[field] ?? null, label: opts.labels?.[name] };
	});
	const res = await reportProblems(root, problems, opts);
	const unresolved: Record<string, string> = {};
	for (const p of res.unresolved) unresolved[p.field ?? ''] = p.message;
	return { handled: res.focused !== null, validation: true, unresolved, focused: res.focused };
}

/** Same idea for Angular reactive forms: after `attemptSubmit` says invalid, opens the step and focuses the first one. */
export async function focusInvalidControls(
	root: ParentNode | null | undefined,
	missing: { path: string; message: string; label?: string }[],
	opts: ReportOptions & { stepOf?: (path: string) => string | number | null | undefined } = {},
): Promise<ReportResult> {
	const problems: FieldProblem[] = missing.map((m) => {
		const name = m.path.split('.').pop() ?? m.path;
		return { field: name, message: m.message, label: m.label, step: opts.stepOf?.(m.path) ?? null };
	});
	if (!root) return { focused: null, unresolved: problems };
	const first = problems[0];
	if (first?.step != null && opts.openStep) {
		const el = resolveField(root, first.field!);
		if (!isRendered(el)) { await opts.openStep(first.step); await settle(); }
	}
	// Reactive controls already show their own ws-field-error; here only focus + aria, no duplicate message.
	let focused: HTMLElement | null = null;
	const unresolved: FieldProblem[] = [];
	for (const p of problems) {
		const el = resolveField(root, p.field!);
		if (!el || !isRendered(el)) { unresolved.push(p); continue; }
		el.setAttribute('aria-invalid', 'true');
		if (!focused || inDomOrder(el, focused) < 0) focused = el;
	}
	if (focused && !opts.noFocus) scrollFocus(focused, opts.gap ?? 16);
	return { focused, unresolved };
}

/** Blocks a second submit while one is running. `run` resolves to undefined when it was skipped. */
export class SubmitGuard {
	private _busy = false;
	get busy(): boolean { return this._busy; }
	async run<T>(fn: () => Promise<T> | T): Promise<T | undefined> {
		if (this._busy) return undefined;
		this._busy = true;
		try { return await fn(); } finally { this._busy = false; }
	}
	/** For callback style requests: call `release()` in next/error. Returns false when a request is already in flight. */
	enter(): boolean {
		if (this._busy) return false;
		this._busy = true;
		return true;
	}
	release(): void { this._busy = false; }
}
