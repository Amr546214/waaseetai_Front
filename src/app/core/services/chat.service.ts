import { Injectable, inject, signal, PLATFORM_ID, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject, tap } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { ChatStateService } from './chat-state.service';
import { NotificationSoundService } from './notification-sound.service';
import { AuthStore } from '../store/auth.store';

export interface MessageContext {
  type: 'PROJECT' | 'STAGE' | 'DELIVERY';
  projectId?: string;
  projectTitle?: string;
  stageId?: string;
  stageTitle?: string;
  stageNumber?: number;
  deliveryId?: string;
  amount?: number;
}

export interface ChatMessagePayload {
  conversationId: string;
  tempId?: string;
  content?: string;
  type?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'FILE' | 'SYSTEM';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  audioDuration?: number;
  context?: MessageContext | null;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private chatStateService = inject(ChatStateService);
  private notificationSoundService = inject(NotificationSoundService);
  private ngZone = inject(NgZone);
  private authStore = inject(AuthStore);

  private readonly apiUrl = `${environment.url_api}/chat`;
  private socket: Socket | null = null;

  // Real-time signals & observables
  public newMessage$ = new Subject<any>();
  public typingIndicator$ = new Subject<{ conversationId: string; userId: string; userName: string; isTyping: boolean }>();
  public conversationUpdated$ = new Subject<any>();
  public socketConnected$ = new Subject<Socket>();
  public chatError$ = new Subject<{ message: string }>();

  // Audio recording reactive signals
  public isRecording = signal<boolean>(false);
  public recordingTime = signal<number>(0);
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingInterval: any = null;
  private audioStream: MediaStream | null = null;

  public getSocket() {
    return this.socket;
  }

  /**
   * Initialize Socket.IO connection for authenticated user
   */
  public connect(userId: string): void {
    if (!this.isBrowser) return;

    const token = this.authStore.token();

    if (this.socket) {
      this.socket.auth = token ? { token } : {};
      if (!this.socket.connected) {
        this.socket.connect();
      }
      if (userId) {
        console.log(`👤 Socket active, joining user room: user_${userId}`);
        this.socket.emit('join_user_room', userId);
      }
      this.socketConnected$.next(this.socket);
      return;
    }

    this.socket = io(environment.socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      auth: token ? { token } : {}
    });

    this.socket.on('connect', () => {
      this.ngZone.run(() => {
        console.log('🔌 Chat Socket Connected:', this.socket?.id);
        if (userId) {
          this.socket?.emit('join_user_room', userId);
        }
        if (this.socket) {
          this.socketConnected$.next(this.socket);
        }
      });
    });

    this.socket.on('new_message', (msg: any) => {
      this.ngZone.run(() => {
        if (msg) {
          const activeConv = this.chatStateService.activeConversationId();
          const isCurrentActive = activeConv === msg.conversationId;
          
          // Play audio alert and trigger browser notification if from partner
          this.notificationSoundService.handleNewMessageAlert(msg, userId, isCurrentActive);

          // Increment global unread badges if conversation not open right now
          if (msg.conversationId && (msg.senderId !== userId && msg.sender !== 'me') && !isCurrentActive) {
            this.chatStateService.incrementUnread(msg.conversationId);
          }
        }
        this.newMessage$.next(msg);
      });
    });

    this.socket.on('typing_indicator', (data: any) => {
      this.ngZone.run(() => {
        this.typingIndicator$.next(data);
      });
    });

    this.socket.on('conversation_list_update', (data: any) => {
      this.ngZone.run(() => {
        if (data?.conversationId) {
          const activeConv = this.chatStateService.activeConversationId();
          if (activeConv !== data.conversationId) {
            this.chatStateService.incrementUnread(data.conversationId);
          }
        }
        this.conversationUpdated$.next(data);
      });
    });

    this.socket.on('chat_error', (error: any) => {
      this.ngZone.run(() => {
        this.chatError$.next({ message: error?.message || 'تعذر تنفيذ عملية المحادثة' });
      });
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Socket room lifecycle methods
   */
  public joinRoom(conversationId: string, userId: string): void {
    if (this.socket && conversationId && userId) {
      this.socket.emit('join_conversation', { conversationId, userId });
    }
  }

  public leaveRoom(conversationId: string, userId: string): void {
    if (this.socket && conversationId && userId) {
      this.socket.emit('leave_conversation', { conversationId, userId });
    }
  }

  public sendSocketMessage(senderId: string, payload: ChatMessagePayload): void {
    if (this.socket) {
      this.socket.emit('send_message', { senderId, data: payload });
    }
  }

  public sendMessage(senderId: string, payload: ChatMessagePayload): void {
    this.sendSocketMessage(senderId, payload);
  }

  public emitTyping(conversationId: string, userId: string, isTyping: boolean, userName?: string): void {
    if (this.socket && conversationId && userId) {
      this.socket.emit('typing_status', { conversationId, userId, isTyping, userName });
    }
  }

  public markAsRead(conversationId: string, userId: string): void {
    if (this.socket && conversationId && userId) {
      this.socket.emit('mark_as_read', { conversationId, userId });
    }
    if (conversationId) {
      this.chatStateService.markAsRead(conversationId);
    }
  }

  /**
   * REST API endpoints
   */
  public initiateConversation(payload: { projectId: string; providerId?: string; clientId?: string; offerId?: string; negotiationPayload?: any }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/conversations/initiate`, payload);
  }

  public getConversations(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/conversations`).pipe(
      tap((res) => {
        if (res?.success && res?.data) {
          this.chatStateService.initFromConversations(res.data);
        }
      })
    );
  }

  public getMessages(conversationId: string, page: number = 1, limit: number = 20): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
  }

  public uploadAttachment(payload: { fileData: string; fileName: string; fileType: 'IMAGE' | 'FILE' | 'AUDIO'; fileSize?: number; audioDuration?: number }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/upload`, payload);
  }

  /**
   * Audio Voice Note Recording using MediaRecorder Web API
   */
  public async startAudioRecording(): Promise<boolean> {
    if (!this.isBrowser || !('mediaDevices' in navigator)) {
      console.warn('[ChatService] MediaDevices not supported in this environment');
      return false;
    }

    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.audioStream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.recordingTime.set(0);

      this.recordingInterval = setInterval(() => {
        this.recordingTime.update(val => val + 1);
      }, 1000);

      return true;
    } catch (err) {
      console.error('[ChatService] Error starting audio recording:', err);
      return false;
    }
  }

  public stopAudioRecording(): Promise<{ base64: string; blobUrl: string; duration: number } | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecording()) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        clearInterval(this.recordingInterval);
        const duration = this.recordingTime();
        this.isRecording.set(false);
        this.recordingTime.set(0);

        // Turn off all audio tracks to extinguish mic recording light
        this.audioStream?.getTracks().forEach(track => track.stop());

        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const blobUrl = URL.createObjectURL(audioBlob);

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve({ base64, blobUrl, duration });
        };
        reader.onerror = () => resolve(null);
      };

      this.mediaRecorder.stop();
    });
  }

  public cancelAudioRecording(): void {
    if (this.mediaRecorder && this.isRecording()) {
      clearInterval(this.recordingInterval);
      this.mediaRecorder.stop();
      this.audioStream?.getTracks().forEach(track => track.stop());
      this.isRecording.set(false);
      this.recordingTime.set(0);
      this.audioChunks = [];
    }
  }
}
