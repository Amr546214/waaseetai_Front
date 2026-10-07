import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { signal } from '@angular/core';
import { ProviderMessages } from './messages';
import { ChatService } from '../../../../core/services/chat.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { ChatStateService } from '../../../../core/services/chat-state.service';
import { VideoCallService } from '../../../../core/services/video-call.service';

// No conversation -> one centred empty state in the message panel and NO chat header / toolbar (no empty bar above it).
// With a conversation the header renders as before.
async function render(conversations: any[]) {
	await TestBed.configureTestingModule({
		imports: [ProviderMessages],
		providers: [
			provideRouter([]),
			{ provide: ChatService, useValue: { connect: () => {}, getConversations: () => of({ success: true, data: conversations }), getMessages: () => of({ success: false }), joinRoom: () => {}, leaveRoom: () => {}, markAsRead: () => {}, newMessage$: new Subject<any>(), typingIndicator$: new Subject<any>(), isRecording: signal(false), recordingTime: signal(0) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }), token: () => null } },
			{ provide: ChatStateService, useValue: { activeConversationId: { set: () => {} }, markAsRead: () => {} } },
			{ provide: VideoCallService, useValue: { startCall: () => {} } },
			{ provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} }, queryParams: new BehaviorSubject({}).asObservable() } },
		],
	}).compileComponents();
	const f = TestBed.createComponent(ProviderMessages);
	await f.whenStable();
	f.detectChanges();
	return f.nativeElement as HTMLElement;
}

describe('provider messages: empty state', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('no conversations: centred "لا توجد محادثات بعد", no header / toolbar / message area in the panel', async () => {
		const el = await render([]);
		const panel = el.querySelector('.msg-panel') as HTMLElement;
		expect(panel.querySelector('[data-testid="messages-empty"]')?.textContent).toContain('لا توجد محادثات بعد');
		expect(panel.querySelector('.msg-hdr')).toBeNull();
		expect(panel.querySelector('.msgs')).toBeNull();
		expect(panel.children.length).toBe(1);
	});

	it('with a conversation: the chat header renders and the empty state does not', async () => {
		const el = await render([{ id: 'c1', name: 'عميل', project: 'مشروع' }]);
		const panel = el.querySelector('.msg-panel') as HTMLElement;
		expect(panel.querySelector('.msg-hdr')).not.toBeNull();
		expect(panel.querySelector('[data-testid="messages-empty"]')).toBeNull();
	});
});
