/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { signal, Type } from '@angular/core';
import { ClientMessages } from './clients-overview/messages/messages';
import { ProviderMessages } from './provider-overview/messages/messages';
import { MarketerMessages } from './marketer-overview/messages/messages';
import { ChatService } from '../../core/services/chat.service';
import { AuthStore } from '../../core/store/auth.store';
import { ChatStateService } from '../../core/services/chat-state.service';
import { VideoCallService } from '../../core/services/video-call.service';

// Every role's messages page carries the same وسيط AI bar when a conversation is open, and none above the empty state.
// The wording is the real review notice (support may review reported chats / disputes): the backend has no AI analysis of chat content,
// so no monitoring claim and no accuracy figure appears (the former "AI monitors all chats · 97%" banner was removed for that reason).
const BAR_TEXT = 'قد تُراجع المحادثات من فريق الدعم عند الإبلاغ عنها أو ضمن مراجعة نزاع';

async function render(cls: Type<unknown>, conversations: any[]) {
	await TestBed.configureTestingModule({
		imports: [cls],
		providers: [provideRouter([]),
			{ provide: ChatService, useValue: { connect: () => {}, getConversations: () => of({ success: true, data: conversations }), getMessages: () => of({ success: false }), joinRoom: () => {}, leaveRoom: () => {}, markAsRead: () => {}, newMessage$: new Subject<any>(), typingIndicator$: new Subject<any>(), isRecording: signal(false), recordingTime: signal(0) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }), token: () => null } },
			{ provide: ChatStateService, useValue: { activeConversationId: { set: () => {} }, markAsRead: () => {} } },
			{ provide: VideoCallService, useValue: { startCall: () => {} } },
			{ provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} }, queryParams: new BehaviorSubject({}).asObservable() } }],
	}).compileComponents();
	const f = TestBed.createComponent(cls);
	await f.whenStable();
	f.detectChanges();
	return f.nativeElement as HTMLElement;
}

describe('messages pages: وسيط AI bar', () => {
	afterEach(() => TestBed.resetTestingModule());
	for (const [role, cls] of [['client', ClientMessages], ['provider (and company)', ProviderMessages], ['marketer', MarketerMessages]] as const) {
		it(`${role}: bar above the chat header when a conversation is open, honest text only`, async () => {
			const el = await render(cls as Type<unknown>, [{ id: 'c1', name: 'طرف', project: 'مشروع' }]);
			const bar = el.querySelector('[data-testid="chat-ai-bar"]') as HTMLElement;
			expect(bar).not.toBeNull();
			expect(bar.textContent).toContain('وسيط AI');
			expect(bar.textContent).toContain(BAR_TEXT);
			expect(bar.textContent).not.toMatch(/%|دقة|يراقب|مراقبة/);
			const panel = el.querySelector('.msg-panel') as HTMLElement;
			expect(panel.firstElementChild).toBe(bar);
			expect(panel.querySelector('.msg-hdr')).not.toBeNull();
		});
		it(`${role}: no bar (and no empty strip) above the empty state when there is no conversation`, async () => {
			const el = await render(cls as Type<unknown>, []);
			const panel = el.querySelector('.msg-panel') as HTMLElement;
			expect(panel.querySelector('[data-testid="chat-ai-bar"]')).toBeNull();
			expect(panel.querySelector('.msg-hdr')).toBeNull();
			expect(panel.textContent).toContain('لا توجد محادثات بعد');
			expect(panel.children.length).toBe(1);
		});
	}
	it('admin messages keep their own review notice bar', () => {
		const html = readFileSync(join(__dirname, 'supper-admin-overview/sa-messages/sa-messages.html'), 'utf-8');
		expect(html).toContain('ms-ai-bc');
		expect(html).toContain(BAR_TEXT);
	});
});
