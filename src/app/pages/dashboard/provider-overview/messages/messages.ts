import { chatPreview } from '../../../../core/utils/chat-preview.util';
import { providerTimeZone } from '../../../../core/services/provider-prefs.store';
import { Component, ElementRef, computed, signal, inject, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService, ChatMessagePayload, MessageContext } from '../../../../core/services/chat.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { ChatStateService } from '../../../../core/services/chat-state.service';
import { VideoCallService } from '../../../../core/services/video-call.service';

import { OffersService, OfferNegotiationState } from '../../../../core/services/offers.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { focusInvalidControls } from '../../../../shared/forms/form-error-focus';

export interface MessageItem {
  id: number | string;
  tempId?: string;
  status?: 'PENDING' | 'SENT' | 'READ';
  sender: 'me' | 'other';
  senderInitials: string;
  type?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' | 'SYSTEM';
  text: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  audioDuration?: number;
  context?: MessageContext | null;
  time: string;
  dateGroup: string;
  isPlaying?: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  project: string;
  /** The real project this conversation belongs to (GET /chat/conversations returns it). */
  projectId?: string;
  avatarType: 'sk' | 'pr' | 'co';
  initials: string;
  lastMsg: string;
  time: string;
  unreadCount: number;
  online: boolean;
  messages: MessageItem[];
}

/**
 * Which conversation the messages page opens on load.
 *  1. an explicit `conversationId` that exists in the list -> that one;
 *  2. a message context (an action like "message the client of this project"): ONLY the conversation of that very projectId — never the first one.
 *     No such conversation (or a context without a project) -> nothing is opened and `missing` is true;
 *  3. no context at all (plain navigation to /messages) -> the first conversation, as before.
 */
export function resolveInitialConversation(
  list: { id: string; projectId?: string }[],
  conversationIdParam: string | null | undefined,
  ctx: { projectId?: string } | null | undefined
): { id: string | null; missing: boolean } {
  if (conversationIdParam && list.some((c) => c.id === conversationIdParam)) return { id: conversationIdParam, missing: false };
  if (ctx) {
    const match = ctx.projectId ? list.find((c) => c.projectId === ctx.projectId) : undefined;
    return match ? { id: match.id, missing: false } : { id: null, missing: true };
  }
  return list.length ? { id: list[0].id, missing: false } : { id: null, missing: false };
}

@Component({
  selector: 'app-provider-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './messages.html',
  styleUrl: './messages.css',
  encapsulation: ViewEncapsulation.None,
})
export class ProviderMessages implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public chatService = inject(ChatService);
  private authStore = inject(AuthStore);
  private chatStateService = inject(ChatStateService);
  private videoCallService = inject(VideoCallService);
  private offersService = inject(OffersService);
  private notify = inject(UiNotificationService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private sub = new Subscription();

  private currentUserId = 'provider_001';
  private typingTimeout: any = null;
  private audioPlayer: HTMLAudioElement | null = null;

  searchQuery = signal<string>('');
  activeConvId = signal<string>('');
  showChatOnMobile = signal<boolean>(false);
  newMessageText = signal<string>('');
  /** Inline message under the composer (empty message). Cleared as soon as the user types. */
  composerError = signal<string | null>(null);
  /** True right after a text message was sent: a second click / Enter on the now-empty box sends nothing and says nothing. */
  private justSent = false;
  messageContext = signal<MessageContext | null>(null);
  // true when the page was opened FOR a project that has no conversation yet: no other conversation is opened, a clear message is shown instead.
  contextConversationMissing = signal<boolean>(false);

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  // Company message tabs
  coMsgTab = signal<string>('clients');
  coMsgTabs = [
    { id: 'clients', label: 'العملاء' },
    { id: 'team', label: 'الفريق' },
    { id: 'support', label: 'الدعم' },
  ];

  setCoMsgTab(tabId: string) {
    this.coMsgTab.set(tabId);
  }

  coFilteredConversations = computed(() => {
    const tab = this.coMsgTab();
    const list = this.filteredConversations();
    if (tab === 'clients') return list.filter(c => c.avatarType === 'sk' || c.avatarType === 'co');
    if (tab === 'team') return list.filter(c => c.name.includes('الفريق') || c.name.includes('·'));
    if (tab === 'support') return list.filter(c => c.name.includes('الدعم') || c.name.includes('TKT'));
    return list;
  });

  // Rich media UI state signals
  showEmojiPicker = signal<boolean>(false);
  previewImageUrl = signal<string | null>(null);
  partnerIsTyping = signal<boolean>(false);
  typingUserName = signal<string>('');

  emojis = ['👍', '🤝', '✔', '😊', '🔥', '✨', '💡', '🎉', '📌', '🙌', '🚀', '⭐', '👏', '🎯', '💯', '💬', '📢', '📁'];
  waveformBars = [12, 18, 8, 22, 16, 24, 14, 20, 10, 24, 18, 14, 22, 12, 16, 20, 8, 14];

  // Audio recording reactive bindings from service
  isRecording = this.chatService.isRecording;
  formattedRecordingTime = computed(() => {
    const secs = this.chatService.recordingTime();
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });

  conversations = signal<Conversation[]>([]);

  filteredConversations = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const list = this.conversations();
    if (!query) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.project.toLowerCase().includes(query) ||
        c.lastMsg.toLowerCase().includes(query)
    );
  });

  activeConversation = computed(() => {
    const activeId = this.activeConvId();
    const found = activeId ? this.conversations().find((c) => c.id === activeId) : undefined;
    if (found) return found;
    // opened for a project without a conversation: show the explanation, never conversation[0]
    if (this.contextConversationMissing()) return null;
    return this.conversations().length > 0 ? this.conversations()[0] : null;
  });

  /** The pending message context, only while it belongs to the conversation on screen (never attached to another project's chat). */
  activeContext = computed<MessageContext | null>(() => this.contextFor(this.activeConversation()));

  private contextFor(conv: { projectId?: string } | null): MessageContext | null {
    const ctx = this.messageContext();
    if (!ctx || !conv) return null;
    if (ctx.projectId && ctx.projectId !== conv.projectId) return null;
    return ctx;
  }

  ngOnInit(): void {
    const authUser = this.authStore.currentUser();
    if (authUser?.id) {
      this.currentUserId = authUser.id;
    }

    // Read discussion context from router state (passed by project/stage pages)
    const navState = (window as any).history?.state || {};
    if (navState?.messageContext) {
      this.messageContext.set(navState.messageContext as MessageContext);
    } else if (navState?.context) {
      this.messageContext.set(navState.context as MessageContext);
    }

    // Connect to WebSocket chat server
    this.chatService.connect(this.currentUserId);

    // Fetch dynamic conversations from backend API
    this.sub.add(
      this.chatService.getConversations().subscribe({
        next: (res) => {
          if (res?.success && res?.data && Array.isArray(res.data)) {
            const mappedConversations: Conversation[] = res.data.map((c: any) => {
              const partner = c.participants?.find((p: any) => p.userId !== this.currentUserId)?.user || {};
              const partnerName = partner.fullName || partner.name || c.name || 'مستخدم وسيط';
              const initials = partnerName ? partnerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'أح';
              
              return {
                id: c.id,
                projectId: c.projectId || undefined,
                name: partnerName,
                project: c.project?.title || c.project || 'مشروع وسيط',
                avatarType: c.avatarType || (c.type === 'COMPANY' ? 'co' : 'sk'),
                initials: initials,
                lastMsg: chatPreview(c.lastMessage?.content || c.lastMsg || ''),
                time: c.lastMessage?.createdAt ? new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: providerTimeZone() }) : (c.time || ''),
                unreadCount: c.unreadCount || 0,
                online: partner.isOnline || c.online || false,
                messages: c.messages || []
              };
            });

            this.conversations.set(mappedConversations);
            const pick = resolveInitialConversation(mappedConversations, this.route.snapshot.queryParams['conversationId'], this.messageContext());
            if (pick.id) {
              this.contextConversationMissing.set(false);
              this.activeConvId.set(pick.id);
              this.selectConversation(pick.id);
            } else if (pick.missing) {
              // a project was asked for but it has no conversation: open nothing else
              this.activeConvId.set('');
              this.contextConversationMissing.set(true);
              this.showChatOnMobile.set(true);
            }
          }
        },
        error: (err) => {
          console.error('[Messages] Could not fetch dynamic conversations from DB:', err);
        }
      })
    );

    // Subscribe to Query Params for seamless negotiation redirection
    this.sub.add(
      this.route.queryParams.subscribe((params) => {
        if (params['conversationId']) {
          const cid = params['conversationId'];
          this.activeConvId.set(cid);
          const existing = this.conversations().find((c) => c.id === cid);
          if (existing) {
            this.selectConversation(cid);
          }
        }
      })
    );

    // Listen for incoming real-time socket messages
    this.sub.add(
      this.chatService.newMessage$.subscribe((msg: any) => {
        if (!msg) return;
        const targetId = msg.conversationId || this.activeConvId();
        const incomingId = msg.id || Date.now();
        const incomingTempId = msg.tempId;

        const formattedMsg: MessageItem = {
          id: incomingId,
          tempId: incomingTempId,
          status: 'SENT',
          sender: msg.senderId === this.currentUserId ? 'me' : 'other',
          senderInitials: msg.senderInitials || 'ط',
          type: msg.type || 'TEXT',
          text: msg.text || msg.content || '',
          fileUrl: msg.fileUrl,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          audioDuration: msg.audioDuration,
          context: msg.context || null,
          time: msg.time || 'الآن',
          dateGroup: 'اليوم',
        };

        this.conversations.update((list) =>
          list.map((c) => {
            if (c.id === targetId) {
              // Deduplication check: verify if message already exists by ID or tempId
              const isDup = c.messages.some(
                (m) => m.id === incomingId || (incomingTempId && m.tempId === incomingTempId) || (incomingTempId && m.id === incomingTempId)
              );
              if (isDup) {
                // Update optimistic message state to SENT with persistent database ID
                const deduplicationList = c.messages.map((m) =>
                  m.id === incomingId || (incomingTempId && (m.tempId === incomingTempId || m.id === incomingTempId))
                    ? { ...m, id: incomingId, status: 'SENT' as const, tempId: undefined, context: formattedMsg.context || m.context }
                    : m
                );
                return { ...c, messages: deduplicationList };
              }

              const unread = targetId === this.activeConvId() ? 0 : c.unreadCount + 1;
              return { ...c, messages: [...c.messages, formattedMsg], lastMsg: chatPreview(formattedMsg.text), time: formattedMsg.time, unreadCount: unread };
            }
            return c;
          })
        );
        if (targetId === this.activeConvId() && formattedMsg.sender === 'other' && this.isNegotiationMsg(formattedMsg)) {
          this.loadNegotiationState(targetId, [formattedMsg]); // a new client request just arrived: ask the server what can be done now
        }
        if (targetId === this.activeConvId()) {
          this.scrollToBottom();
          this.chatService.markAsRead(targetId, this.currentUserId);
          this.chatStateService.markAsRead(targetId);
        }
      })
    );

    // Listen for real-time typing indicators
    this.sub.add(
      this.chatService.typingIndicator$.subscribe((data) => {
        if (data && data.conversationId === this.activeConvId()) {
          this.partnerIsTyping.set(data.isTyping);
          if (data.userName) this.typingUserName.set(data.userName);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.chatStateService.activeConversationId.set(null);
    if (this.audioPlayer) {
      this.audioPlayer.pause();
    }
  }

  selectConversation(id: string): void {
    const oldId = this.activeConvId();
    if (oldId && oldId !== id) {
      this.chatService.leaveRoom(oldId, this.currentUserId);
    }
    this.activeConvId.set(id);
    this.contextConversationMissing.set(false);
    this.showChatOnMobile.set(true);
    this.chatStateService.activeConversationId.set(id);
    this.chatStateService.markAsRead(id);

    // Clear unread badge
    this.conversations.update((list) =>
      list.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );

    this.chatService.joinRoom(id, this.currentUserId);
    this.chatService.markAsRead(id, this.currentUserId);
    this.scrollToBottom();

    // Fetch paginated message history dynamically
    this.fetchHistory(id);
  }

  private fetchHistory(id: string): void {
    this.sub.add(
      this.chatService.getMessages(id).subscribe({
        next: (res) => {
          if (res?.success && res?.data && res.data.length > 0) {
            const loadedMsgs: MessageItem[] = res.data.map((m: any) => ({
              id: m.id || Date.now(),
              sender: (m.senderId && this.currentUserId) ? (m.senderId === this.currentUserId ? 'me' : 'other') : (m.sender === 'me' ? 'me' : 'other'),
              senderInitials: m.senderInitials || (m.sender === 'me' ? 'مـ' : 'ط'),
              type: (m.type as any) || 'TEXT',
              text: m.text || m.content || '',
              fileUrl: m.fileUrl,
              fileName: m.fileName,
              fileSize: m.fileSize,
              audioDuration: m.audioDuration,
              context: m.context || null,
              time: m.time || 'الآن',
              dateGroup: m.dateGroup || 'اليوم',
            }));
            this.conversations.update((list) =>
              list.map((c) => (c.id === id ? { ...c, messages: loadedMsgs, unreadCount: 0 } : c))
            );
            this.scrollToBottom();
            this.loadNegotiationState(id, loadedMsgs);
          }
        },
        error: (err) => {
          console.warn('[Messages] Failed to fetch live message history:', err);
        }
      })
    );
  }

  backToListOnMobile(): void {
    this.showChatOnMobile.set(false);
  }

  onSearchInput(val: string): void {
    this.searchQuery.set(val);
  }

  sendMessage(type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' = 'TEXT', customData?: any): void {
    let text = this.newMessageText().trim();
    if (type === 'TEXT' && !text) {
      if (this.justSent) return; // double click / double Enter after a successful send: one message only
      const message = 'اكتب رسالتك قبل الإرسال';
      this.composerError.set(message);
      void focusInvalidControls(this.host.nativeElement, [{ path: 'msg-input', message }]);
      return;
    }
    this.composerError.set(null);

    const currentConv = this.activeConversation();
    if (!currentConv) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: providerTimeZone() });
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Same initials computation used for the conversation partner's name —
    // was previously a hardcoded placeholder unrelated to the actual
    // logged-in user.
    const myUser = this.authStore.currentUser();
    const myName = myUser ? `${myUser.firstName || ''} ${myUser.lastName || ''}`.trim() : '';
    const myInitials = myName ? myName.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'أح';

    const newMsg: MessageItem = {
      id: tempId,
      tempId: tempId,
      status: 'PENDING',
      sender: 'me',
      senderInitials: myInitials,
      type: type,
      text: customData?.text || text || (type === 'IMAGE' ? 'مرفق صورة' : type === 'AUDIO' ? 'رسالة صوتية' : type === 'FILE' ? `📁 ${customData?.fileName}` : ''),
      fileUrl: customData?.fileUrl,
      fileName: customData?.fileName,
      fileSize: customData?.fileSize,
      audioDuration: customData?.audioDuration,
      context: this.contextFor(currentConv),
      time: timeString,
      dateGroup: 'اليوم',
    };

    // Update conversation list locally
    this.conversations.update((list) =>
      list.map((c) =>
        c.id === currentConv.id
          ? {
              ...c,
              messages: [...c.messages, newMsg],
              lastMsg: chatPreview(newMsg.text),
              time: timeString,
            }
          : c
      )
    );

    // Emit via WebSocket & API
    const payload: ChatMessagePayload = {
      conversationId: currentConv.id,
      tempId: tempId,
      content: newMsg.text,
      type: type,
      fileUrl: newMsg.fileUrl,
      fileName: newMsg.fileName,
      fileSize: newMsg.fileSize,
      audioDuration: newMsg.audioDuration,
      context: this.contextFor(currentConv) || undefined
    };
    this.chatService.sendMessage(this.currentUserId, payload);

    if (type === 'TEXT') {
      this.justSent = true;
      this.newMessageText.set('');
      this.showEmojiPicker.set(false);
      this.messageContext.set(null);
    }
    this.scrollToBottom();
  }

  onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage('TEXT');
      return;
    }
    this.justSent = false;
    if (this.composerError()) this.composerError.set(null);
    this.emitTypingStatus();
  }

  emitTypingStatus(): void {
    this.chatService.emitTyping(this.activeConvId(), this.currentUserId, true, 'مقدم الخدمة');
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.chatService.emitTyping(this.activeConvId(), this.currentUserId, false, 'مقدم الخدمة');
    }, 2500);
  }

  // Emoji selection methods
  toggleEmojiPicker(event?: Event): void {
    if (event) event.stopPropagation();
    this.showEmojiPicker.update((v) => !v);
  }

  addEmoji(emoji: string): void {
    this.newMessageText.update((curr) => curr + emoji);
  }

  // Audio recording utility
  async startVoiceRecord(): Promise<void> {
    const started = await this.chatService.startAudioRecording();
    if (started) {
      this.notify.info('جارٍ تسجيل المقطع الصوتي...');
    } else {
      this.notify.error('تعذر الوصول للميكروفون أو البيئة لا تدعم MediaDevices');
    }
  }

  async stopVoiceRecord(): Promise<void> {
    const res = await this.chatService.stopAudioRecording();
    if (res) {
      // res.blobUrl is a local object URL (URL.createObjectURL) — it only
      // resolves inside this sender's own browser session, so persisting it
      // as the message fileUrl leaves every other participant with a bubble
      // that renders but has no playable audio. Upload the recording (same
      // uploadAttachment() call already used for image/file attachments) to
      // get a URL anyone can load, falling back to the self-contained
      // base64 data URI — never the blob URL — if the upload fails.
      this.chatService.uploadAttachment({
        fileData: res.base64,
        fileName: `voice-message-${Date.now()}.webm`,
        fileType: 'AUDIO',
        audioDuration: res.duration || 1
      }).subscribe({
        next: (uploadRes) => {
          this.sendMessage('AUDIO', {
            fileUrl: uploadRes?.data?.fileUrl || res.base64,
            audioDuration: res.duration || 1,
            text: '🎤 رسالة صوتية'
          });
          this.notify.success('تم إرسال الرسالة الصوتية بنجاح');
        },
        error: () => {
          this.sendMessage('AUDIO', {
            fileUrl: res.base64,
            audioDuration: res.duration || 1,
            text: '🎤 رسالة صوتية'
          });
          this.notify.success('تم إرسال الرسالة الصوتية بنجاح');
        }
      });
    }
  }

  cancelVoiceRecord(): void {
    this.chatService.cancelAudioRecording();
    this.notify.info('تم إلغاء التسجيل الصوتي');
  }

  // Audio Playback with Waveform
  playAudio(msg: MessageItem): void {
    if (msg.isPlaying) {
      msg.isPlaying = false;
      if (this.audioPlayer) this.audioPlayer.pause();
      return;
    }

    // Stop other audio
    this.activeConversation()?.messages.forEach((m) => (m.isPlaying = false));

    msg.isPlaying = true;
    if (msg.fileUrl && (msg.fileUrl.startsWith('blob:') || msg.fileUrl.startsWith('http') || msg.fileUrl.startsWith('data:'))) {
      if (this.audioPlayer) this.audioPlayer.pause();
      this.audioPlayer = new Audio(msg.fileUrl);
      this.audioPlayer.play().catch(() => {
        setTimeout(() => (msg.isPlaying = false), (msg.audioDuration || 5) * 1000);
      });
      this.audioPlayer.onended = () => {
        msg.isPlaying = false;
      };
    } else {
      setTimeout(() => {
        msg.isPlaying = false;
      }, (msg.audioDuration || 5) * 1000);
    }
  }

  // File and Image Attachments
  onFileSelected(event: any, type: 'IMAGE' | 'FILE'): void {
    const files = event?.target?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file) return;
      const fileSizeKB = Math.round(file.size / 1024);
      const reader = new FileReader();

      reader.onload = (e: any) => {
        const base64 = e.target.result;
        this.notify.info(`جارٍ رفع ${file.name}...`);
        
        this.chatService.uploadAttachment({
          fileData: base64,
          fileName: file.name,
          fileType: type,
          fileSize: fileSizeKB
        }).subscribe({
          next: (res) => {
            const url = res?.data?.fileUrl || base64;
            this.sendMessage(type, {
              fileUrl: url,
              fileName: file.name,
              fileSize: fileSizeKB,
              text: type === 'IMAGE' ? 'مرفق صورة للتوضيح' : file.name
            });
            this.notify.success(`تم إرفاق وإرسال الملف بنجاح`);
          },
          error: () => {
            this.sendMessage(type, {
              fileUrl: base64,
              fileName: file.name,
              fileSize: fileSizeKB,
              text: type === 'IMAGE' ? 'مرفق صورة للتوضيح' : file.name
            });
            this.notify.success(`تم إرفاق الملف: ${file.name}`);
          }
        });
      };
      reader.readAsDataURL(file);
    }
  }

  openImagePreview(url?: string): void {
    if (url) this.previewImageUrl.set(url);
  }

  closeImagePreview(): void {
    this.previewImageUrl.set(null);
  }

  downloadFile(msg: MessageItem): void {
    if (msg.fileUrl && msg.fileUrl !== '#') {
      const link = document.createElement('a');
      link.href = msg.fileUrl;
      link.download = msg.fileName || 'document.pdf';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.notify.info(`جارٍ تنزيل ${msg.fileName}...`);
    } else {
      this.notify.info(`تم البدء بتنزيل الملف: ${msg.fileName || 'مرفق'}`);
    }
  }

  formatDuration(secs?: number): string {
    if (!secs && secs !== 0) return '00:15';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  formatFileSize(kb?: number): string {
    if (!kb) return '1.8 MB';
    if (kb > 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${kb} KB`;
  }

  startMeeting(): void {
    const convId = this.activeConvId();
    if (!convId) {
      this.notify.warning('يرجى اختيار محادثة أولاً لبدء اجتماع الفيديو');
      return;
    }
    const myUser = this.authStore.currentUser();
    const myName = myUser ? `${myUser.firstName} ${myUser.lastName}` : 'مستخدم وسيط';
    this.videoCallService.startCall(convId, myName, true);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = document.getElementById('msgs-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 60);
  }

  clearContext(): void {
    this.messageContext.set(null);
  }

  /** From the "no conversation for this project" state: go back to the list (mobile); nothing is opened for the user. */
  showAllConversations(): void {
    this.showChatOnMobile.set(false);
  }

  contextLabel(ctx: MessageContext | null): string {
    if (!ctx) return '';
    if (ctx.type === 'STAGE') return 'رد بخصوص مرحلة';
    if (ctx.type === 'DELIVERY') return 'رد بخصوص تسليم';
    return 'رد بخصوص مشروع';
  }

  contextSubtitle(ctx: MessageContext | null): string {
    if (!ctx) return '';
    if (ctx.type === 'PROJECT') return 'مشروع';
    if (ctx.stageTitle) return `المرحلة: ${ctx.stageTitle}`;
    return '';
  }

  contextClick(ctx: MessageContext | null): void {
    if (!ctx?.projectId) return;
    console.log('context navigation', { role: 'provider', projectId: ctx.projectId, context: ctx });
    this.router.navigate(['/provider-overview/projects/active/progress', ctx.projectId]);
  }

  isNegotiationMsg(msg: MessageItem): boolean {
    if (!msg.text) return false;
    return msg.text.startsWith('WS_NEGOTIATION::') || msg.text.includes('"isNegotiation":true') || msg.text.includes('طلب تفاوض جديد');
  }

  getNegData(msg: MessageItem): any {
    if (!msg.text) return null;
    let data: any = null;
    if (msg.text.startsWith('WS_NEGOTIATION::')) {
      try {
        data = JSON.parse(msg.text.replace('WS_NEGOTIATION::', ''));
      } catch {
        data = null;
      }
    } else if (msg.text.includes('"isNegotiation":true')) {
      try {
        data = JSON.parse(msg.text);
      } catch {
        data = null;
      }
    }

    if (data) return data;

    const lines = msg.text.split('\n');
    let typeName = 'السعر';
    let price = '';
    let notes = '';
    lines.forEach(l => {
      if (l.includes('نوع التفاوض:')) typeName = l.replace(/.*نوع التفاوض:\s*/, '').replace(/[*_]/g, '').trim();
      if (l.includes('السعر المقترح:')) price = l.replace(/.*السعر المقترح:\s*/, '').replace(/[*_]/g, '').trim();
      if (l.includes('ملاحظات طالب الخدمة:')) notes = l.replace(/.*ملاحظات طالب الخدمة:\s*/, '').replace(/[*_]/g, '').trim();
    });

    return {
      isNegotiation: true,
      negTypeName: typeName,
      price: price,
      notes: notes,
      status: 'PENDING'
    };
  }

  getNegStatusText(status?: string): string {
    if (status === 'ACCEPTED') return 'تم القبول ✓';
    if (status === 'REJECTED') return 'تم الاعتذار';
    if (status === 'COUNTER_SENT') return 'بانتظار رد العميل';
    return 'قيد الانتظار';
  }

  // ---- negotiation: every decision below is a REAL server call; nothing is decided or "locked" locally ----
  /** The server's view of the offer behind the active conversation (null when there is no negotiation or it could not be read). */
  negState = signal<OfferNegotiationState | null>(null);
  negConfirmId = signal<string>('');
  negBusy = signal<boolean>(false);
  negError = signal<string>('');

  private loadNegotiationState(convId: string, msgs: MessageItem[]): void {
    const conv = this.conversations().find((c) => c.id === convId);
    const hasNegotiation = msgs.some((m) => this.isNegotiationMsg(m));
    this.negConfirmId.set('');
    this.negError.set('');
    if (!conv?.projectId || !hasNegotiation) {
      this.negState.set(null);
      return;
    }
    this.sub.add(
      this.offersService.getNegotiationByProject(conv.projectId).subscribe({
        next: (state) => { if (this.activeConvId() === convId) this.negState.set(state); },
        error: () => { if (this.activeConvId() === convId) this.negState.set(null); }
      })
    );
  }

  /** 'client' = the client's request card, 'counter' / 'reply' = the provider's own structured entries, 'other' = anything else. */
  negKind(msg: MessageItem): 'client' | 'counter' | 'reply' | 'accepted' {
    const data = this.getNegData(msg);
    // the CLIENT's acceptance of my counter (written by the server's accept endpoint): a closing note, never an open request
    if (msg.sender === 'other' && data?.kind === 'CLIENT_ACCEPT_COUNTER') return 'accepted';
    // provider entries only count when they are MY messages (a client cannot make a card look like one of mine)
    if (msg.sender === 'me' && data?.kind === 'PROVIDER_COUNTER') return 'counter';
    if (msg.sender === 'me' && data?.kind === 'PROVIDER_REJECT') return 'reply';
    return 'client';
  }

  /** The client's request that is still waiting for the provider (the server decides which one). */
  isOpenNegotiationRequest(msg: MessageItem): boolean {
    const request = this.negState()?.request;
    return this.negKind(msg) === 'client' && !!request && request.messageId === String(msg.id);
  }

  discussNegotiation(msg: MessageItem): void {
    const neg = this.getNegData(msg);
    if (!neg) return;
    this.newMessageText.set(`مرحباً، بخصوص طلب التفاوض على (${neg.negTypeName || 'السعر'})... `);
    const textarea = document.querySelector('.itxt') as HTMLTextAreaElement;
    if (textarea) textarea.focus();
  }

  askRejectNegotiation(msg: MessageItem): void {
    this.negError.set('');
    this.negConfirmId.set(String(msg.id));
  }

  cancelRejectNegotiation(): void {
    this.negConfirmId.set('');
  }

  confirmRejectNegotiation(msg: MessageItem): void {
    const state = this.negState();
    if (this.negBusy() || !state?.canReject || state.request?.messageId !== String(msg.id)) return;
    this.negBusy.set(true);
    this.negError.set('');
    this.offersService.rejectNegotiation(state.offerId, String(msg.id)).subscribe({
      next: () => {
        this.negBusy.set(false);
        this.negConfirmId.set('');
        this.notify.success('تم الاعتذار عن طلب التفاوض، ويبقى عرضك بشروطه الأصلية');
        const id = this.activeConvId();
        if (id) this.fetchHistory(id); // shows the reply entry and refreshes the state
      },
      error: (err) => {
        this.negBusy.set(false);
        this.negError.set(err?.error?.message || 'تعذر تنفيذ الإجراء. حاول مرة أخرى.');
      }
    });
  }

  /** The counter-offer form lives on the negotiation page of the offer. */
  openOfferNegotiation(): void {
    const state = this.negState();
    if (state) this.router.navigate(['/provider-overview/offers', state.offerId, 'negotiate']);
  }
}
