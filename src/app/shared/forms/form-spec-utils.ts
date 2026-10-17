import { HttpErrorResponse } from '@angular/common/http';
import { expect } from 'vitest';

/** Shared helpers for form specs (Batch B / T2). Only used from *.spec.ts files. */

/** Lets pending microtasks, timers and the animation frame used by reportProblems settle. */
export const settleForm = () => new Promise<void>((r) => setTimeout(r, 60)); // covers the setTimeout + animation frame the step opening waits for

/** An HttpErrorResponse as the backend sends it: { error: <body> }. */
export function httpFail(status: number, body: unknown = null, headers?: Record<string, string>): HttpErrorResponse {
	return new HttpErrorResponse({ status, error: body, statusText: String(status), headers: headers as any });
}

/** The field is red, aria-invalid, and aria-describedby points at a visible role=alert message (optionally with this text). */
export function expectFieldProblem(el: Element | null | undefined, text?: string | RegExp): HTMLElement {
	expect(el, 'field element').toBeTruthy();
	const field = el as HTMLElement;
	expect(field.getAttribute('aria-invalid')).toBe('true');
	const ids = (field.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
	const alert = ids.map((id) => field.ownerDocument.getElementById(id)).find((m) => m && m.getAttribute('role') === 'alert' && (m.textContent ?? '').trim());
	expect(alert, 'role=alert message wired through aria-describedby').toBeTruthy();
	if (text) expect(alert!.textContent).toMatch(text instanceof RegExp ? text : new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
	return alert!;
}

/** Nothing on the page claims a field error (429 / network / 5xx must stay generic). */
export function expectNoFieldProblem(root: ParentNode): void {
	expect(root.querySelectorAll('.ws-field-msg').length).toBe(0);
	expect(root.querySelectorAll('.ws-invalid').length).toBe(0);
}

/** The control that has focus is `el` (focus is the first-invalid proof). */
export function expectFocused(el: Element | null | undefined): void {
	expect(el, 'expected element').toBeTruthy();
	expect(document.activeElement).toBe(el);
}
