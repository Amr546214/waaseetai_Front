import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { ReportProblemComponent } from './report-problem.component';
import { AuthStore } from '../../../../core/store/auth.store';
import { TicketApiService } from '../../../../core/services/ticket-api.service';

// /support/report-problem used to fake "تم استلام بلاغك" with a setTimeout, promise an email and count attachments only. It now saves a real ticket.
function setup(opts: { loggedIn: boolean; create?: any }) {
	const createTicket = vi.fn(opts.create ?? (() => of({ success: true, data: { ticketNumber: 'T-2026-001' } })));
	TestBed.configureTestingModule({
		imports: [ReportProblemComponent],
		providers: [provideRouter([]),
			{ provide: AuthStore, useValue: { isAuthenticated: signal(opts.loggedIn), actingRole: signal('CLIENT') } },
			{ provide: TicketApiService, useValue: { createTicket } }],
	});
	const f = TestBed.createComponent(ReportProblemComponent); f.detectChanges();
	const c: any = f.componentInstance;
	c.reportForm.patchValue({ category: 'technical', name: 'س', email: 'a@b.co', subject: 'الصفحة لا تعمل', description: 'تفاصيل المشكلة كاملة وأكثر من عشرين حرفا' });
	return { f, c, createTicket, el: f.nativeElement as HTMLElement };
}

describe('report-problem wiring', () => {
	it('signed out: nothing is sent, no success, a sign-in requirement is shown', () => {
		const { f, c, createTicket, el } = setup({ loggedIn: false });
		c.onSubmit(); f.detectChanges();
		expect(createTicket).not.toHaveBeenCalled();
		expect(c.submitted).toBe(false);
		expect(el.querySelector('[data-testid="rp-login-required"]')).toBeTruthy();
	});
	it('signed in: success only after the server confirms a ticket number, which is shown; no email promise', () => {
		const { f, c, createTicket, el } = setup({ loggedIn: true });
		c.onSubmit(); f.detectChanges();
		expect(createTicket).toHaveBeenCalledTimes(1);
		expect(createTicket.mock.calls[0][1]).toMatchObject({ category: 'مشكلة تقنية', subject: 'الصفحة لا تعمل' });
		expect(c.submitted).toBe(true);
		expect(el.querySelector('[data-testid="rp-ticket-number"]')?.textContent).toContain('T-2026-001');
		expect(el.textContent).not.toContain('سيصلك بريد');
	});
	it('a lost reply keeps the inputs, blocks a second send and points to the tickets list', () => {
		const { f, c, createTicket, el } = setup({ loggedIn: true, create: () => throwError(() => ({ status: 0 })) });
		c.onSubmit(); f.detectChanges();
		expect(c.submitted).toBe(false);
		expect(c.reportForm.value.subject).toBe('الصفحة لا تعمل');
		expect(c.outcomeUnknown).toBe(true);
		expect(el.querySelector('[data-testid="rp-send-error"]')).toBeTruthy();
		c.onSubmit();
		expect(createTicket).toHaveBeenCalledTimes(1);
	});
	it('a validation refusal (400) shows beside the button, nothing was saved, retry allowed', () => {
		const { f, c, el } = setup({ loggedIn: true, create: () => throwError(() => ({ status: 400, error: { message: 'الوصف قصير جدًا، أضف تفاصيل أكثر' } })) });
		c.onSubmit(); f.detectChanges();
		expect(el.querySelector('[data-testid="rp-send-error"]')?.textContent).toContain('الوصف قصير');
		expect(c.outcomeUnknown).toBe(false);
	});
	it('a 500 is treated as unconfirmed: a second send is blocked until the tickets are checked', () => {
		const { c } = setup({ loggedIn: true, create: () => throwError(() => ({ status: 500, error: {} })) });
		c.onSubmit();
		expect(c.outcomeUnknown).toBe(true);
	});
	it('the attachment zone no longer pretends to upload', () => {
		const { el } = setup({ loggedIn: true });
		expect(el.querySelector('input[type="file"]')).toBeNull();
		expect(el.querySelector('[data-testid="rp-attach-note"]')).toBeTruthy();
	});
});
