import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OfferNegotiate } from './negotiate';
import { OffersService, OfferNegotiationState } from '../../../../../core/services/offers.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Provider negotiation page: every action is a REAL call, shown only in the states where the server allows it; errors never show success.
const OFFER = { offerId: 'offer-1', projectId: 'project-1', projectRef: '#ORD-1', projectTitle: 'تصميم هوية', clientName: 'سارة', clientType: 'INDIVIDUAL', offeredPrice: 1000, duration: '14 يوم', statusText: 'تفاوض جارٍ', createdAt: '2026-10-01T00:00:00Z' };
const STATE = (o: Partial<OfferNegotiationState> = {}): OfferNegotiationState => ({
	offerId: 'offer-1', projectId: 'project-1', status: 'UNDER_NEGOTIATION', canWithdraw: true, canCounter: true, canReject: true, counterPending: false,
	request: { messageId: 'msg-1', price: 800, deliveryDays: null, notes: 'خصم؟', clear: true, createdAt: '2026-10-02T00:00:00Z' }, counter: null, hint: null, ...o
});

describe('provider offer negotiation page', () => {
	async function setup(state: OfferNegotiationState | Error = STATE(), svc: Record<string, any> = {}) {
		const api = {
			getOfferById: vi.fn(() => of(OFFER)),
			getNegotiation: vi.fn(() => (state instanceof Error ? throwError(() => ({ error: { message: 'فشل' } })) : of(state))),
			counterOffer: vi.fn(() => of({ success: true })), rejectNegotiation: vi.fn(() => of({ success: true })), withdrawOffer: vi.fn(() => of({ success: true })), ...svc
		};
		await TestBed.configureTestingModule({ imports: [OfferNegotiate], providers: [provideRouter([]),
			{ provide: OffersService, useValue: api }, { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'offer-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(OfferNegotiate); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		return { f, c: f.componentInstance, el, api, nav, q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('under negotiation with a clear request: counter form, reject and withdraw are offered; there is NO accept button', async () => {
		const s = await setup();
		expect(s.q('neg-counter-form')).not.toBeNull();
		expect(s.q('neg-reject')).not.toBeNull();
		expect(s.q('neg-withdraw')).not.toBeNull();
		expect(s.q('neg-request')!.textContent).toContain('800');
		expect(s.el.textContent).not.toContain('قبول التفاوض');
		expect(Array.from(s.el.querySelectorAll('button')).map(b => b.textContent!.trim()).join('|')).not.toMatch(/قبول/);
		expect(s.q('neg-counter-note')!.textContent).toContain('لا يتغير السعر ولا المدة الرسمية لعرضك');
		expect(s.q('neg-counter-note')!.textContent).toContain('إلا بعد رد العميل لاحقًا');
	});

	it('SUBMITTED (no negotiation yet): only withdraw — no counter form, no reject', async () => {
		const s = await setup(STATE({ status: 'SUBMITTED', canCounter: false, canReject: false, request: null }));
		expect(s.q('neg-counter-form')).toBeNull(); expect(s.q('neg-reject')).toBeNull(); expect(s.q('neg-request')).toBeNull();
		expect(s.q('neg-withdraw')).not.toBeNull();
		expect(s.q('neg-not-active')).not.toBeNull();
	});

	it('CANCELLED: shown as withdrawn/cancelled (not rejected) and offers nothing', async () => {
		const s = await setup(STATE({ status: 'CANCELLED', canWithdraw: false, canCounter: false, canReject: false, request: null }));
		expect(s.q('neg-cancelled')!.textContent).toContain('تم سحب هذا العرض');
		expect(s.el.textContent).toContain('ملغي');
		expect(s.el.textContent).not.toContain('مرفوض');
		for (const id of ['neg-withdraw', 'neg-reject', 'neg-counter-form']) expect(s.q(id)).toBeNull();
	});

	it('free-text request: the hint is shown, reject is not offered, a counter still is', async () => {
		const s = await setup(STATE({ canReject: false, request: { messageId: 'msg-1', price: null, deliveryDays: null, notes: 'ممكن تخفيض', clear: false, createdAt: '2026-10-02T00:00:00Z' }, hint: 'اتفقوا في المحادثة ثم أرسل عرضًا مضادًا واضحًا' }));
		expect(s.q('neg-hint')!.textContent).toContain('اتفقوا في المحادثة ثم أرسل عرضًا مضادًا واضحًا');
		expect(s.q('neg-reject')).toBeNull();
		expect(s.q('neg-counter-form')).not.toBeNull();
	});

	it('a pending counter hides the form and says so', async () => {
		const s = await setup(STATE({ canCounter: false, counterPending: true, request: null, counter: { messageId: 'm2', price: 900, deliveryDays: 10, notes: '', createdAt: '2026-10-03T00:00:00Z' } }));
		expect(s.q('neg-counter-form')).toBeNull();
		expect(s.q('neg-counter-pending')!.textContent).toContain('بانتظار رد العميل');
		expect(s.el.textContent).toContain('عرضك المضاد');
	});

	it('counter form: only valid numbers can be sent; the request carries exactly price + whole days (+ note)', async () => {
		const s = await setup();
		const submit = () => s.q('neg-counter-submit') as HTMLButtonElement;
		expect(submit().disabled).toBe(true);
		for (const [price, days] of [['0', '10'], ['-5', '10'], ['abc', '10'], ['900', '0'], ['900', '2.5'], ['900', ''], ['', '10'], ['900.123', '10'], ['1e3', '10']]) {
			s.c.counterPrice.set(price); s.c.counterDays.set(days); s.f.detectChanges();
			expect(submit().disabled, `${price}/${days}`).toBe(true);
			s.c.submitCounter();
		}
		expect(s.api.counterOffer).not.toHaveBeenCalled();
		s.c.counterPrice.set('900.5'); s.c.counterDays.set('10'); s.c.counterNote.set('  ملاحظة  '); s.f.detectChanges();
		expect(submit().disabled).toBe(false);
		submit().click(); s.f.detectChanges();
		expect(s.api.counterOffer).toHaveBeenCalledWith('offer-1', { price: 900.5, deliveryDays: 10, note: 'ملاحظة' });
		expect(s.q('neg-counter-success')!.textContent).toContain('بانتظار رد العميل');
		expect(s.q('neg-counter-success')!.textContent).toContain('إلا بعد رد العميل لاحقًا');
		expect(s.api.getNegotiation).toHaveBeenCalledTimes(2); // state reloaded from the server
	});

	it('counter failure shows the server message and NO success', async () => {
		const s = await setup(STATE(), { counterOffer: vi.fn(() => throwError(() => ({ status: 409, error: { success: false, message: 'لديك عرض مضاد معلّق بانتظار رد العميل' } }))) });
		s.c.counterPrice.set('900'); s.c.counterDays.set('10'); s.f.detectChanges();
		s.c.submitCounter(); s.f.detectChanges();
		expect(s.q('neg-counter-error')!.textContent).toContain('لديك عرض مضاد معلّق');
		expect(s.q('neg-counter-success')).toBeNull();
	});

	it('reject needs an explicit confirmation, then calls the real endpoint with the request message id', async () => {
		const s = await setup();
		(s.q('neg-reject') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.api.rejectNegotiation).not.toHaveBeenCalled();
		expect(s.q('neg-reject-yes')).not.toBeNull();
		(s.q('neg-reject-no') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.q('neg-reject')).not.toBeNull();
		(s.q('neg-reject') as HTMLButtonElement).click(); s.f.detectChanges();
		(s.q('neg-reject-yes') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.api.rejectNegotiation).toHaveBeenCalledWith('offer-1', 'msg-1');
		expect(s.q('neg-done')!.textContent).toContain('يبقى عرضك بشروطه الأصلية');
	});

	it('reject failure: error shown, no "done" message', async () => {
		const s = await setup(STATE(), { rejectNegotiation: vi.fn(() => throwError(() => ({ status: 409, error: { success: false, message: 'تم الرد على هذا الطلب مسبقًا' } }))) });
		s.c.ask('reject'); s.c.confirmReject(); s.f.detectChanges();
		expect(s.q('neg-action-error')!.textContent).toContain('تم الرد على هذا الطلب مسبقًا');
		expect(s.q('neg-done')).toBeNull();
	});

	it('withdraw asks for confirmation first (and can be cancelled), then calls the real endpoint', async () => {
		const s = await setup();
		(s.q('neg-withdraw') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.q('neg-withdraw-text')!.textContent).toContain('لا يمكن التراجع');
		expect(s.api.withdrawOffer).not.toHaveBeenCalled();
		(s.q('neg-withdraw-no') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.q('neg-withdraw')).not.toBeNull();
		(s.q('neg-withdraw') as HTMLButtonElement).click(); s.f.detectChanges();
		(s.q('neg-withdraw-yes') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.api.withdrawOffer).toHaveBeenCalledWith('offer-1');
		expect(s.q('neg-done')!.textContent).toContain('تم سحب العرض');
	});

	it('withdraw failure: error shown, no "done" message', async () => {
		const s = await setup(STATE(), { withdrawOffer: vi.fn(() => throwError(() => ({ status: 409, error: { success: false, message: 'لا يمكن سحب هذا العرض في حالته الحالية' } }))) });
		s.c.ask('withdraw'); s.c.confirmWithdraw(); s.f.detectChanges();
		expect(s.q('neg-action-error')!.textContent).toContain('لا يمكن سحب هذا العرض');
		expect(s.q('neg-done')).toBeNull();
	});

	it('when the state cannot be read: a retryable error, and no action buttons are guessed', async () => {
		const s = await setup(new Error('x'));
		expect(s.q('neg-error')).not.toBeNull();
		for (const id of ['neg-withdraw', 'neg-reject', 'neg-counter-form']) expect(s.q(id)).toBeNull();
	});

	it('the project conversation button opens the PROJECT\'s chat with its real projectId', async () => {
		const s = await setup();
		s.c.openConversation();
		expect(s.nav).toHaveBeenCalledWith(['/provider-overview/messages'], { state: { messageContext: { type: 'PROJECT', projectId: 'project-1', projectTitle: 'تصميم هوية' } } });
	});

	it('no AI purple / AI icon on the negotiation page', () => {
		const html = readFileSync(join(__dirname, 'negotiate.html'), 'utf8');
		expect(html).not.toMatch(/#i-ai|ai-disc|ai-bc|ai-insight|ai-banner|txt-purple|text-purple/);
	});

	it('counter refused because the state changed (409): the reason is shown and the page re-reads the server state', async () => {
		const s = await setup(STATE(), { counterOffer: vi.fn(() => throwError(() => ({ status: 409, error: { success: false, code: 'COUNTER_PENDING_EXISTS', message: 'لديك عرض مضاد معلّق بانتظار رد العميل' } }))) });
		const calls = s.api.getNegotiation.mock.calls.length;
		s.c.counterPrice.set('700'); s.c.counterDays.set('5');
		s.c.submitCounter(); s.f.detectChanges();
		expect(s.c.counterError()).toContain('لديك عرض مضاد معلّق');
		expect(s.api.getNegotiation.mock.calls.length).toBe(calls + 1);
		expect(s.c.counterPrice()).toBe('700');
	});

	it('counter sent but the answer was lost (network): says it may have been saved, refreshes the state, keeps the entries', async () => {
		const s = await setup(STATE(), { counterOffer: vi.fn(() => throwError(() => ({ status: 0, error: null }))) });
		const calls = s.api.getNegotiation.mock.calls.length;
		s.c.counterPrice.set('700'); s.c.counterDays.set('5');
		s.c.submitCounter(); s.f.detectChanges();
		expect(s.c.counterError()).toContain('تحقق');
		expect(s.api.getNegotiation.mock.calls.length).toBe(calls + 1);
		expect(s.c.counterPrice()).toBe('700');
		expect(s.c.counterSaving()).toBe(false);
	});

	it('counter answer lost but the server DID save it: the page re-reads, says so outside the form, and no second send is offered', async () => {
		const saved = STATE({ counterPending: true, canCounter: false });
		let reads = 0;
		const s = await setup(STATE(), { counterOffer: vi.fn(() => throwError(() => ({ status: 0, error: null }))), getNegotiation: vi.fn(() => of(++reads > 1 ? saved : STATE())) });
		s.c.counterPrice.set('700'); s.c.counterDays.set('5');
		s.c.submitCounter(); s.f.detectChanges();
		expect(s.q('neg-lost-resolved')!.textContent).toContain('تم حفظ عرضك المضاد');
		expect(s.api.counterOffer).toHaveBeenCalledTimes(1);
	});
});
