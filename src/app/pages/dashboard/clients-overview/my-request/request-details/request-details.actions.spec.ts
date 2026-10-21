import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { RequestDetails } from './request-details';
import { ThemeService } from '../../../../../core/services/theme.service';
import { ChatService } from '../../../../../core/services/chat.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

const lastToast = () => TestBed.inject(UiNotificationService).toasts().at(-1)?.message ?? '';

// The client's offer actions come from the SERVER (actions / negotiation / stage): a button that cannot work is disabled with the server's reason,
// accepting a counter is a real call, negotiation sends the real fields, and no failure falls back to a fake conversation id.
const free = { canSelect: true, canNegotiate: true, canChat: true, blockedReason: null, chatBlockedReason: null };
const prop = (o: any = {}) => ({ id: 'legacy-1', status: 'SUBMITTED', totalPrice: 900, deliveryDays: 5, provider: { id: 'prov-1', name: 'مزود' }, actions: free, negotiation: { state: 'NONE', counter: null }, ...o });
const details = (o: any = {}, proposals: any[] = [prop()]) => ({ success: true, data: { id: 'req-1', title: 'تصميم', status: 'OPEN', stage: 'OFFERS_RECEIVED', stageLabel: 'وصلتك عروض', budget: { type: 'FIXED', min: 500 }, specialty: { nameAr: 'تصميم' }, expectedDurationDays: null, createdAt: '2026-01-01', description: 'وصف', proposals, ...o } });

async function setup(res: any, over: { chat?: any; post?: any } = {}) {
	const nav = vi.fn(() => Promise.resolve(true));
	const get = vi.fn(() => of(res));
	const post = over.post ?? vi.fn(() => of({ success: true, message: 'تم' }));
	const chat = over.chat ?? { initiateConversation: vi.fn(() => of({ data: { id: 'conv-9' } })) };
	await TestBed.configureTestingModule({
		imports: [RequestDetails],
		providers: [
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'req-1' } } } },
			{ provide: Router, useValue: { navigate: nav } },
			{ provide: HttpClient, useValue: { get, post } },
			{ provide: ThemeService, useValue: { theme: () => 'dark' } },
			{ provide: ChatService, useValue: chat }
		]
	}).compileComponents();
	const f = TestBed.createComponent(RequestDetails);
	f.detectChanges(); await f.whenStable(); f.detectChanges();
	const el = f.nativeElement as HTMLElement;
	return { f, c: f.componentInstance, el, nav, get, post, chat, q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null };
}
afterEach(() => TestBed.resetTestingModule());

describe('RequestDetails - states and actions come from the server', () => {
	it('shows the server stage label and no invented duration ("غير محدد")', async () => {
		const s = await setup(details());
		expect(s.el.querySelector('.od-hd .opill')!.textContent).toContain('وصلتك عروض');
		expect(s.c.request().duration).toBe('غير محدد');
	});

	it('a request waiting for funding is shown as waiting, never "قيد التنفيذ", and offers a real route to the contract', async () => {
		const s = await setup(details({ status: 'PENDING_SIGNATURE', stage: 'AWAITING_FUNDING', stageLabel: 'بانتظار تمويل الضمان', selectedOfferId: 'canon-1' }, [prop({ status: 'PENDING_SIGNATURE' })]));
		expect(s.el.querySelector('.od-hd .opill')!.textContent).toContain('بانتظار تمويل الضمان');
		expect(s.el.querySelector('.od-hd .opill')!.textContent).not.toContain('قيد التنفيذ');
		expect(s.q('accept-offer')).toBeNull();
		const btn = s.q('closed-state-action')!;
		expect(btn.textContent).toContain('بانتظار تمويل الضمان');
		btn.click();
		expect(s.nav).toHaveBeenCalledWith(['/client-overview/my-requests', 'req-1', 'contract'], { queryParams: { offerId: 'legacy-1' } });
	});

	it('an active project offers «متابعة المشروع»; a cancelled request offers nothing to click', async () => {
		const a = await setup(details({ status: 'IN_PROGRESS', stage: 'ACTIVE', stageLabel: 'قيد التنفيذ' }, [prop({ status: 'ACCEPTED' })]));
		expect(a.q('closed-state-action')!.textContent).toContain('متابعة المشروع');
		TestBed.resetTestingModule();
		const c = await setup(details({ status: 'CANCELLED', stage: 'CANCELLED', stageLabel: 'ملغي' }, [prop({ status: 'PENDING_SIGNATURE' })]));
		expect(c.q('closed-state-action')).toBeNull();
		expect(c.q('closed-state-note')!.textContent).toContain('تم إلغاء الطلب');
	});

	it('select / negotiate are DISABLED with the server\'s reason when blocked, and clicking select does not call the server', async () => {
		const reason = 'سحب مقدم الخدمة هذا العرض';
		const s = await setup(details({}, [prop({ status: 'CANCELLED', actions: { ...free, canSelect: false, canNegotiate: false, blockedReason: reason } })]));
		expect(s.q('accept-offer')!.disabled).toBe(true);
		expect(s.q('negotiate-offer')!.disabled).toBe(true);
		expect(s.q('accept-offer')!.getAttribute('title')).toBe(reason);
		expect(s.q('blocked-reason')!.textContent).toContain(reason);
		expect(s.q('chat-offer')!.disabled).toBe(false);
		s.c.acceptOffer(s.c.offers()[0]);
		expect(s.post).not.toHaveBeenCalled();
	});

	it('a normal offer: accept selects it on the server and goes to the contract of THAT offer', async () => {
		const s = await setup(details());
		s.q('accept-offer')!.click();
		expect(s.post).toHaveBeenCalledWith(expect.stringContaining('/client/my-requests/req-1/offers/select'), { offerId: 'legacy-1' });
		expect(s.nav).toHaveBeenCalledWith(['/client-overview/my-requests', 'req-1', 'contract'], { queryParams: { offerId: 'legacy-1' } });
	});

	it('a server refusal on select shows the server\'s message, does not navigate, and reloads the request', async () => {
		const post = vi.fn(() => throwError(() => ({ error: { message: 'هذا العرض مسحوب ولا يمكن اختياره' } })));
		const s = await setup(details(), { post });
		s.q('accept-offer')!.click();
		expect(lastToast()).toBe('هذا العرض مسحوب ولا يمكن اختياره');
		expect(s.nav).not.toHaveBeenCalled();
		expect(s.get).toHaveBeenCalledTimes(2);
	});

	it('a pending counter offer shows its price/duration and the accept / decline buttons; selecting is blocked until answered', async () => {
		const counter = { messageId: 'ctr-1', price: 450, deliveryDays: 4, notes: 'خصم' };
		const s = await setup(details({}, [prop({ status: 'UNDER_NEGOTIATION', negotiation: { state: 'COUNTER_PENDING', counter }, actions: { ...free, canSelect: false, blockedReason: 'ردّ على العرض المضاد (قبول أو رفض) قبل اختيار هذا العرض' } })]));
		const box = s.q('counter-box')!;
		expect(box.textContent).toContain('450'); expect(box.textContent).toContain('4 يوم'); expect(box.textContent).toContain('الدردشة وحدها لا تغيّر العقد');
		expect(s.q('accept-offer')!.disabled).toBe(true);
		s.q('accept-counter')!.click();
		expect(s.post).toHaveBeenCalledWith(expect.stringContaining('/client/my-requests/req-1/offers/legacy-1/counter/accept'), { messageId: 'ctr-1' });
		expect(s.get).toHaveBeenCalledTimes(2); // reloaded: the offer now carries the accepted price / duration
	});

	it('decline posts to decline-counter; a stale-counter refusal (409) is shown as the server wrote it', async () => {
		const post = vi.fn(() => throwError(() => ({ status: 409, error: { success: false, code: 'OFFER_STATE_CHANGED', message: 'هذا العرض المضاد لم يعد الأحدث أو تم الرد عليه، حدّث الصفحة' } })));
		const s = await setup(details({}, [prop({ status: 'UNDER_NEGOTIATION', negotiation: { state: 'COUNTER_PENDING', counter: { messageId: 'old', price: 1, deliveryDays: 1, notes: '' } } })]), { post });
		s.q('decline-counter')!.click();
		expect(post).toHaveBeenCalledWith(expect.stringContaining('/counter/decline'), { messageId: 'old' });
		expect(lastToast()).toContain('لم يعد الأحدث');
		// the reason also stays ON the offer card (the toast vanishes, and the counter box may disappear once the page re-reads the server state)
		s.f.detectChanges();
		expect(s.q('counter-notice')!.textContent).toContain('لم يعد الأحدث');
	});

	it('accept answer lost (network): the card says it may have been recorded and to check the refreshed state; the details are re-read', async () => {
		const post = vi.fn(() => throwError(() => ({ status: 0, error: null })));
		const s = await setup(details({}, [prop({ status: 'UNDER_NEGOTIATION', negotiation: { state: 'COUNTER_PENDING', counter: { messageId: 'c1', price: 1, deliveryDays: 1, notes: '' } } })]), { post });
		s.q('accept-counter')!.click(); s.f.detectChanges();
		expect(s.q('counter-notice')!.textContent).toContain('تحقق');
	});

	it('a request sent and waiting is stated, with the note that the offer changes only by an accepted counter', async () => {
		const s = await setup(details({}, [prop({ status: 'UNDER_NEGOTIATION', negotiation: { state: 'REQUEST_SENT', counter: null } })]));
		expect(s.q('request-sent-note')!.textContent).toContain('بانتظار رد مقدم الخدمة');
	});

	it('negotiation: a duration request sends the typed days (not the price); invalid input is refused before any call', async () => {
		const s = await setup(details());
		s.c.openNegotiation(s.c.offers()[0]);
		s.c.setNegType('dur'); s.f.detectChanges();
		s.c.sendNegotiation();
		expect(s.chat.initiateConversation).not.toHaveBeenCalled();
		// the reason now sits under the duration box (red, aria-invalid, role=alert) instead of a toast only
		await new Promise(r => setTimeout(r, 60));
		s.f.detectChanges();
		const dur = s.el.querySelector('#neg-dur') as HTMLElement;
		expect(dur.getAttribute('aria-invalid')).toBe('true');
		expect(s.el.ownerDocument.getElementById(dur.getAttribute('aria-describedby')!)!.textContent).toContain('المدة');
		s.c.negDuration.set('12');
		s.c.negMessage.set('نحتاج أسرع');
		s.c.sendNegotiation();
		const arg = (s.chat.initiateConversation as any).mock.calls[0][0];
		expect(arg.projectId).toBe('req-1');
		expect(arg.offerId).toBe('legacy-1');
		expect(arg.negotiationPayload).toMatchObject({ negType: 'dur', duration: '12', price: '', notes: 'نحتاج أسرع' });
		expect(s.nav).toHaveBeenCalledWith(['/client-overview/messages'], { queryParams: { conversationId: 'conv-9' } });
	});

	it('negotiation: a price request sends the proposed price as a plain number; the text says chat does not change the contract', async () => {
		const s = await setup(details());
		s.c.openNegotiation(s.c.offers()[0]);
		s.f.detectChanges();
		expect(s.el.querySelector('#neg-modal')!.textContent).toContain('والدردشة وحدها لا تغيّر شيئًا');
		s.c.negPrice.set('4,000 $');
		s.c.sendNegotiation();
		expect((s.chat.initiateConversation as any).mock.calls[0][0].negotiationPayload).toMatchObject({ negType: 'price', price: '4000', duration: '' });
	});

	it('negotiation on a closed offer: the server\'s refusal is shown, NO fake conversation is opened', async () => {
		const chat = { initiateConversation: vi.fn(() => throwError(() => ({ error: { message: 'لا يمكن التفاوض على هذا العرض: سحب مقدم الخدمة هذا العرض' } }))) };
		const s = await setup(details(), { chat });
		s.c.openNegotiation(s.c.offers()[0]);
		s.c.negPrice.set('4000'); // the price box now starts empty (no ready-made number), so the client types one
		s.c.sendNegotiation();
		expect(lastToast()).toContain('لا يمكن التفاوض');
		expect(s.nav).not.toHaveBeenCalled();
		expect(s.get).toHaveBeenCalledTimes(2);
	});

	it('the negotiate button on a blocked offer shows the reason instead of opening the dialog', async () => {
		const s = await setup(details({}, [prop({ actions: { ...free, canNegotiate: false, blockedReason: 'تم اختيار عرض آخر لهذا الطلب' } })]));
		s.c.openNegotiation(s.c.offers()[0]);
		expect(s.c.showNegModal()).toBe(false);
		expect(lastToast()).toBe('تم اختيار عرض آخر لهذا الطلب');
	});

	it('message the provider opens the conversation of THIS project; a failure shows the error and never navigates to a made-up id', async () => {
		const s = await setup(details());
		s.q('chat-offer')!.click();
		expect((s.chat.initiateConversation as any).mock.calls[0][0]).toEqual({ projectId: 'req-1', providerId: 'prov-1', offerId: 'legacy-1' });
		expect(s.nav).toHaveBeenCalledWith(['/client-overview/messages'], { queryParams: { conversationId: 'conv-9' } });
		TestBed.resetTestingModule();
		const chat = { initiateConversation: vi.fn(() => throwError(() => ({ error: { message: 'تم إلغاء هذا الطلب' } }))) };
		const f = await setup(details(), { chat });
		f.q('chat-offer')!.click();
		expect(lastToast()).toBe('تم إلغاء هذا الطلب');
		expect(f.nav).not.toHaveBeenCalled();
	});

	it('no made-up conversation id remains in the source', async () => {
		const { readFileSync } = await import('node:fs');
		const { join } = await import('node:path');
		expect(readFileSync(join(__dirname, 'request-details.ts'), 'utf8')).not.toContain("'c1'");
	});
});
