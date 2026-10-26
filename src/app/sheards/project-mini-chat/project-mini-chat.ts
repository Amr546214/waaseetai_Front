import { formatWsDate } from '../../shared/ws-date/ws-date.pipe';
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { ChatService, ChatMessagePayload } from '../../core/services/chat.service';
import { ChatStateService } from '../../core/services/chat-state.service';

interface MiniChatMessage {
  id: string;
  tempId?: string;
  senderId?: string;
  senderName: string;
  senderInitial: string;
  isMe: boolean;
  content: string;
  time: string | Date;
  fileUrl?: string;
  fileName?: string;
  status?: 'PENDING' | 'SENT' | 'READ';
  isEvent?: boolean;
}

@Component({
  selector: 'app-project-mini-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './project-mini-chat.html',
  styleUrl: './project-mini-chat.css'
})
export class ProjectMiniChat implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) conversationId: string | null = null;
  @Input() initialMessages: any[] = [];
  @Input({ required: true }) fullChatRoute = '';
  @Input() partnerName = 'الطرف الآخر';
  /** The project's contract id: its own unread badge is cleared when the tab is open. */
  @Input() contractId: string | null = null;
  /** True while the project still uses its old shared room (before the approved backfill); only then is the general-messages link shown. */
  @Input() legacyShared = false;
  @ViewChild('messagesViewport') private messagesViewport?: ElementRef<HTMLElement>;

  private chatService = inject(ChatService);
  private authStore = inject(AuthStore);
  private chatState = inject(ChatStateService);
  private subscriptions = new Subscription();
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  currentUserId = '';

  messages = signal<MiniChatMessage[]>([]);
  draft = '';
  loading = signal(false);
  sending = signal(false);
  error = signal('');
  partnerTyping = signal(false);

  ngOnInit(): void {
    this.currentUserId = this.authStore.currentUser()?.id || '';
    this.messages.set((this.initialMessages || []).map(message => this.normalizeMessage(message)));
    if (!this.conversationId || !this.currentUserId) return;

    this.chatService.connect(this.currentUserId);
    this.chatService.joinRoom(this.conversationId, this.currentUserId);
    this.chatService.markAsRead(this.conversationId, this.currentUserId);
    this.chatState.activeConversationId.set(this.conversationId);
    if (this.contractId) this.chatState.clearProjectUnread(this.contractId);
    this.loadHistory();

    this.subscriptions.add(this.chatService.socketConnected$.subscribe(() => {
      if (this.conversationId && this.currentUserId) this.chatService.joinRoom(this.conversationId, this.currentUserId);
    }));

    this.subscriptions.add(this.chatService.newMessage$.subscribe(message => {
      if (!message || message.conversationId !== this.conversationId) return;
      this.mergeMessage(this.normalizeMessage(message));
      this.sending.set(false);
      this.chatService.markAsRead(this.conversationId!, this.currentUserId);
      this.scrollToBottom();
    }));
    // project events (amendment lifecycle) reach the tab even before the room join is acknowledged; merged by id, never twice
    this.subscriptions.add(this.chatService.projectEvent$.subscribe(event => {
      if (!event || event.conversationId !== this.conversationId) return;
      this.mergeMessage(this.normalizeMessage(event));
      this.scrollToBottom();
    }));
    this.subscriptions.add(this.chatService.typingIndicator$.subscribe(event => {
      if (event.conversationId === this.conversationId && event.userId !== this.currentUserId) {
        this.partnerTyping.set(event.isTyping);
      }
    }));
    this.subscriptions.add(this.chatService.chatError$.subscribe(event => {
      this.sending.set(false);
      this.error.set(event.message);
    }));
  }

  ngAfterViewInit(): void { this.scrollToBottom(); }

  ngOnDestroy(): void {
    if (this.typingTimer) clearTimeout(this.typingTimer);
    if (this.conversationId && this.currentUserId) {
      this.chatService.emitTyping(this.conversationId, this.currentUserId, false);
      this.chatService.leaveRoom(this.conversationId, this.currentUserId);
      if (this.chatState.activeConversationId() === this.conversationId) this.chatState.activeConversationId.set(null);
    }
    this.subscriptions.unsubscribe();
  }

  send(): void {
    const content = this.draft.trim();
    if (!content || !this.conversationId || !this.currentUserId || this.sending()) return;
    const tempId = `mini_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const payload: ChatMessagePayload = { conversationId: this.conversationId, tempId, content, type: 'TEXT' };
    this.messages.update(items => [...items, {
      id: tempId, tempId, senderId: this.currentUserId, senderName: 'أنت', senderInitial: 'أ',
      isMe: true, content, time: new Date(), status: 'PENDING'
    }]);
    this.draft = '';
    this.error.set('');
    this.sending.set(true);
    this.chatService.emitTyping(this.conversationId, this.currentUserId, false);
    this.chatService.sendMessage(this.currentUserId, payload);
    this.scrollToBottom();
  }

  /** Attach a file/image to the project conversation: uploaded for THIS conversation (the server checks membership), then sent as a message. */
  attachError = signal('');
  uploading = signal(false);
  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.conversationId || !this.currentUserId || this.uploading()) return;
    this.attachError.set('');
    if (file.size > 25 * 1024 * 1024) { this.attachError.set('حجم الملف يتجاوز الحد الأقصى 25 ميغابايت'); return; }
    this.uploading.set(true);
    const reader = new FileReader();
    reader.onerror = () => { this.uploading.set(false); this.attachError.set('تعذر قراءة الملف'); };
    reader.onload = () => {
      const isImage = file.type.startsWith('image/');
      this.subscriptions.add(this.chatService.uploadAttachment({ conversationId: this.conversationId!, fileData: String(reader.result), fileName: file.name, fileType: isImage ? 'IMAGE' : 'FILE', fileSize: file.size }).subscribe({
        next: res => {
          this.uploading.set(false);
          const data = res?.data;
          if (!data?.fileUrl) { this.attachError.set('تعذر رفع الملف'); return; }
          const tempId = `mini_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          this.sending.set(true);
          this.chatService.sendMessage(this.currentUserId, { conversationId: this.conversationId!, tempId, type: isImage ? 'IMAGE' : 'FILE', fileUrl: data.fileUrl, fileName: data.fileName || file.name, fileSize: data.fileSize });
        },
        error: err => { this.uploading.set(false); this.attachError.set(err?.error?.message || 'تعذر رفع الملف'); }
      }));
    };
    reader.readAsDataURL(file);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
      return;
    }
  }

  onInput(): void { this.emitTyping(); }

  formatTime(value: string | Date): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || 'الآن');
    return formatWsDate(date, 'time');
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.subscriptions.add(this.chatService.getMessages(this.conversationId!, 1, 50).subscribe({
      next: response => {
        if (response?.success && Array.isArray(response.data)) {
          this.messages.set(response.data.map((message: any) => this.normalizeMessage(message)));
        }
        this.loading.set(false);
        this.scrollToBottom();
      },
      error: event => {
        this.loading.set(false);
        this.error.set(event.error?.message || 'تعذر تحميل الرسائل');
      }
    }));
  }

  private normalizeMessage(message: any): MiniChatMessage {
    const senderId = message.senderId;
    const isMe = senderId ? senderId === this.currentUserId : Boolean(message.isMe ?? message.sender === 'me');
    const senderName = isMe ? 'أنت' : (message.senderName || this.partnerName);
    return {
      id: String(message.id || message.tempId || Date.now()), tempId: message.tempId, senderId,
      senderName, senderInitial: message.senderInitial || message.senderInitials || senderName.charAt(0) || 'م', isMe,
      isEvent: message.type === 'SYSTEM' || message.isEvent === true,
      content: message.content ?? message.text ?? '', time: message.createdAt || message.time || new Date(),
      fileUrl: message.fileUrl, fileName: message.fileName, status: message.status || 'SENT'
    };
  }

  private mergeMessage(incoming: MiniChatMessage): void {
    this.messages.update(items => {
      const index = items.findIndex(item => item.id === incoming.id || (incoming.tempId && (item.tempId === incoming.tempId || item.id === incoming.tempId)));
      if (index < 0) return [...items, incoming];
      const next = [...items];
      next[index] = { ...next[index], ...incoming, status: 'SENT', tempId: undefined };
      return next;
    });
  }

  private emitTyping(): void {
    if (!this.conversationId || !this.currentUserId) return;
    const name = this.authStore.currentUser()?.firstName || 'مستخدم';
    this.chatService.emitTyping(this.conversationId, this.currentUserId, true, name);
    if (this.typingTimer) clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      this.chatService.emitTyping(this.conversationId!, this.currentUserId, false, name);
    }, 1800);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const element = this.messagesViewport?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }
}
