import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectMiniChat } from './project-mini-chat';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ChatService } from '../../core/services/chat.service';

describe('ProjectMiniChat', () => {
  let component: ProjectMiniChat;
  let fixture: ComponentFixture<ProjectMiniChat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectMiniChat],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectMiniChat);
    component = fixture.componentInstance;
  });

  it('identifies negotiation messages correctly', () => {
    const negMsg1 = { content: '{"isNegotiation":true,"kind":"CLIENT_ACCEPT_COUNTER","price":2000}' } as any;
    const negMsg2 = { content: 'WS_NEGOTIATION::offer-1::{"negType":"counter_accept","price":2000}' } as any;
    const regularMsg = { content: 'hello let us start the project' } as any;

    expect(component.isNegotiationMsg(negMsg1)).toBe(true);
    expect(component.isNegotiationMsg(negMsg2)).toBe(true);
    expect(component.isNegotiationMsg(regularMsg)).toBe(false);
  });

  it('parses negotiation payload without exposing raw json', () => {
    const raw = 'WS_NEGOTIATION::offer-1::{"negType":"counter_accept","negTypeName":"قبول العرض المضاد","price":"2000","deliveryDays":10,"status":"ACCEPTED"}';
    const parsed = component.getNegData({ content: raw } as any);

    expect(parsed).toBeTruthy();
    expect(parsed.price).toBe('2000');
    expect(parsed.deliveryDays).toBe(10);
    expect(component.getNegTitle(parsed)).toBe('تم قبول العرض المضاد');
  });

  it('correctly distinguishes image attachments from other files', () => {
    expect(component.isImage('https://cdn.example.com/photo.jpg')).toBe(true);
    expect(component.isImage('https://cdn.example.com/screen.PNG')).toBe(true);
    expect(component.isImage(undefined, 'design.webp')).toBe(true);
    expect(component.isImage('https://cdn.example.com/archive.zip')).toBe(false);
    expect(component.isImage(undefined, 'document.pdf')).toBe(false);
  });

  describe('replies', () => {
    const msg = (o: any) => ({ id: 'm', senderName: 'x', senderInitial: 'x', isMe: false, content: 'نص', time: new Date(), status: 'SENT', ...o });
    const setup = () => {
      const chat = TestBed.inject(ChatService); const send = vi.spyOn(chat, 'sendMessage').mockImplementation(() => undefined as never); vi.spyOn(chat, 'emitTyping').mockImplementation(() => undefined as never);
      component.conversationId = 'c1'; component.currentUserId = 'me';
      return send;
    };
    it('a revision request of the other side is the default reply target until it is answered; the answer is sent with replyTo and shown quoted at once', () => {
      const send = setup();
      component.messages.set([msg({ id: 'rev1', senderName: 'العميل', content: 'طلب تعديل على «المرحلة»: غيّر الصورة', context: { type: 'DELIVERY', kind: 'REVISION_REQUEST' } })]);
      expect(component.replyTarget()?.id).toBe('rev1');
      component.draft = 'ماشي'; component.send();
      expect(send.mock.calls[0][1].context).toEqual({ type: 'PROJECT', replyTo: { messageId: 'rev1' } });
      const mine = component.messages().at(-1)!; expect(mine.context?.replyTo).toMatchObject({ messageId: 'rev1', senderName: 'العميل', kind: 'REVISION_REQUEST' }); expect(mine.context?.replyTo?.excerpt).toContain('غيّر الصورة');
      expect(component.replyTarget()).toBeNull(); // answered: nothing is pre-selected any more
    });
    it('dismissing the default target sends a plain message; a plain message of the other side is only a reply when chosen with «رد»', () => {
      const send = setup();
      component.messages.set([msg({ id: 'rev1', context: { type: 'DELIVERY', kind: 'REVISION_REQUEST' } }), msg({ id: 'p1', senderName: 'زياد', content: 'سؤال' })]);
      component.cancelReply(); expect(component.replyTarget()).toBeNull();
      component.draft = 'بلا رد'; component.send(); expect(send.mock.calls[0][1].context).toBeUndefined(); component.sending.set(false);
      component.startReply(component.messages().find(m => m.id === 'p1')!); expect(component.replyTarget()?.id).toBe('p1');
      component.draft = 'جواب'; component.send(); expect(send.mock.calls[1][1].context).toEqual({ type: 'PROJECT', replyTo: { messageId: 'p1' } });
      expect(component.replyTarget()).toBeNull();
    });
    it('my own message is never an automatic target, the quote is rendered with its sender and text, and a pending message cannot be replied to', () => {
      setup();
      component.messages.set([msg({ id: 'mine', isMe: true, context: { type: 'DELIVERY', kind: 'REVISION_REQUEST' } }), msg({ id: 'a', context: { type: 'PROJECT', replyTo: { messageId: 'mine', senderName: 'أنت', excerpt: 'نصي الأصلي' } } }), msg({ id: 't', tempId: 't', status: 'PENDING' })]);
      expect(component.autoReplyTarget()).toBeNull(); component.startReply(component.messages().find(m => m.tempId)!); expect(component.replyTarget()).toBeNull();
      fixture.detectChanges(); // first render runs ngOnInit (which loads the initial messages): set ours after it
      component.messages.set([msg({ id: 'mine', isMe: true, context: { type: 'DELIVERY', kind: 'REVISION_REQUEST' } }), msg({ id: 'a', context: { type: 'PROJECT', replyTo: { messageId: 'mine', senderName: 'أنت', excerpt: 'نصي الأصلي' } } })]); fixture.detectChanges();
      const quote = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="chat-quote"]');
      expect(quote?.textContent).toContain('أنت'); expect(quote?.textContent).toContain('نصي الأصلي');
    });
  });
});
