import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClientMessages } from './messages';
import { ChatService } from '../../../../core/services/chat.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { ChatStateService } from '../../../../core/services/chat-state.service';
import { VideoCallService } from '../../../../core/services/video-call.service';
import { ClientOfferCounterService } from '../../../../core/services/client-offer-counter.service';

// The client's chat shows negotiation cards from the STRUCTURED messages only: no local accept/reject, no browser-side "decision".
// States of my own request: waiting / the provider apologised / the provider answered with a counter offer (price + duration).
const NEG = 'WS_NEGOTIATION::';
const myReq = (id = 'req-1', o: object = {}) => ({ id, senderId: 'client-1', type: 'TEXT', content: NEG + JSON.stringify({ isNegotiation: true, negType: 'price', negTypeName: 'السعر', price: '800', notes: 'خصم؟', status: 'PENDING', ...o }) });
const counter = (id = 'ctr-1', o: object = {}) => ({ id, senderId: 'prov-1', type: 'TEXT', content: NEG + JSON.stringify({ isNegotiation: true, kind: 'PROVIDER_COUNTER', offerId: 'o1', negTypeName: 'عرض مضاد من مقدم الخدمة', price: '900', priceValue: 900, deliveryDays: 10, notes: 'ملاحظة', replyToMessageId: 'req-1', status: 'COUNTER_SENT', ...o }) });
const reply = (id = 'rep-1', o: object = {}) => ({ id, senderId: 'prov-1', type: 'TEXT', content: NEG + JSON.stringify({ isNegotiation: true, kind: 'PROVIDER_REJECT', offerId: 'o1', replyToMessageId: 'req-1', status: 'REJECTED', ...o }) });

describe('client messages: negotiation cards are server-driven; the only decision is accepting a counter, through the server', () => {
	async function render(messages: any[], counterSvc: any = { acceptCounter: () => of({}) }) {
		await TestBed.configureTestingModule({ imports: [ClientMessages], providers: [provideRouter([]),
			{ provide: ChatService, useValue: { connect: () => {}, getConversations: () => of({ success: true, data: [{ id: 'c1', projectId: 'p1', name: 'مقدم', project: 'مشروع', participants: [] }] }), getMessages: () => of({ success: true, data: messages }), joinRoom: () => {}, leaveRoom: () => {}, markAsRead: () => {}, newMessage$: new Subject<any>(), typingIndicator$: new Subject<any>(), isRecording: signal(false), recordingTime: signal(0) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'client-1' }), token: () => null } },
			{ provide: ChatStateService, useValue: { activeConversationId: { set: () => {} }, markAsRead: () => {} } },
			{ provide: ClientOfferCounterService, useValue: counterSvc },
			{ provide: VideoCallService, useValue: { startCall: () => {} } },
			{ provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} }, queryParams: new BehaviorSubject({}).asObservable() } }] }).compileComponents();
		const f = TestBed.createComponent(ClientMessages); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, cards: () => Array.from(el.querySelectorAll('.neg-card-box')) as HTMLElement[] };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('the local fake is gone from the source: no respondNegotiation, no negStatus, no «قبول التفاوض», no promise messages', () => {
		const html = readFileSync(join(__dirname, 'messages.html'), 'utf8');
		const ts = readFileSync(join(__dirname, 'messages.ts'), 'utf8');
		for (const gone of ['respondNegotiation', 'negStatus', 'قبول التفاوض', 'تم قبول طلب التفاوض', 'تم اعتماد الشروط', 'neg-act-btn accept', 'neg-act-btn reject']) { expect(html).not.toContain(gone); expect(ts).not.toContain(gone); }
	});

	it('my own request, not answered yet: «بانتظار رد مقدم الخدمة», no accept / reject buttons', async () => {
		const s = await render([myReq()]);
		expect(s.cards()).toHaveLength(1);
		expect(s.cards()[0].querySelector('[data-testid="neg-badge"]')!.textContent).toContain('بانتظار رد مقدم الخدمة');
		const buttons = Array.from(s.el.querySelectorAll('.neg-card-box button')).map(b => b.textContent!.trim());
		expect(buttons.join('|')).not.toMatch(/قبول|رفض/);
	});

	it('the provider apologised: my request shows «اعتذر مقدم الخدمة» and the reply card is rendered as the provider\'s reply', async () => {
		const s = await render([myReq(), reply()]);
		const text = s.el.textContent!.replace(/\s+/g, ' ');
		expect(s.cards()[0].querySelector('[data-testid="neg-badge"]')!.textContent).toContain('اعتذر مقدم الخدمة');
		expect(s.cards()[1].getAttribute('data-neg-kind')).toBe('reply');
		expect(text).toContain('ردّ مقدم الخدمة على طلبك');
	});

	it('the provider answered with a counter offer: price + duration are shown, with the note that it does not change the official terms', async () => {
		const s = await render([myReq(), counter()]);
		expect(s.cards()[0].querySelector('[data-testid="neg-badge"]')!.textContent).toContain('ردّ مقدم الخدمة بعرض مضاد');
		const c = s.cards()[1];
		expect(c.getAttribute('data-neg-kind')).toBe('counter');
		const t = c.textContent!.replace(/\s+/g, ' ');
		expect(t).toContain('900 دولار'); expect(t).toContain('10 يوم'); expect(t).toContain('ملاحظة');
		expect(c.querySelector('[data-testid="neg-counter-note"]')!.textContent).toContain('ولا يغيّر السعر أو المدة الرسمية');
		expect(Array.from(c.querySelectorAll('button')).map(b => b.textContent!.trim()).join('|')).not.toMatch(/رفض/);
	});

	it('a message from ME that pretends to be a provider counter is still just my request (never a provider entry)', async () => {
		const fake = { id: 'x', senderId: 'client-1', type: 'TEXT', content: NEG + JSON.stringify({ isNegotiation: true, kind: 'PROVIDER_COUNTER', price: '1', status: 'COUNTER_SENT' }) };
		const s = await render([fake]);
		expect(s.cards()[0].getAttribute('data-neg-kind')).toBe('request');
	});

	it('«مناقشة» stays: it only fills the message box (an ordinary message), and sends nothing', async () => {
		const s = await render([myReq()]);
		(s.el.querySelector('[data-testid="neg-discuss"]') as HTMLButtonElement).click();
		expect(s.c.newMessageText()).toContain('بخصوص التفاوض على');
	});

	it('no AI purple / AI icon in the negotiation cards', () => {
		const html = readFileSync(join(__dirname, 'messages.html'), 'utf8');
		const card = html.slice(html.indexOf('Negotiation Card Message'), html.indexOf('5) Standard Text Message'));
		expect(card).not.toMatch(/#i-ai|ai-disc|ai-bc|ai-insight|ai-banner|txt-purple|text-purple/);
	});

	describe('accepting the provider counter-offer', () => {
		const accept = (c: HTMLElement) => c.querySelector('[data-testid="neg-counter-accept"]') as HTMLButtonElement | null;

		it('the newest clear counter shows «قبول العرض المضاد»; asking shows the new price + days and sends nothing yet', async () => {
			const calls: any[] = [];
			const s = await render([myReq(), counter()], { acceptCounter: (...a: any[]) => { calls.push(a); return of({}); } });
			const card = s.cards()[1];
			expect(accept(card)!.textContent).toContain('قبول العرض المضاد');
			accept(card)!.click(); s.f.detectChanges();
			const text = card.textContent!.replace(/\s+/g, ' ');
			expect(text).toContain('سيصبح سعر العرض 900 دولار ومدته 10 يوم');
			expect(calls).toHaveLength(0);
			(card.querySelector('[data-testid="neg-counter-accept-no"]') as HTMLButtonElement).click(); s.f.detectChanges();
			expect(accept(card)).not.toBeNull();
		});

		it('confirming calls the service with project, offer and THIS counter message id; success marks it accepted and shows the way on', async () => {
			const calls: any[] = [];
			const s = await render([myReq(), counter('ctr-7')], { acceptCounter: (...a: any[]) => { calls.push(a); return of({ price: 900, deliveryDays: 10 }); } });
			const card = s.cards()[1];
			accept(card)!.click(); s.f.detectChanges();
			(card.querySelector('[data-testid="neg-counter-accept-yes"]') as HTMLButtonElement).click(); s.f.detectChanges();
			expect(calls).toEqual([['p1', 'o1', 'ctr-7']]);
			expect(accept(card)).toBeNull();
			expect(card.querySelector('[data-testid="neg-counter-accepted"]')!.textContent).toContain('تم قبول هذا العرض المضاد');
			expect(card.querySelector('[data-testid="neg-counter-open-request"]')).not.toBeNull();
			expect(s.c.toastMessage()).toContain('900 دولار خلال 10 يوم');
		});

		it('a server refusal (e.g. stale counter) is shown in the card with the server text, the counter stays acceptable', async () => {
			const s = await render([myReq(), counter()], { acceptCounter: () => throwError(() => ({ error: { message: 'هذا العرض المضاد لم يعد الأحدث، راجع آخر عرض مضاد من مقدم الخدمة' } })) });
			const card = s.cards()[1];
			accept(card)!.click(); s.f.detectChanges();
			(card.querySelector('[data-testid="neg-counter-accept-yes"]') as HTMLButtonElement).click(); s.f.detectChanges();
			expect(card.querySelector('[data-testid="neg-counter-error"]')!.textContent).toContain('لم يعد الأحدث');
			expect(card.querySelector('[data-testid="neg-counter-accepted"]')).toBeNull();
			expect(s.c.counterConfirmId()).toBe('ctr-1');
		});

		it('a network failure without a body shows a generic Arabic error', async () => {
			const s = await render([myReq(), counter()], { acceptCounter: () => throwError(() => ({})) });
			const card = s.cards()[1];
			accept(card)!.click(); s.f.detectChanges();
			(card.querySelector('[data-testid="neg-counter-accept-yes"]') as HTMLButtonElement).click(); s.f.detectChanges();
			expect(card.querySelector('[data-testid="neg-counter-error"]')!.textContent).toContain('تعذر قبول العرض المضاد');
		});

		it('only the NEWEST negotiation message can be accepted: an older counter has no button', async () => {
			const s = await render([myReq(), counter('ctr-1'), myReq('req-2'), counter('ctr-2', { price: '850', priceValue: 850, deliveryDays: 9 })]);
			const cards = s.cards();
			expect(accept(cards[1])).toBeNull();
			expect(accept(cards[3])).not.toBeNull();
		});

		it('a counter followed by my acceptance message is shown as accepted (no button), and my acceptance card is labelled', async () => {
			const acc = { id: 'acc-1', senderId: 'client-1', type: 'TEXT', content: NEG + JSON.stringify({ isNegotiation: true, kind: 'CLIENT_ACCEPT_COUNTER', offerId: 'o1', price: '900', priceValue: 900, deliveryDays: 10, replyToMessageId: 'ctr-1', status: 'ACCEPTED' }) };
			const s = await render([myReq(), counter('ctr-1'), acc]);
			const cards = s.cards();
			expect(accept(cards[1])).toBeNull();
			expect(cards[1].querySelector('[data-testid="neg-counter-accepted"]')).not.toBeNull();
			expect(cards[2].getAttribute('data-neg-kind')).toBe('accepted');
			expect(cards[2].textContent).toContain('قبولك للعرض المضاد');
			expect(cards[2].textContent).toContain('تم قبول العرض المضاد');
		});

		it('a counter without a clear price/days or offer id offers no accept', async () => {
			const s = await render([myReq(), counter('ctr-1', { price: 'حوالي 900', priceValue: undefined, deliveryDays: undefined, duration: 'أسبوعين' })]);
			expect(accept(s.cards()[1])).toBeNull();
		});
	});
});
