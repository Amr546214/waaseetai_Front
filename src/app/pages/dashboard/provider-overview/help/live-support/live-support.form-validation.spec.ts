import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { LiveSupportComponent } from './live-support';
import { AuthStore } from '../../../../../core/store/auth.store';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

const TICKET: any = { id: 't1', userId: 'me', ticketNumber: 'T-1', subject: 'موضوع', status: 'OPEN' };

describe('provider live support: composer and reply forms', () => {
	let create: ReturnType<typeof vi.fn>;
	let reply: ReturnType<typeof vi.fn>;
	async function mount(over: { create?: () => any; reply?: () => any } = {}) {
		create = vi.fn(over.create ?? (() => of({ data: TICKET })));
		reply = vi.fn(over.reply ?? (() => of({ data: { id: 'm1', senderId: 'me', body: 'x', createdAt: '2026-10-01T00:00:00Z' } })));
		TestBed.configureTestingModule({
			imports: [LiveSupportComponent],
			providers: [provideRouter([]),
				{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'me', accountType: 'PROVIDER_INDIVIDUAL' }) } },
				{ provide: TicketApiService, useValue: { listTickets: () => of({ data: { items: [TICKET] } }), getTicket: () => of({ data: { ticket: TICKET, messages: [] } }), createTicket: create, replyToTicket: reply, closeTicket: vi.fn() } }],
		});
		(Element.prototype as any).scrollIntoView = vi.fn();
		const f = TestBed.createComponent(LiveSupportComponent);
		const notify = TestBed.inject(UiNotificationService);
		const err = vi.spyOn(notify, 'error');
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement, err };
	}
	afterEach(() => TestBed.resetTestingModule());

	async function openComposer(m: Awaited<ReturnType<typeof mount>>) {
		m.c.startNew(); m.f.detectChanges(); await m.f.whenStable(); m.f.detectChanges();
	}
	const submitBtn = (m: Awaited<ReturnType<typeof mount>>) => m.el.querySelector('form.lv-composer button[type=submit]') as HTMLButtonElement;

	it('new ticket, empty submit: subject, category and description are each marked, focus on the subject, no request, no toast-only warning', async () => {
		const m = await mount();
		const warn = vi.spyOn(TestBed.inject(UiNotificationService), 'warning');
		await openComposer(m);
		submitBtn(m).click(); await settleForm(); m.f.detectChanges();
		expect(create).not.toHaveBeenCalled();
		const subj = m.el.querySelector('#ls-subject') as HTMLElement;
		expectFocused(subj);
		expectFieldProblem(subj, 'أدخل عنوان التذكرة');
		expectFieldProblem(m.el.querySelector('ws-select[name=category] button'), 'اختر التصنيف');
		expectFieldProblem(m.el.querySelector('#ls-description'), 'صف مشكلتك');
		expect(warn).not.toHaveBeenCalled();
	});

	it('short texts keep what was typed and say how many characters are needed', async () => {
		const m = await mount();
		await openComposer(m);
		m.c.newSubject.set('عنوان طويل كفاية'); m.c.newCategory.set('مشكلة تقنية'); m.c.newDescription.set('قصير'); m.f.detectChanges();
		submitBtn(m).click(); await settleForm(); m.f.detectChanges();
		expectFocused(m.el.querySelector('#ls-description'));
		expectFieldProblem(m.el.querySelector('#ls-description'), '20');
		expect(m.c.newSubject()).toBe('عنوان طويل كفاية');
	});

	const fill = (m: Awaited<ReturnType<typeof mount>>) => { m.c.newSubject.set('عنوان صالح'); m.c.newCategory.set('مشكلة تقنية'); m.c.newDescription.set('وصف تفصيلي كافٍ للمشكلة التقنية'); m.f.detectChanges(); };

	it('backend 422 naming the description lands at the description field', async () => {
		const m = await mount({ create: () => throwError(() => httpFail(422, { errors: [{ field: 'description', message: 'الوصف يحتوي على محتوى غير مسموح' }] })) });
		await openComposer(m); fill(m);
		submitBtn(m).click(); await settleForm(); m.f.detectChanges();
		expectFieldProblem(m.el.querySelector('#ls-description'), 'غير مسموح');
		expectFocused(m.el.querySelector('#ls-description'));
		expect(m.err).not.toHaveBeenCalled();
		expect(m.c.newSubject()).toBe('عنوان صالح');
	});

	it('429 / network / 500 stay one generic toast and mark no field', async () => {
		for (const status of [429, 0, 500]) {
			const m = await mount({ create: () => throwError(() => httpFail(status, null)) });
			await openComposer(m); fill(m);
			submitBtn(m).click(); await settleForm(); m.f.detectChanges();
			expect(m.err).toHaveBeenCalledTimes(1);
			expectNoFieldProblem(m.el);
			TestBed.resetTestingModule();
		}
	});

	it('double click on "إرسال التذكرة" sends ONE request', async () => {
		const pending = new Subject<any>();
		const m = await mount({ create: () => pending });
		await openComposer(m); fill(m);
		submitBtn(m).click(); submitBtn(m).click(); void m.c.submitNew();
		await settleForm(); m.f.detectChanges();
		expect(create).toHaveBeenCalledTimes(1);
		expect(submitBtn(m).disabled).toBe(true);
		pending.next({ data: TICKET }); pending.complete();
	});

	async function openThread(m: Awaited<ReturnType<typeof mount>>) {
		m.c.openTicket(TICKET); m.f.detectChanges(); await m.f.whenStable(); m.f.detectChanges();
	}

	it('reply: an empty reply is explained at the textarea (not silently ignored) and focuses it', async () => {
		const m = await mount();
		await openThread(m);
		(m.el.querySelector('form.lv-input-row button[type=submit]') as HTMLButtonElement).click(); await settleForm(); m.f.detectChanges();
		expect(reply).not.toHaveBeenCalled();
		expectFocused(m.el.querySelector('#ls-msg'));
		expectFieldProblem(m.el.querySelector('#ls-msg'), 'اكتب ردك');
	});

	it('reply: double click sends ONE request; 429 stays generic', async () => {
		const pending = new Subject<any>();
		const m = await mount({ reply: () => pending });
		await openThread(m);
		m.c.inputText.set('رد'); m.f.detectChanges();
		const btn = m.el.querySelector('form.lv-input-row button[type=submit]') as HTMLButtonElement;
		btn.click(); btn.click(); void m.c.send();
		await settleForm();
		expect(reply).toHaveBeenCalledTimes(1);
		pending.error(httpFail(429, null));
		await settleForm(); m.f.detectChanges();
		expect(m.err).toHaveBeenCalledTimes(1);
		expectNoFieldProblem(m.el);
	});
});
