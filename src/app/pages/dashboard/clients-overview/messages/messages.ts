import { Component, computed, signal, inject, OnInit, OnDestroy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService, ChatMessagePayload } from '../../../../core/services/chat.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { ChatStateService } from '../../../../core/services/chat-state.service';
import { VideoCallService } from '../../../../core/services/video-call.service';

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
  time: string;
  dateGroup: string;
  isPlaying?: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  project: string;
  avatarType: 'sk' | 'pr' | 'co';
  initials: string;
  lastMsg: string;
  time: string;
  unreadCount: number;
  online: boolean;
  messages: MessageItem[];
}

@Component({
  selector: 'app-client-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messages.html',
  styleUrl: './messages.css',
  encapsulation: ViewEncapsulation.None,
})
export class ClientMessages implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public chatService = inject(ChatService);
  private authStore = inject(AuthStore);
  private chatStateService = inject(ChatStateService);
  private videoCallService = inject(VideoCallService);
  private sub = new Subscription();

  private currentUserId = 'client_001';
  private typingTimeout: any = null;
  private audioPlayer: HTMLAudioElement | null = null;

  searchQuery = signal<string>('');
  activeConvId = signal<string>('');
  showChatOnMobile = signal<boolean>(false);
  newMessageText = signal<string>('');
  toastMessage = signal<string>('');

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
    return (
      this.conversations().find((c) => c.id === activeId) ||
      (this.conversations().length > 0 ? this.conversations()[0] : null)
    );
  });

  ngOnInit(): void {
    const authUser = this.authStore.currentUser();
    if (authUser?.id) {
      this.currentUserId = authUser.id;
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
              const initials = partnerName ? partnerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : 'ط';
              
              return {
                id: c.id,
                name: partnerName,
                project: c.project?.title || c.project || 'مشروع وسيط',
                avatarType: c.avatarType || (c.type === 'COMPANY' ? 'co' : 'sk'),
                initials: initials,
                lastMsg: c.lastMessage?.content || c.lastMsg || '',
                time: c.lastMessage?.createdAt ? new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (c.time || ''),
                unreadCount: c.unreadCount || 0,
                online: partner.isOnline || c.online || false,
                messages: c.messages || []
              };
            });

            this.conversations.set(mappedConversations);
            if (mappedConversations.length > 0) {
              const activeParam = this.route.snapshot.queryParams['conversationId'];
              const target = mappedConversations.find((c) => c.id === activeParam) ? activeParam : mappedConversations[0].id;
              this.activeConvId.set(target);
              this.selectConversation(target);
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
          senderInitials: msg.senderInitials || 'مـ',
          type: msg.type || 'TEXT',
          text: msg.text || msg.content || '',
          fileUrl: msg.fileUrl,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          audioDuration: msg.audioDuration,
          time: msg.time || 'الآن',
          dateGroup: 'اليوم',
        };

        this.conversations.update((list) =>
          list.map((c) => {
            if (c.id === targetId) {
              const isDup = c.messages.some(
                (m) => m.id === incomingId || (incomingTempId && m.tempId === incomingTempId) || (incomingTempId && m.id === incomingTempId)
              );
              if (isDup) {
                const deduplicationList = c.messages.map((m) =>
                  m.id === incomingId || (incomingTempId && (m.tempId === incomingTempId || m.id === incomingTempId))
                    ? { ...m, id: incomingId, status: 'SENT' as const, tempId: undefined }
                    : m
                );
                return { ...c, messages: deduplicationList };
              }

              const unread = targetId === this.activeConvId() ? 0 : c.unreadCount + 1;
              return { ...c, messages: [...c.messages, formattedMsg], lastMsg: formattedMsg.text, time: formattedMsg.time, unreadCount: unread };
            }
            return c;
          })
        );
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
    this.sub.add(
      this.chatService.getMessages(id).subscribe({
        next: (res) => {
          if (res?.success && res?.data && res.data.length > 0) {
            const loadedMsgs: MessageItem[] = res.data.map((m: any) => ({
              id: m.id || Date.now(),
              sender: (m.senderId && this.currentUserId) ? (m.senderId === this.currentUserId ? 'me' : 'other') : (m.sender === 'me' ? 'me' : 'other'),
              senderInitials: m.senderInitials || (m.sender === 'me' ? 'أن' : 'مـ'),
              type: (m.type as any) || 'TEXT',
              text: m.text || m.content || '',
              fileUrl: m.fileUrl,
              fileName: m.fileName,
              fileSize: m.fileSize,
              audioDuration: m.audioDuration,
              time: m.time || 'الآن',
              dateGroup: m.dateGroup || 'اليوم',
            }));
            this.conversations.update((list) =>
              list.map((c) => (c.id === id ? { ...c, messages: loadedMsgs, unreadCount: 0 } : c))
            );
            this.scrollToBottom();
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
    if (type === 'TEXT' && !text) return;

    const currentConv = this.activeConversation();
    if (!currentConv) return;

    const now = new Date();
    const timeString = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newMsg: MessageItem = {
      id: tempId,
      tempId: tempId,
      status: 'PENDING',
      sender: 'me',
      senderInitials: 'أن',
      type: type,
      text: customData?.text || text || (type === 'IMAGE' ? 'مرفق صورة' : type === 'AUDIO' ? 'رسالة صوتية' : type === 'FILE' ? `📁 ${customData?.fileName}` : ''),
      fileUrl: customData?.fileUrl,
      fileName: customData?.fileName,
      fileSize: customData?.fileSize,
      audioDuration: customData?.audioDuration,
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
              lastMsg: newMsg.text,
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
      audioDuration: newMsg.audioDuration
    };
    this.chatService.sendMessage(this.currentUserId, payload);

    if (type === 'TEXT') {
      this.newMessageText.set('');
      this.showEmojiPicker.set(false);
    }
    this.scrollToBottom();
  }

  onInputKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage('TEXT');
    }
    this.emitTypingStatus();
  }

  emitTypingStatus(): void {
    this.chatService.emitTyping(this.activeConvId(), this.currentUserId, true, 'طالب الخدمة');
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.chatService.emitTyping(this.activeConvId(), this.currentUserId, false, 'طالب الخدمة');
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
      this.showToast('🎙️ جارٍ تسجيل المقطع الصوتي...');
    } else {
      this.showToast('⚠️ تعذر الوصول للميكروفون أو البيئة لا تدعم MediaDevices');
    }
  }

  async stopVoiceRecord(): Promise<void> {
    const res = await this.chatService.stopAudioRecording();
    if (res) {
      this.sendMessage('AUDIO', {
        fileUrl: res.blobUrl || res.base64,
        audioDuration: res.duration || 1,
        text: '🎤 رسالة صوتية'
      });
      this.showToast('✅ تم إرسال الرسالة الصوتية بنجاح');
    }
  }

  cancelVoiceRecord(): void {
    this.chatService.cancelAudioRecording();
    this.showToast('🗑️ تم إلغاء التسجيل الصوتي');
  }

  // Audio Playback with Waveform
  playAudio(msg: MessageItem): void {
    if (msg.isPlaying) {
      msg.isPlaying = false;
      if (this.audioPlayer) this.audioPlayer.pause();
      return;
    }

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
        this.showToast(`⌛ جارٍ رفع ${file.name}...`);
        
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
            this.showToast(`✅ تم إرفاق وإرسال الملف بنجاح`);
          },
          error: () => {
            this.sendMessage(type, {
              fileUrl: base64,
              fileName: file.name,
              fileSize: fileSizeKB,
              text: type === 'IMAGE' ? 'مرفق صورة للتوضيح' : file.name
            });
            this.showToast(`✅ تم إرفاق الملف: ${file.name}`);
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
      this.showToast(`⌛ جارٍ تنزيل ${msg.fileName}...`);
    } else {
      this.showToast(`📥 تم البدء بتنزيل الملف: ${msg.fileName || 'مرفق'}`);
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
      this.showToast('⚠️ يرجى اختيار محادثة أولاً لبدء اجتماع الفيديو');
      return;
    }
    const myUser = this.authStore.currentUser();
    const myName = myUser ? `${myUser.firstName} ${myUser.lastName}` : 'مستخدم وسيط';
    this.videoCallService.startCall(convId, myName, true);
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      if (this.toastMessage() === msg) {
        this.toastMessage.set('');
      }
    }, 3800);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = document.getElementById('msgs-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 60);
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

    if (data) {
      if ((msg as any).negStatus) {
        data.status = (msg as any).negStatus;
      }
      return data;
    }

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
      status: (msg as any).negStatus || 'PENDING'
    };
  }

  getNegStatusText(status?: string): string {
    if (status === 'ACCEPTED') return 'تم القبول ✓';
    if (status === 'REJECTED') return 'تم الرفض ✕';
    return 'قيد الانتظار';
  }

  respondNegotiation(msg: MessageItem, action: 'ACCEPTED' | 'REJECTED' | 'DISCUSS'): void {
    const neg = this.getNegData(msg);
    if (!neg) return;

    if (action === 'DISCUSS') {
      this.newMessageText.set(`مرحباً، بخصوص طلب التفاوض على (${neg.negTypeName || 'السعر'})... `);
      const textarea = document.querySelector('.itxt') as HTMLTextAreaElement;
      if (textarea) textarea.focus();
      return;
    }

    // Check if decision has already been taken
    if (neg.status === 'ACCEPTED' || neg.status === 'REJECTED') {
      this.showToast('⚠️ لقد تم اتخاذ القرار بخصوص هذا التفاوض مسبقاً ولا يمكن تغييره.');
      return;
    }

    // Lock the decision locally and update the message payload text
    (msg as any).negStatus = action;
    neg.status = action;

    if (msg.text.startsWith('WS_NEGOTIATION::')) {
      try {
        const parsed = JSON.parse(msg.text.replace('WS_NEGOTIATION::', ''));
        parsed.status = action;
        msg.text = 'WS_NEGOTIATION::' + JSON.stringify(parsed);
      } catch (e) {}
    } else if (msg.text.includes('"isNegotiation":true')) {
      try {
        const parsed = JSON.parse(msg.text);
        parsed.status = action;
        msg.text = JSON.stringify(parsed);
      } catch (e) {}
    }

    if (action === 'ACCEPTED') {
      const text = `✅ **تم قبول طلب التفاوض**\nيُسعدني قبول عرض التفاوض الخاص بك (${neg?.price ? neg.price + ' ريال' : ''}). تم اعتماد الشروط للبدء في تنفيذ المشروع.`;
      this.newMessageText.set(text);
      this.sendMessage('TEXT');
      this.showToast('✅ تم قبول طلب التفاوض بنجاح وتثبيت القرار');
    } else if (action === 'REJECTED') {
      const text = `❌ **اعتذار عن طلب التفاوض**\nشكراً لتواصلك، لكن يتعذر عليّ التنازل عن السعر أو المدة المحددة مسبقاً لضمان أفضل جودة للتنفيذ.`;
      this.newMessageText.set(text);
      this.sendMessage('TEXT');
      this.showToast('ℹ️ تم إرسال رد الاعتذار وتثبيت القرار');
    }
  }
}
