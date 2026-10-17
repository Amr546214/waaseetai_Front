import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TicketDetailComponent } from './ticket-detail';
import { AuthStore } from '../../../../../core/store/auth.store';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

const T: any = { id: 't1', ticketNumber: 'T-1', subject: 'موضوع', status: 'OPEN', category: 'أخرى', priority: 'عادية', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };

describe('provider ticket detail: reply form', () => {
	let reply: ReturnType<typeof vi.fn>;
	async function mount(replyImpl: () => any = () => of({ success: true })) {
		reply = vi.fn(replyImpl);
		TestBed.configureTestingModule({
			imports: [TicketDetailComponent],
			providers: [provideRouter([]),
				{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 't1' }) } } },
				{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'me', accountType: 'PROVIDER_INDIVIDUAL' }) } },
				{ provide: TicketApiService, useValue: { getTicket: () => of({ success: true, data: { ticket: T, messages: [] } }), replyToTicket: reply, closeTicket: vi.fn() } }],
		});
		(Element.prototype as any).scrollIntoView = vi.fn();
		const f = TestBed.createComponent(TicketDetailComponent);
		const err = vi.spyOn(TestBed.inject(UiNotificationService), 'error');
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, err, ta: () => el.querySelector('#td-reply') as HTMLTextAreaElement, send: () => el.querySelector('.tkm-send') as HTMLButtonElement };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('empty reply: message at the textarea (aria-invalid + role=alert), focus there, no request', async () => {
		const m = await mount();
		m.send().click(); await settleForm(); m.f.detectChanges();
		expect(reply).not.toHaveBeenCalled();
		expectFocused(m.ta());
		expectFieldProblem(m.ta(), 'اكتب ردّك');
	});

	it('backend 422 naming the body lands at the textarea and keeps the typed text', async () => {
		const m = await mount(() => throwError(() => httpFail(422, { errors: [{ field: 'body', message: 'الرد طويل جدًا' }] })));
		m.c.replyText.set('ردي'); m.f.detectChanges();
		m.send().click(); await settleForm(); m.f.detectChanges();
		expectFieldProblem(m.ta(), 'الرد طويل جدًا');
		expectFocused(m.ta());
		expect(m.c.replyText()).toBe('ردي');
		expect(m.err).not.toHaveBeenCalled();
	});

	it('429 / network stay one generic toast and mark no field', async () => {
		for (const status of [429, 0]) {
			const m = await mount(() => throwError(() => httpFail(status, null)));
			m.c.replyText.set('ردي'); m.f.detectChanges();
			m.send().click(); await settleForm(); m.f.detectChanges();
			expect(m.err).toHaveBeenCalledTimes(1);
			expectNoFieldProblem(m.el);
			TestBed.resetTestingModule();
		}
	});

	it('double click sends ONE request and disables the button', async () => {
		const pending = new Subject<any>();
		const m = await mount(() => pending);
		m.c.replyText.set('ردي'); m.f.detectChanges();
		m.send().click(); m.send().click(); void m.c.sendReply();
		await settleForm(); m.f.detectChanges();
		expect(reply).toHaveBeenCalledTimes(1);
		expect(m.send().disabled).toBe(true);
		pending.next({ success: true }); pending.complete();
	});
});
