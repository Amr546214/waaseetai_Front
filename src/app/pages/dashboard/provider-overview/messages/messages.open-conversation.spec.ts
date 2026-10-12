import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ProviderMessages, resolveInitialConversation } from './messages';
import { ChatService } from '../../../../core/services/chat.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { ChatStateService } from '../../../../core/services/chat-state.service';
import { VideoCallService } from '../../../../core/services/video-call.service';

// A message context ({projectId}) opens ONLY the conversation of that project. No such conversation -> nothing else is opened, with a clear message.
// No context at all -> the first conversation, as before.
const CONVS = [
	{ id: 'c1', projectId: 'p1', name: 'عميل أول', project: 'مشروع 1', participants: [], lastMessage: null },
	{ id: 'c2', projectId: 'p2', name: 'عميل ثاني', project: 'مشروع 2', participants: [], lastMessage: null },
	{ id: 'c3', projectId: 'p3', name: 'عميل ثالث', project: 'مشروع 3', participants: [], lastMessage: null },
];

describe('resolveInitialConversation (pure)', () => {
	const L = [{ id: 'c1', projectId: 'p1' }, { id: 'c2', projectId: 'p2' }];
	it('an explicit conversationId that exists wins', () => {
		expect(resolveInitialConversation(L, 'c2', { projectId: 'p1' })).toEqual({ id: 'c2', missing: false });
	});
	it('a context opens the conversation of that project only', () => {
		expect(resolveInitialConversation(L, null, { projectId: 'p2' })).toEqual({ id: 'c2', missing: false });
	});
	it('a context for a project without a conversation opens NOTHING (never conversation[0])', () => {
		expect(resolveInitialConversation(L, null, { projectId: 'p-none' })).toEqual({ id: null, missing: true });
		expect(resolveInitialConversation(L, 'stale', { projectId: 'p-none' })).toEqual({ id: null, missing: true });
		expect(resolveInitialConversation([], null, { projectId: 'p1' })).toEqual({ id: null, missing: true });
	});
	it('a context that carries no project cannot identify a conversation: nothing is opened', () => {
		expect(resolveInitialConversation(L, null, {})).toEqual({ id: null, missing: true });
	});
	it('no context: the first conversation as before; empty list: nothing, not "missing"', () => {
		expect(resolveInitialConversation(L, null, null)).toEqual({ id: 'c1', missing: false });
		expect(resolveInitialConversation(L, 'stale-id', undefined)).toEqual({ id: 'c1', missing: false });
		expect(resolveInitialConversation([], null, null)).toEqual({ id: null, missing: false });
	});
});

describe('provider messages: opens the conversation of the project in the context', () => {
	async function render(opts: { ctx?: any; conversationId?: string } = {}) {
		window.history.replaceState(opts.ctx ? { messageContext: opts.ctx } : {}, '');
		const joinRoom = vi.fn(); const getMessages = vi.fn(() => of({ success: false })); const sendMessage = vi.fn();
		await TestBed.configureTestingModule({ imports: [ProviderMessages], providers: [provideRouter([]),
			{ provide: ChatService, useValue: { connect: () => {}, getConversations: () => of({ success: true, data: CONVS }), getMessages, joinRoom, leaveRoom: () => {}, markAsRead: () => {}, sendMessage, emitTyping: () => {}, newMessage$: new Subject<any>(), typingIndicator$: new Subject<any>(), isRecording: signal(false), recordingTime: signal(0) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'prov-1', accountType: 'PROVIDER_INDIVIDUAL' }), token: () => null } },
			{ provide: ChatStateService, useValue: { activeConversationId: { set: () => {} }, markAsRead: () => {} } },
			{ provide: VideoCallService, useValue: { startCall: () => {} } },
			{ provide: ActivatedRoute, useValue: { snapshot: { queryParams: opts.conversationId ? { conversationId: opts.conversationId } : {} }, queryParams: new BehaviorSubject(opts.conversationId ? { conversationId: opts.conversationId } : {}).asObservable() } }] }).compileComponents();
		const f = TestBed.createComponent(ProviderMessages); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, q: (id: string) => el.querySelector(`[data-testid="${id}"]`), joinRoom, getMessages, sendMessage };
	}
	afterEach(() => { TestBed.resetTestingModule(); window.history.replaceState({}, ''); });

	it('a context whose projectId matches opens exactly that conversation (not the first)', async () => {
		const s = await render({ ctx: { type: 'PROJECT', projectId: 'p2', projectTitle: 'مشروع 2' } });
		expect(s.c.activeConvId()).toBe('c2');
		expect(s.c.activeConversation()!.id).toBe('c2');
		expect(s.joinRoom).toHaveBeenCalledTimes(1);
		expect(s.joinRoom.mock.calls[0][0]).toBe('c2');
		expect(s.q('messages-no-project-conversation')).toBeNull();
		expect(s.el.querySelector('.msg-hdr')).not.toBeNull();
	});

	it('a context for a project that has no conversation opens NO conversation and says so clearly', async () => {
		const s = await render({ ctx: { type: 'PROJECT', projectId: 'p-without-chat', projectTitle: 'مشروع بلا محادثة' } });
		expect(s.c.activeConvId()).toBe('');
		expect(s.c.activeConversation()).toBeNull(); // never conversation[0]
		expect(s.joinRoom).not.toHaveBeenCalled();
		expect(s.getMessages).not.toHaveBeenCalled();
		const box = s.q('messages-no-project-conversation')!;
		expect(box.textContent).toContain('لا توجد محادثة لهذا المشروع بعد.');
		expect(box.textContent).toContain('يبدأها العميل عند الحاجة.');
		expect(s.q('no-conversation-project')!.textContent).toContain('مشروع بلا محادثة');
		expect(s.el.querySelector('.msg-hdr')).toBeNull();
		expect((s.el.querySelector('.msg-panel') as HTMLElement).textContent).not.toContain('عميل أول'); // the first conversation's chat is not shown in the panel
	});

	it('a context with no projectId (cannot identify a project) also opens nothing', async () => {
		const s = await render({ ctx: { type: 'PROJECT', projectTitle: 'مشروع' } });
		expect(s.c.activeConversation()).toBeNull();
		expect(s.joinRoom).not.toHaveBeenCalled();
		expect(s.q('messages-no-project-conversation')).not.toBeNull();
	});

	it('plain navigation without a context opens the first conversation exactly as before', async () => {
		const s = await render();
		expect(s.c.activeConvId()).toBe('c1');
		expect(s.joinRoom.mock.calls[0][0]).toBe('c1');
		expect(s.q('messages-no-project-conversation')).toBeNull();
	});

	it('an explicit conversationId (project progress page) still wins', async () => {
		const s = await render({ conversationId: 'c3', ctx: { type: 'STAGE', projectId: 'p3' } });
		expect(s.c.activeConvId()).toBe('c3');
		expect(s.c.activeContext()).not.toBeNull(); // its context belongs to this conversation
	});

	it('picking a conversation after the "no conversation" state opens it normally', async () => {
		const s = await render({ ctx: { type: 'PROJECT', projectId: 'p-without-chat' } });
		s.c.selectConversation('c2'); s.f.detectChanges();
		expect(s.c.activeConvId()).toBe('c2');
		expect(s.q('messages-no-project-conversation')).toBeNull();
		expect(s.c.activeContext()).toBeNull(); // the context was for another project: it is not attached here
	});

	it('a pending context is never attached to a message in another project\'s conversation', async () => {
		const s = await render({ conversationId: 'c1', ctx: { type: 'PROJECT', projectId: 'p2', projectTitle: 'مشروع 2' } });
		expect(s.c.activeConvId()).toBe('c1');
		expect(s.c.activeContext()).toBeNull();
		s.c.newMessageText.set('مرحبا'); s.c.sendMessage('TEXT');
		expect(s.sendMessage).toHaveBeenCalledTimes(1);
		expect((s.sendMessage.mock.calls[0] as any[])[1].context).toBeUndefined();
	});

	it('a context for the conversation on screen is attached to the next message, as before', async () => {
		const s = await render({ ctx: { type: 'PROJECT', projectId: 'p2', projectTitle: 'مشروع 2' } });
		s.c.newMessageText.set('مرحبا'); s.c.sendMessage('TEXT');
		const payload = (s.sendMessage.mock.calls[0] as any[])[1];
		expect(payload.conversationId).toBe('c2');
		expect(payload.context).toMatchObject({ projectId: 'p2' });
	});
});
