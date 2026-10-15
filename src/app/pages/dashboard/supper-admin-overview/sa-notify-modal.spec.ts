import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect } from 'vitest';
import { SaNotifyModal } from './sa-notify-modal';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, settleForm } from '../../../shared/forms/form-spec-utils';

function setup() {
	TestBed.configureTestingModule({ imports: [SaNotifyModal], providers: [provideHttpClient(), provideHttpClientTesting()] });
	const http = TestBed.inject(HttpTestingController);
	const f = TestBed.createComponent(SaNotifyModal);
	f.componentRef.setInput('userId', 'u1');
	f.detectChanges();
	const el = f.nativeElement as HTMLElement;
	const ta = el.querySelector('#sa-notify-message') as HTMLTextAreaElement;
	const send = el.querySelector('button.btn-primary') as HTMLButtonElement;
	const type = (v: string) => { ta.value = v; ta.dispatchEvent(new Event('input')); f.detectChanges(); };
	return { f, c: f.componentInstance, http, el, ta, send, type };
}

describe('SaNotifyModal form', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('an empty / short message is explained under the box (button is not silently disabled) and nothing is sent', async () => {
		const { http, ta, send, type } = setup();
		expect(send.disabled).toBe(false);
		send.click(); await settleForm();
		expectFieldProblem(ta, 'مطلوب');
		expectFocused(ta);
		type('abc'); send.click(); await settleForm();
		expectFieldProblem(ta, 'قصيرة');
		http.expectNone(() => true);
	});

	it('a field-named 400 goes under the box; 429 / 500 / network stay a generic alert; double click sends one request', async () => {
		const { f, c, http, el, ta, send, type } = setup();
		type('رسالة صالحة');
		send.click(); send.click();
		const reqs = http.match((r) => r.method === 'POST');
		expect(reqs.length).toBe(1);
		reqs[0].flush({ errors: [{ field: 'message', message: 'الرسالة تحتوي محتوى غير مسموح' }] }, { status: 400, statusText: 'x' });
		await settleForm(); f.detectChanges();
		expectFieldProblem(ta, 'غير مسموح');
		expect(c.error()).toBe('');
		expect(c.message()).toBe('رسالة صالحة');
		for (const st of [429, 500, 0]) {
			type('رسالة صالحة'); send.click();
			http.expectOne((r) => r.method === 'POST').flush({ message: 'x' }, { status: st, statusText: 'x' });
			await settleForm(); f.detectChanges();
			expect(c.error(), String(st)).toBeTruthy();
			expectNoFieldProblem(el);
			expect(el.querySelector('p[role="alert"]')).toBeTruthy();
		}
	});
});
