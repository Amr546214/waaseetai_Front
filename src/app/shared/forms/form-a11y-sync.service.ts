import { Injectable } from '@angular/core';

const CONTROL = 'input, textarea, select, [formcontrolname]';
const MESSAGE = '[role="alert"][data-testid="field-error"], .ws-field-msg';
let seq = 0;

/**
 * Keeps the accessibility state of EVERY Angular form control in sync with its validity, site wide, so the
 * ws-field-error under a field is not just visible but also announced:
 *   control is invalid AND touched  ->  aria-invalid="true" + aria-describedby -> the error message that follows it
 *   control is valid / untouched    ->  both removed (only the ones set here)
 * Started once from the root component. Controls that report their own errors (markInvalid in form-error-focus) are left alone.
 */
@Injectable({ providedIn: 'root' })
export class FormA11ySyncService {
	private started = false;
	private scheduled = false;
	private observer: MutationObserver | null = null;

	start(doc: Document = document): void {
		if (this.started || typeof MutationObserver === 'undefined' || !doc.body) return;
		this.started = true;
		this.observer = new MutationObserver((records) => {
			if (records.some((r) => this.relevant(r))) this.schedule(doc);
		});
		this.observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
		this.schedule(doc);
	}

	stop(): void { this.observer?.disconnect(); this.observer = null; this.started = false; }

	/** Runs a full pass now (tests, and after programmatic changes). */
	sync(doc: Document = document): void {
		const invalid = new Set(Array.from(doc.querySelectorAll<HTMLElement>(CONTROL)).filter((el) => this.isInvalid(el)));
		for (const el of invalid) this.apply(el);
		for (const el of Array.from(doc.querySelectorAll<HTMLElement>('[data-ws-a11y]'))) {
			if (!invalid.has(el)) this.release(el);
		}
	}

	private relevant(r: MutationRecord): boolean {
		if (r.type === 'attributes') {
			const t = r.target as HTMLElement;
			return t.matches?.(CONTROL) ?? false;
		}
		return Array.from(r.addedNodes).some((n) => n.nodeType === 1 && ((n as Element).matches?.(MESSAGE) || (n as Element).querySelector?.(MESSAGE)))
			|| Array.from(r.removedNodes).some((n) => n.nodeType === 1);
	}

	private schedule(doc: Document): void {
		if (this.scheduled) return;
		this.scheduled = true;
		const run = () => { this.scheduled = false; this.sync(doc); };
		if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else setTimeout(run, 16);
	}

	private isInvalid(el: HTMLElement): boolean {
		if ((el as HTMLInputElement).disabled) return false;
		if (el.classList.contains('ws-invalid')) return false; // owned by markInvalid
		return el.classList.contains('ng-invalid') && (el.classList.contains('ng-touched') || el.classList.contains('ng-dirty'));
	}

	private apply(el: HTMLElement): void {
		if (el.getAttribute('aria-invalid') !== 'true') el.setAttribute('aria-invalid', 'true');
		el.setAttribute('data-ws-a11y', '1');
		const msg = this.messageFor(el);
		const prev = el.getAttribute('data-ws-a11y-desc');
		if (!msg) { if (prev) this.dropDesc(el, prev); return; }
		if (!msg.id) msg.id = `ws-a11y-msg-${++seq}`;
		if (prev === msg.id) return;
		if (prev) this.dropDesc(el, prev);
		const ids = new Set((el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
		ids.add(msg.id);
		el.setAttribute('aria-describedby', Array.from(ids).join(' '));
		el.setAttribute('data-ws-a11y-desc', msg.id);
	}

	private release(el: HTMLElement): void {
		const prev = el.getAttribute('data-ws-a11y-desc');
		if (prev) this.dropDesc(el, prev);
		el.removeAttribute('data-ws-a11y');
		el.removeAttribute('aria-invalid');
	}

	private dropDesc(el: HTMLElement, id: string): void {
		const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x && x !== id);
		if (ids.length) el.setAttribute('aria-describedby', ids.join(' ')); else el.removeAttribute('aria-describedby');
		el.removeAttribute('data-ws-a11y-desc');
	}

	/** The first error message after the control that is not past the next control (so two fields never share a message). */
	private messageFor(el: HTMLElement): HTMLElement | null {
		let scope: HTMLElement | null = el.parentElement;
		for (let depth = 0; scope && depth < 4; depth++, scope = scope.parentElement) {
			const controls = Array.from(scope.querySelectorAll<HTMLElement>(CONTROL));
			const next = controls[controls.indexOf(el) + 1] ?? null;
			for (const m of Array.from(scope.querySelectorAll<HTMLElement>(MESSAGE))) {
				const afterEl = !!(el.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING);
				const beforeNext = !next || !!(next.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_PRECEDING);
				if (afterEl && beforeNext) return m;
			}
		}
		return null;
	}
}
