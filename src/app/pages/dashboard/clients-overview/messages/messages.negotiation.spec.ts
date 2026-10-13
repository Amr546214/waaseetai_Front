import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { signal } from '@angular/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ClientMessages } from './messages';
import { ChatService } from '../../../../core/services/chat.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { ChatStateService } from '../../../../core/services/chat-state.service';
import { VideoCallService } from '../../../../core/services/video-call.service';

// The client's chat shows negotiation cards from the STRUCTURED messages only: no local accept/reject, no browser-side "decision".
// States of my own request: waiting / the provider apologised / the provider answered with a counter offer (price + duration).
const NEG = 'WS_NEGOTIATION::';
const myReq = (id = 'req-1', o: object = {}) => ({ id, senderId: 'client-1', type: 'TEXT', content: NEG + JSON.stringify({ isNegotiation: true, negType: 'price', negTypeName: 'السعر', price: '800', notes: 'خصم؟', status: 'PENDING', ...o }) });
const counter = (id = 'ctr-1', o: object = {}) => ({ id, senderId: 'prov-1', type: 'TEXT', content: NEG + JSON.stringify({ isNegotiation: true, kind: 'PROVIDER_COUNTER', offerId: 'o1', negTypeName: 'عرض مضاد من مقدم الخدمة', price: '900', priceValue: 900, deliveryDays: 10, notes: 'ملاحظة', replyToMessageId: 'req-1', status: 'COUNTER_SENT', ...o }) });
const reply = (id = 'rep-1', o: object = {}) => ({ id, senderId: 'prov-1', type: 'TEXT', content: NEG + JSON.stringify({ isNegotiation: true, kind: 'PROVIDER_REJECT', offerId: 'o1', replyToMessageId: 'req-1', status: 'REJECTED', ...o }) });

describe('client messages: negotiation cards are server-driven and have no local accept/reject', () => {
	async function render(messages: any[]) {
		await TestBed.configureTestingModule({ imports: [ClientMessages], providers: [provideRouter([]),
			{ provide: ChatService, useValue: { connect: () => {}, getConversations: () => of({ success: true, data: [{ id: 'c1', projectId: 'p1', name: 'مقدم', project: 'مشروع', participants: [] }] }), getMessages: () => of({ success: true, data: messages }), joinRoom: () => {}, leaveRoom: () => {}, markAsRead: () => {}, newMessage$: new Subject<any>(), typingIndicator$: new Subject<any>(), isRecording: signal(false), recordingTime: signal(0) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'client-1' }), token: () => null } },
			{ provide: ChatStateService, useValue: { activeConversationId: { set: () => {} }, markAsRead: () => {} } },
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
		expect(Array.from(c.querySelectorAll('button')).map(b => b.textContent!.trim()).join('|')).not.toMatch(/قبول|رفض/);
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
});
