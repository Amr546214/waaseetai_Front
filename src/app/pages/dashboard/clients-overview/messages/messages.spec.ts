import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { signal } from '@angular/core';

import { ClientMessages } from './messages';
import { ChatService } from '../../../../core/services/chat.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { ChatStateService } from '../../../../core/services/chat-state.service';
import { VideoCallService } from '../../../../core/services/video-call.service';

const conversationA = { id: 'conv-a', name: 'مقدم الخدمة أ', project: 'مشروع أ' };
const conversationB = { id: 'conv-b', name: 'مقدم الخدمة ب', project: 'مشروع ب' };

function makeFakeChatService(conversations: any[]) {
  return {
    connect: () => {},
    getConversations: () => of({ success: true, data: conversations }),
    getMessages: () => of({ success: false }),
    joinRoom: () => {},
    leaveRoom: () => {},
    markAsRead: () => {},
    newMessage$: new Subject<any>(),
    typingIndicator$: new Subject<any>(),
    isRecording: signal(false),
    recordingTime: signal(0)
  };
}

function makeFakeActivatedRoute(initialConversationId: string | null) {
  const initial: Record<string, string> = initialConversationId ? { conversationId: initialConversationId } : {};
  const subject = new BehaviorSubject<Record<string, string>>(initial);
  return { snapshot: { queryParams: initial }, queryParams: subject.asObservable() };
}

async function setup(conversations: any[], requestedConversationId: string | null) {
  await TestBed.configureTestingModule({
    imports: [ClientMessages],
    providers: [
      provideRouter([]),
      { provide: ChatService, useValue: makeFakeChatService(conversations) },
      { provide: AuthStore, useValue: { currentUser: () => null, token: () => null } },
      { provide: ChatStateService, useValue: { activeConversationId: { set: () => {} }, markAsRead: () => {} } },
      { provide: VideoCallService, useValue: { startCall: () => {} } },
      { provide: ActivatedRoute, useValue: makeFakeActivatedRoute(requestedConversationId) }
    ]
  }).compileComponents();

  const fixture: ComponentFixture<ClientMessages> = TestBed.createComponent(ClientMessages);
  const component = fixture.componentInstance;
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component };
}

describe('Messages', () => {
  it('should create', async () => {
    const { component } = await setup([conversationA, conversationB], null);
    expect(component).toBeTruthy();
  });

  describe('conversationId resolution — never land the client in an unrelated chat', () => {
    it('with no requested conversationId, defaults to the first conversation (existing behavior)', async () => {
      const { component } = await setup([conversationA, conversationB], null);
      expect(component.activeConversation()?.id).toBe('conv-a');
      expect(component.conversationNotFound()).toBe(false);
    });

    it('a requested conversationId that exists is selected', async () => {
      const { component } = await setup([conversationA, conversationB], 'conv-b');
      expect(component.activeConversation()?.id).toBe('conv-b');
      expect(component.conversationNotFound()).toBe(false);
    });

    it('a requested conversationId that does NOT exist never silently selects an unrelated conversation', async () => {
      const { component, fixture } = await setup([conversationA, conversationB], 'conv-does-not-exist');
      expect(component.activeConversation()).toBeNull();
      expect(component.activeConvId()).not.toBe('conv-a');
      expect(component.conversationNotFound()).toBe(true);
      expect(fixture.nativeElement.textContent).toContain('تعذر العثور على هذه المحادثة');
    });

    it('with zero conversations at all, shows an honest empty state rather than a not-found error', async () => {
      const { component, fixture } = await setup([], null);
      expect(component.activeConversation()).toBeNull();
      expect(component.conversationNotFound()).toBe(false);
      expect(fixture.nativeElement.textContent).toContain('لا توجد محادثات بعد');
    });
  });
});
