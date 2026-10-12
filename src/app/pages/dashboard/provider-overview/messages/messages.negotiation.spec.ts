import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProviderMessages } from './messages';
import { ChatService } from '../../../../core/services/chat.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { ChatStateService } from '../../../../core/services/chat-state.service';
import { VideoCallService } from '../../../../core/services/video-call.service';
import { OffersService, OfferNegotiationState } from '../../../../core/services/offers.service';

// The negotiation card in the provider's chat is driven ONLY by the server: nothing is "accepted" / "rejected" / locked in the browser.
const NEG = 'WS_NEGOTIATION::';
const clientCard = (o: object) => NEG + JSON.stringify({ isNegotiation: true, negType: 'price', negTypeName: 'السعر', price: '800', notes: 'خصم؟', status: 'PENDING', ...o });
const MSGS = (extra: any[] = []) => ({ success: true, data: [{ id: 'msg-1', senderId: 'client-1', content: clientCard({}), type: 'TEXT' }, ...extra] });
const STATE = (o: Partial<OfferNegotiationState> = {}): OfferNegotiationState => ({
	offerId: 'offer-1', projectId: 'p1', status: 'UNDER_NEGOTIATION', canWithdraw: true, canCounter: true, canReject: true, counterPending: false,
	request: { messageId: 'msg-1', price: 800, deliveryDays: null, notes: 'خصم؟', clear: true, createdAt: '2026-10-02T00:00:00Z' }, counter: null, hint: null, ...o
});

describe('provider messages: negotiation card is real', () => {
	async function render(opts: { messages?: any; state?: OfferNegotiationState | null; reject?: any } = {}) {
		window.history.replaceState({ messageContext: { type: 'PROJECT', projectId: 'p1', projectTitle: 'مشروع' } }, '');
		const getMessages = vi.fn(() => of(opts.messages ?? MSGS()));
		const offers = {
			getNegotiationByProject: vi.fn(() => (opts.state === null ? throwError(() => ({ status: 500 })) : of(opts.state ?? STATE()))),
			rejectNegotiation: vi.fn(() => opts.reject ?? of({ success: true }))
		};
		await TestBed.configureTestingModule({ imports: [ProviderMessages], providers: [provideRouter([]),
			{ provide: ChatService, useValue: { connect: () => {}, getConversations: () => of({ success: true, data: [{ id: 'c1', projectId: 'p1', name: 'سارة', project: 'مشروع', participants: [], lastMessage: null }] }), getMessages, joinRoom: () => {}, leaveRoom: () => {}, markAsRead: () => {}, sendMessage: vi.fn(), emitTyping: () => {}, newMessage$: new Subject<any>(), typingIndicator$: new Subject<any>(), isRecording: signal(false), recordingTime: signal(0) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'prov-1', accountType: 'PROVIDER_INDIVIDUAL' }), token: () => null } },
			{ provide: ChatStateService, useValue: { activeConversationId: { set: () => {} }, markAsRead: () => {} } },
			{ provide: VideoCallService, useValue: { startCall: () => {} } },
			{ provide: OffersService, useValue: offers },
			{ provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} }, queryParams: new BehaviorSubject({}).asObservable() } }] }).compileComponents();
		const f = TestBed.createComponent(ProviderMessages); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		return { f, c: f.componentInstance, el, offers, getMessages, nav, q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
	}
	afterEach(() => { TestBed.resetTestingModule(); window.history.replaceState({}, ''); });

	it('there is no local accept/reject left: no "قبول التفاوض", no respondNegotiation, no browser-side lock', () => {
		const html = readFileSync(join(__dirname, 'messages.html'), 'utf8');
		const ts = readFileSync(join(__dirname, 'messages.ts'), 'utf8');
		expect(html).not.toContain('قبول التفاوض');
		expect(html).not.toContain('respondNegotiation');
		expect(ts).not.toContain('respondNegotiation');
		expect(ts).not.toContain('negStatus');
		expect(ts).not.toMatch(/تم قبول طلب التفاوض|تم اعتماد الشروط/);
	});

	it('an open clear request shows "waiting for you" with REAL reject + counter actions and no accept', async () => {
		const s = await render();
		expect(s.offers.getNegotiationByProject).toHaveBeenCalledWith('p1');
		expect(s.q('neg-open-badge')).not.toBeNull();
		expect(s.q('neg-card-reject')).not.toBeNull();
		expect(s.q('neg-card-counter')).not.toBeNull();
		expect(s.el.textContent).not.toContain('قبول');
	});

	it('reject: confirmation first (nothing sent), then the real endpoint with the card\'s message id, then the history reloads', async () => {
		const s = await render();
		(s.q('neg-card-reject') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.offers.rejectNegotiation).not.toHaveBeenCalled();
		(s.q('neg-card-reject-yes') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.offers.rejectNegotiation).toHaveBeenCalledWith('offer-1', 'msg-1');
		expect(s.getMessages).toHaveBeenCalledTimes(2); // the structured reply is read back from the server
	});

	it('reject failure: the server message is shown, nothing is marked as decided', async () => {
		const s = await render({ reject: throwError(() => ({ error: { message: 'تم الرد على هذا الطلب مسبقًا أو توجد رسالة تفاوض أحدث' } })) });
		(s.q('neg-card-reject') as HTMLButtonElement).click(); s.f.detectChanges();
		(s.q('neg-card-reject-yes') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.q('neg-card-error')!.textContent).toContain('تم الرد على هذا الطلب مسبقًا');
		expect(s.q('neg-open-badge')).not.toBeNull(); // still open
		expect(s.getMessages).toHaveBeenCalledTimes(1);
	});

	it('a free-text request shows the server hint and offers no reject', async () => {
		const s = await render({ messages: { success: true, data: [{ id: 'msg-1', senderId: 'client-1', content: clientCard({ price: 'حوالي 700' }), type: 'TEXT' }] }, state: STATE({ canReject: false, request: { messageId: 'msg-1', price: null, deliveryDays: null, notes: '', clear: false, createdAt: '2026-10-02T00:00:00Z' }, hint: 'اتفقوا في المحادثة ثم أرسل عرضًا مضادًا واضحًا' }) });
		expect(s.q('neg-card-hint')!.textContent).toContain('اتفقوا في المحادثة ثم أرسل عرضًا مضادًا واضحًا');
		expect(s.q('neg-card-reject')).toBeNull();
	});

	it('an older / already-answered request (not the server\'s open one) has no actions and no badge', async () => {
		const s = await render({ messages: { success: true, data: [{ id: 'old-1', senderId: 'client-1', content: clientCard({ price: '900' }), type: 'TEXT' }, { id: 'msg-1', senderId: 'client-1', content: clientCard({}), type: 'TEXT' }] } });
		const cards = Array.from(s.el.querySelectorAll('.neg-card-box'));
		expect(cards).toHaveLength(2);
		expect(cards[0].querySelector('.neg-card-actions')).toBeNull();
		expect(cards[0].querySelector('[data-testid="neg-open-badge"]')).toBeNull();
		expect(cards[1].querySelector('[data-testid="neg-card-reject"]')).not.toBeNull();
	});

	it('when the state cannot be read there are no decision buttons at all', async () => {
		const s = await render({ state: null });
		expect(s.q('neg-card-reject')).toBeNull(); expect(s.q('neg-card-counter')).toBeNull(); expect(s.q('neg-open-badge')).toBeNull();
	});

	it('the provider\'s own counter / reply entries render as such (waiting for the client / apologised) and never as a client request', async () => {
		const counter = NEG + JSON.stringify({ isNegotiation: true, kind: 'PROVIDER_COUNTER', offerId: 'offer-1', price: '900', priceValue: 900, deliveryDays: 10, notes: 'ملاحظة', status: 'COUNTER_SENT' });
		const reply = NEG + JSON.stringify({ isNegotiation: true, kind: 'PROVIDER_REJECT', offerId: 'offer-1', status: 'REJECTED' });
		const s = await render({ messages: { success: true, data: [{ id: 'm2', senderId: 'prov-1', content: counter, type: 'TEXT' }, { id: 'm3', senderId: 'prov-1', content: reply, type: 'TEXT' }] }, state: STATE({ request: null, canReject: false, canCounter: false, counterPending: true }) });
		const text = s.el.textContent!.replace(/\s+/g, ' ');
		expect(text).toContain('عرضك المضاد'); expect(text).toContain('بانتظار رد العميل'); expect(text).toContain('ردّك على طلب التفاوض');
		expect(text).toContain('10 يوم');
		expect(s.el.querySelector('.neg-card-actions')).toBeNull();
	});

	it('a CLIENT-authored message that pretends to be a provider counter is still treated as a client card', async () => {
		const fake = NEG + JSON.stringify({ isNegotiation: true, kind: 'PROVIDER_COUNTER', price: '1', status: 'COUNTER_SENT' });
		const s = await render({ messages: { success: true, data: [{ id: 'x', senderId: 'client-1', content: fake, type: 'TEXT' }] }, state: STATE({ request: null, canReject: false }) });
		expect(s.el.querySelector('.neg-card-box')!.getAttribute('data-neg-kind')).toBe('client');
	});

	it('the counter button goes to the negotiation page of the offer', async () => {
		const s = await render();
		(s.q('neg-card-counter') as HTMLButtonElement).click();
		expect(s.nav).toHaveBeenCalledWith(['/provider-overview/offers', 'offer-1', 'negotiate']);
	});
});
