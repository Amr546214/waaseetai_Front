import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapHttpError } from '../../core/forms/http-error';
import { FormA11ySyncService } from './form-a11y-sync.service';
import {
	clearAllInvalid, focusInvalidControls, markInvalid, reportBackendError, reportProblems, scrollFocus, stickyHeaderOffset, SubmitGuard,
} from './form-error-focus';

let host: HTMLElement;
const scrollSpy = vi.fn();

beforeEach(() => {
	host = document.createElement('div');
	host.innerHTML = `
		<header style="position:fixed;top:0;height:64px">bar</header>
		<div id="step1"><input id="name" name="name"><input id="price" name="price" type="number"></div>
		<div id="step2" hidden><input id="title" name="title"><textarea id="desc" name="desc"></textarea></div>`;
	document.body.appendChild(host);
	(Element.prototype as any).scrollIntoView = scrollSpy;
	scrollSpy.mockClear();
});
afterEach(() => host.remove());

describe('reportProblems', () => {
	it('marks every field (red class, aria-invalid, aria-describedby -> role=alert message) and focuses the first in page order', async () => {
		const res = await reportProblems(host, [
			{ field: 'price', message: 'السعر مطلوب' },
			{ field: 'name', message: 'الاسم مطلوب' },
		]);
		const name = host.querySelector<HTMLInputElement>('#name')!;
		const price = host.querySelector<HTMLInputElement>('#price')!;
		expect(res.focused).toBe(name);
		expect(document.activeElement).toBe(name);
		for (const el of [name, price]) {
			expect(el.getAttribute('aria-invalid')).toBe('true');
			expect(el.classList.contains('ws-invalid')).toBe(true);
			const msg = host.ownerDocument.getElementById(el.getAttribute('aria-describedby')!)!;
			expect(msg.getAttribute('role')).toBe('alert');
		}
		expect(host.ownerDocument.getElementById(name.getAttribute('aria-describedby')!)!.textContent).toBe('الاسم مطلوب');
		expect(scrollSpy).toHaveBeenCalled();
	});

	it('opens the closed step that holds the first invalid field, then focuses it', async () => {
		const openStep = vi.fn((s: string | number) => { host.querySelector('#step2')!.removeAttribute('hidden'); void s; });
		const res = await reportProblems(host, [{ field: 'title', message: 'العنوان مطلوب', step: 2 }], { openStep });
		expect(openStep).toHaveBeenCalledWith(2);
		expect(document.activeElement).toBe(host.querySelector('#title'));
		expect(res.unresolved).toEqual([]);
	});

	it('does not call openStep when the field is already visible', async () => {
		const openStep = vi.fn();
		await reportProblems(host, [{ field: 'name', message: 'x', step: 1 }], { openStep });
		expect(openStep).not.toHaveBeenCalled();
	});

	it('reports controls that exist nowhere as unresolved instead of dropping them', async () => {
		const res = await reportProblems(host, [{ field: 'nope', message: 'ما' }]);
		expect(res.unresolved.map((p) => p.field)).toEqual(['nope']);
		expect(res.focused).toBeNull();
	});

	it('keeps typed values and clears the mark as soon as the user edits', async () => {
		const name = host.querySelector<HTMLInputElement>('#name')!;
		name.value = 'مثال';
		await reportProblems(host, [{ field: 'name', message: 'خطأ' }]);
		expect(name.value).toBe('مثال');
		name.dispatchEvent(new Event('input'));
		expect(name.getAttribute('aria-invalid')).toBeNull();
		expect(name.getAttribute('aria-describedby')).toBeNull();
		expect(host.querySelector('.ws-field-msg')).toBeNull();
	});

	it('clearAllInvalid removes every mark', async () => {
		await reportProblems(host, [{ field: 'name', message: 'a' }, { field: 'price', message: 'b' }]);
		clearAllInvalid(host);
		expect(host.querySelectorAll('.ws-invalid, .ws-field-msg').length).toBe(0);
	});
});

describe('scroll offset', () => {
	it('keeps the field below the sticky header', () => {
		const header = host.querySelector('header')!;
		header.getBoundingClientRect = () => ({ top: 0, bottom: 64, height: 64, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON() {} } as DOMRect);
		expect(stickyHeaderOffset(document)).toBe(64);
		const el = host.querySelector<HTMLElement>('#name')!;
		scrollFocus(el, 16);
		expect(el.style.scrollMarginTop).toBe('80px');
	});
});

describe('reportBackendError', () => {
	const http = (status: number, body: unknown, headers?: any) => mapHttpError({ status, error: body, headers });

	it('maps a 400 with field names onto the controls (message under the field)', async () => {
		const mapped = http(400, { errors: [{ field: 'price', message: 'السعر أقل من الحد الأدنى' }] });
		const res = await reportBackendError(host, mapped);
		const price = host.querySelector<HTMLInputElement>('#price')!;
		expect(res.handled).toBe(true);
		expect(document.activeElement).toBe(price);
		expect(host.ownerDocument.getElementById(price.getAttribute('aria-describedby')!)!.textContent).toBe('السعر أقل من الحد الأدنى');
	});

	it('returns server fields that match no control so the caller can put them in the banner', async () => {
		const res = await reportBackendError(host, http(422, { errors: [{ field: 'ghost', message: 'سبب' }] }));
		expect(res.handled).toBe(false);
		expect(res.validation).toBe(true);
		expect(res.unresolved).toEqual({ ghost: 'سبب' });
	});

	it.each([[0, null], [429, { message: 'Too many requests' }], [500, { message: 'boom' }], [503, null], [403, { message: 'no' }], [409, { message: 'x' }], [401, null]])(
		'status %s is never turned into a field error', async (status, body) => {
			const res = await reportBackendError(host, http(status as number, body));
			expect(res.handled).toBe(false);
			expect(res.validation).toBe(false);
			expect(host.querySelector('.ws-invalid')).toBeNull();
			expect(host.querySelector('.ws-field-msg')).toBeNull();
		});
});

describe('focusInvalidControls (reactive forms)', () => {
	it('opens the step and focuses the first invalid control in page order', async () => {
		const openStep = vi.fn(() => { host.querySelector('#step2')!.removeAttribute('hidden'); });
		const res = await focusInvalidControls(host, [{ path: 'b.title', message: 'x' }], { openStep, stepOf: () => 2 });
		expect(openStep).toHaveBeenCalledWith(2);
		expect(res.focused).toBe(host.querySelector('#title'));
		expect(host.querySelector('#title')!.getAttribute('aria-invalid')).toBe('true');
	});
});

describe('SubmitGuard', () => {
	it('two quick submits send one request', async () => {
		const guard = new SubmitGuard();
		let calls = 0;
		let release!: () => void;
		const send = () => guard.run(() => { calls++; return new Promise<void>((r) => { release = r; }); });
		const a = send();
		const b = await send();
		expect(b).toBeUndefined();
		release();
		await a;
		expect(calls).toBe(1);
		await send2();
		async function send2() { const p = send(); release(); await p; }
		expect(calls).toBe(2);
	});

	it('enter/release for callback style requests', () => {
		const g = new SubmitGuard();
		expect(g.enter()).toBe(true);
		expect(g.enter()).toBe(false);
		g.release();
		expect(g.enter()).toBe(true);
	});
});

describe('FormA11ySyncService', () => {
	it('sets aria-invalid + aria-describedby on touched invalid controls and removes them when valid', () => {
		const svc = new FormA11ySyncService();
		host.innerHTML = `<div><input id="a" class="ng-invalid ng-touched"><span role="alert" data-testid="field-error">مطلوب</span></div>
			<div><input id="b" class="ng-invalid ng-touched"></div>`;
		svc.sync(document);
		const a = host.querySelector<HTMLInputElement>('#a')!;
		const msg = host.querySelector('[role=alert]')!;
		expect(a.getAttribute('aria-invalid')).toBe('true');
		expect(a.getAttribute('aria-describedby')).toBe(msg.id);
		// the second control has no message of its own: it must not borrow the first one's
		expect(host.querySelector('#b')!.getAttribute('aria-describedby')).toBeNull();
		a.className = 'ng-valid ng-touched';
		svc.sync(document);
		expect(a.getAttribute('aria-invalid')).toBeNull();
		expect(a.getAttribute('aria-describedby')).toBeNull();
	});
});

describe('markInvalid', () => {
	it('is idempotent (re-marking replaces the message)', () => {
		const el = host.querySelector<HTMLElement>('#name')!;
		markInvalid(el, 'one');
		markInvalid(el, 'two');
		expect(host.querySelectorAll('.ws-field-msg').length).toBe(1);
		expect(host.querySelector('.ws-field-msg')!.textContent).toBe('two');
	});
});
