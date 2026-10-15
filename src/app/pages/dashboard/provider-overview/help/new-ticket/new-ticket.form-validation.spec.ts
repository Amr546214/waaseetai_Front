import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NewTicketComponent } from './new-ticket';
import { AuthStore } from '../../../../../core/store/auth.store';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

describe('provider new ticket: invalid submit, backend errors, double submit', () => {
	let create: ReturnType<typeof vi.fn>;
	const long = 'وصف تفصيلي كافٍ لمشكلة السحب في المحفظة';

	async function mount(createImpl: () => any = () => of({ success: true, data: { id: 't1' } })) {
		create = vi.fn(createImpl);
		TestBed.configureTestingModule({
			imports: [NewTicketComponent],
			providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } }, { provide: TicketApiService, useValue: { createTicket: create } }],
		});
		const f = TestBed.createComponent(NewTicketComponent);
		(Element.prototype as any).scrollIntoView = vi.fn();
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const notify = TestBed.inject(UiNotificationService);
		const err = vi.spyOn(notify, 'error');
		const submitBtn = () => el.querySelector('button[type=submit]') as HTMLButtonElement;
		const pickCategory = async () => {
			(el.querySelector('ws-select#tk-cat button') as HTMLButtonElement).click(); f.detectChanges();
			(el.querySelectorAll('[data-testid=ws-select-option]')[0] as HTMLElement).click(); f.detectChanges(); await f.whenStable();
		};
		return { f, c: f.componentInstance, el, notify, err, submitBtn, pickCategory };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('empty submit: every field is red with its own message, focus is on the first (the category trigger), no request, typed text is kept', async () => {
		const { f, c, el, submitBtn } = await mount();
		c.description.set('قصير');
		f.detectChanges();
		submitBtn().click();
		await settleForm(); f.detectChanges();
		expect(create).not.toHaveBeenCalled();
		const catBtn = el.querySelector('ws-select#tk-cat button') as HTMLElement;
		expectFocused(catBtn);
		expectFieldProblem(catBtn, 'اختر التصنيف');
		expectFieldProblem(el.querySelector('#tk-subj'), 'أدخل عنوان التذكرة');
		expectFieldProblem(el.querySelector('#tk-desc'), 'قصير جدًا');
		expect(c.description()).toBe('قصير');
		expect((el.querySelector('#tk-desc') as HTMLTextAreaElement).value).toBe('قصير');
	});

	it('typing in a marked field removes its mark; picking a category removes the category mark', async () => {
		const { f, el, submitBtn, pickCategory } = await mount();
		submitBtn().click(); await settleForm(); f.detectChanges();
		const subj = el.querySelector('#tk-subj') as HTMLInputElement;
		expect(subj.getAttribute('aria-invalid')).toBe('true');
		subj.value = 'عنوان صالح'; subj.dispatchEvent(new Event('input')); f.detectChanges();
		expect(subj.getAttribute('aria-invalid')).toBeNull();
		await pickCategory();
		expect((el.querySelector('ws-select#tk-cat button') as HTMLElement).getAttribute('aria-invalid')).toBeNull();
	});

	it('with a category but a too short subject, the subject is the first invalid field and has focus', async () => {
		const { f, c, el, submitBtn, pickCategory } = await mount();
		await pickCategory();
		c.subject.set('abc'); c.description.set(long); f.detectChanges();
		submitBtn().click(); await settleForm(); f.detectChanges();
		expectFocused(el.querySelector('#tk-subj'));
		expectFieldProblem(el.querySelector('#tk-subj'), '5');
		expect(el.querySelector('#tk-desc')!.getAttribute('aria-invalid')).toBeNull();
	});

	async function validDraft(m: Awaited<ReturnType<typeof mount>>) {
		await m.pickCategory();
		m.c.subject.set('مشكلة في السحب'); m.c.description.set(long); m.f.detectChanges();
	}

	it('backend 422 naming the subject lands at the subject field (focused), not in a toast', async () => {
		const m = await mount(() => throwError(() => httpFail(422, { errors: [{ field: 'subject', message: 'العنوان مكرر، اختر عنوانًا مختلفًا' }] })));
		await validDraft(m);
		m.submitBtn().click(); await settleForm(); m.f.detectChanges();
		expect(create).toHaveBeenCalledTimes(1);
		const subj = m.el.querySelector('#tk-subj') as HTMLElement;
		expectFieldProblem(subj, 'العنوان مكرر');
		expectFocused(subj);
		expect(m.err).not.toHaveBeenCalled();
		expect(m.c.submitting()).toBe(false);
		expect(m.c.description()).toBe(long);
	});

	it('429 stays one generic message and marks no field', async () => {
		const m = await mount(() => throwError(() => httpFail(429, { message: 'Too many requests, try again after 15 minutes' })));
		await validDraft(m);
		m.submitBtn().click(); await settleForm(); m.f.detectChanges();
		expect(m.err).toHaveBeenCalledTimes(1);
		expect(String(m.err.mock.calls[0][0])).toContain('تجاوزت عدد المحاولات');
		expectNoFieldProblem(m.el);
	});

	it('network failure and 500 also stay generic, never a field mark', async () => {
		for (const status of [0, 500]) {
			const m = await mount(() => throwError(() => httpFail(status, null)));
			await validDraft(m);
			m.submitBtn().click(); await settleForm(); m.f.detectChanges();
			expect(m.err).toHaveBeenCalledTimes(1);
			expectNoFieldProblem(m.el);
			TestBed.resetTestingModule();
		}
	});

	it('double click while the request is in flight sends ONE request and disables the button', async () => {
		const pending = new Subject<any>();
		const m = await mount(() => pending);
		await validDraft(m);
		m.submitBtn().click(); m.submitBtn().click(); m.c.submit();
		await settleForm(); m.f.detectChanges();
		expect(create).toHaveBeenCalledTimes(1);
		expect(m.submitBtn().disabled).toBe(true);
		pending.next({ success: true, data: { id: 't1' } }); pending.complete();
	});
});
