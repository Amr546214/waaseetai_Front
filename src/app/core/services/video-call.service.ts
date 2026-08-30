import { Injectable, signal, inject, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ChatService } from './chat.service';
import { AuthStore } from '../store/auth.store';
import { NotificationSoundService } from './notification-sound.service';

export type CallState = 'IDLE' | 'CALLING' | 'INCOMING' | 'CONNECTED' | 'ENDED';

export interface CallerData {
  conversationId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  offer?: any;
  isVideo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VideoCallService {
  private chatService = inject(ChatService);
  private authStore = inject(AuthStore);
  private soundService = inject(NotificationSoundService);
  private ngZone = inject(NgZone);

  // Reactive State Signals & RxJS Subject
  callState = signal<CallState>('IDLE');
  callState$ = new BehaviorSubject<CallState>('IDLE');
  callerInfo = signal<CallerData | null>(null);

  public setCallState(state: CallState): void {
    this.callState.set(state);
    this.callState$.next(state);
  }
  
  isMicMuted = signal<boolean>(false);
  isCameraOff = signal<boolean>(false);
  isScreenSharing = signal<boolean>(false);
  
  // Reactive Stream Signals for UI binding
  localStreamSignal = signal<MediaStream | null>(null);
  remoteStreamSignal = signal<MediaStream | null>(null);
  remoteHasVideo = signal<boolean>(false);

  formattedDuration = signal<string>('00:00');

  // WebRTC core variables
  private peerConnection: RTCPeerConnection | null = null;
  public localStream: MediaStream | null = null;
  public remoteStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  private isRemoteDescriptionSet = false;

  private durationTimer: any = null;
  private durationSeconds = 0;
  private currentUserId = '';

  private readonly iceServers: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' }
    ]
  };

  private listenersBound = false;
  private iceCandidatesQueue: any[] = [];

  constructor() {
    this.chatService.socketConnected$.subscribe(() => {
      this.ensureSocketListeners();
    });
    this.ensureSocketListeners();
  }

  public ensureSocketListeners(): void {
    const socket = this.chatService.getSocket();
    if (!socket || this.listenersBound) return;

    this.listenersBound = true;
    console.log('📹 [VideoCallService] WebRTC Video Call listeners registered on active socket:', socket.id);

    // 1. Incoming Call Event
    socket.off('incoming_call');
    socket.on('incoming_call', (data: CallerData) => {
      this.ngZone.run(() => {
        const user = this.authStore.currentUser();
        this.currentUserId = user?.id || 'user_me';

        // Ignore calls initiated by myself
        if (data.callerId === this.currentUserId) return;

        console.log('📞 [VideoCallService] INCOMING CALL RECEIVED:', data);
        if (this.callState() === 'IDLE') {
          this.callerInfo.set(data);
          this.setCallState('INCOMING');
          this.soundService.handleNewMessageAlert({
            senderId: data.callerId,
            senderName: data.callerName,
            text: `📹 مكالمة فيديو واردة من ${data.callerName}`
          }, this.currentUserId, false);
        }
      });
    });

    // 2. Call Accepted Event (Caller side)
    socket.off('call_accepted');
    socket.on('call_accepted', async (data: { conversationId: string; answer: any; responderId: string }) => {
      this.ngZone.run(async () => {
        const user = this.authStore.currentUser();
        this.currentUserId = user?.id || 'user_me';
        if (data.responderId === this.currentUserId) return;

        console.log('✅ [VideoCallService] CALL ACCEPTED BY PEER:', data);
        if (this.peerConnection && data.answer) {
          try {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            this.isRemoteDescriptionSet = true;
            await this.processQueuedIceCandidates();
            this.setCallState('CONNECTED');
            this.startTimer();
          } catch (err) {
            console.error('[VideoCallService] Error setting remote description for answer:', err);
          }
        }
      });
    });

    // 3. ICE Candidate Event
    socket.off('ice_candidate');
    socket.on('ice_candidate', async (data: { conversationId: string; candidate: any; senderId: string }) => {
      this.ngZone.run(async () => {
        const user = this.authStore.currentUser();
        this.currentUserId = user?.id || 'user_me';
        if (data.senderId === this.currentUserId) return;

        if (data.candidate) {
          if (this.peerConnection && this.isRemoteDescriptionSet && this.peerConnection.remoteDescription) {
            await this.addIceCandidateSafely(data.candidate);
          } else {
            console.log('📦 [VideoCallService] Queuing ICE candidate until remote description is fully set');
            this.iceCandidatesQueue.push(data.candidate);
          }
        }
      });
    });

    // 4. Call Ended Event
    socket.off('call_ended');
    socket.on('call_ended', (data: { conversationId: string; senderId: string }) => {
      this.ngZone.run(() => {
        const user = this.authStore.currentUser();
        this.currentUserId = user?.id || 'user_me';
        if (data.senderId === this.currentUserId) return;
        console.log('🛑 [VideoCallService] CALL ENDED BY PEER:', data);
        this.endCall(false);
      });
    });
  }

  private async processQueuedIceCandidates(): Promise<void> {
    if (!this.peerConnection || !this.iceCandidatesQueue.length) return;
    console.log(`📦 [VideoCallService] Flushing ${this.iceCandidatesQueue.length} queued ICE candidates`);
    while (this.iceCandidatesQueue.length > 0) {
      const candidate = this.iceCandidatesQueue.shift();
      if (candidate) {
        await this.addIceCandidateSafely(candidate);
      }
    }
  }

  private async addIceCandidateSafely(candidateData: any): Promise<void> {
    if (!this.peerConnection || !candidateData) return;
    try {
      const initParam = typeof candidateData === 'string' ? JSON.parse(candidateData) : candidateData;
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(initParam));
    } catch (err) {
      console.warn('[VideoCallService] Non-fatal ICE candidate handling error:', err);
    }
  }

  /**
   * Safe media stream requester with instant clean fallback chain (Camera -> Microphone -> Synthetic Stream)
   */
  private async requestMediaStream(isVideo: boolean): Promise<MediaStream> {
    // 1. Try video + audio if requested
    if (isVideo) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true
        });
        return stream;
      } catch (err: any) {
        console.log('ℹ️ [VideoCallService] Video camera stream unavailable, trying audio fallback:', err?.message || err);
        this.isCameraOff.set(true);
      }
    }

    // 2. Try Audio-Only stream
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
      return audioStream;
    } catch (audioErr: any) {
      console.log('ℹ️ [VideoCallService] Physical microphone unavailable, using synthetic audio stream:', audioErr?.message || audioErr);
      this.isCameraOff.set(true);
      this.isMicMuted.set(true);
      return this.createSyntheticAudioStream();
    }
  }

  /**
   * Generates a silent synthetic Web Audio stream for environments without physical microphones
   */
  private createSyntheticAudioStream(): MediaStream {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const dest = ctx.createMediaStreamDestination();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0; // Silent gain
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        return dest.stream;
      }
    } catch (e) {
      console.warn('[VideoCallService] Failed to create synthetic audio stream:', e);
    }
    return new MediaStream();
  }

  /**
   * Start an outgoing video call
   */
  async startCall(conversationId: string, callerName = 'أنت', isVideo = true): Promise<void> {
    this.ensureSocketListeners();
    const socket = this.chatService.getSocket();
    if (!socket) {
      console.warn('[VideoCallService] Socket not available to start call');
      return;
    }

    const user = this.authStore.currentUser();
    this.currentUserId = user?.id || 'user_me';

    this.callerInfo.set({
      conversationId,
      callerId: this.currentUserId,
      callerName,
      isVideo
    });
    this.setCallState('CALLING');

    try {
      // 1. Get user media (with fallback)
      this.localStream = await this.requestMediaStream(isVideo);
      this.localStreamSignal.set(this.localStream);

      // 2. Setup RTCPeerConnection
      this.createPeerConnection(conversationId);

      // 3. Add local tracks to PeerConnection
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream && this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // 4. Create offer SDP
      if (this.peerConnection) {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        // 5. Emit call_user event via socket
        socket.emit('call_user', {
          conversationId,
          callerId: this.currentUserId,
          callerName,
          offer,
          isVideo
        });
      }

      this.soundService.playPopSound();
    } catch (err: any) {
      console.error('[VideoCallService] Error starting call:', err);
      this.endCall(false);
    }
  }

  /**
   * Accept an incoming video call
   */
  async acceptCall(): Promise<void> {
    const info = this.callerInfo();
    const socket = this.chatService.getSocket();
    if (!info || !socket || !info.offer) return;

    const user = this.authStore.currentUser();
    this.currentUserId = user?.id || 'user_me';

    try {
      // 1. Get local media (with fallback)
      this.localStream = await this.requestMediaStream(info.isVideo !== false);
      this.localStreamSignal.set(this.localStream);

      // 2. Setup RTCPeerConnection
      this.createPeerConnection(info.conversationId);

      // 3. Add local tracks
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream && this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream);
        }
      });

      // 4. Set remote offer SDP
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(info.offer));
        this.isRemoteDescriptionSet = true;
        await this.processQueuedIceCandidates();

        // 5. Create SDP Answer
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        // 6. Emit answer_call event
        socket.emit('answer_call', {
          conversationId: info.conversationId,
          answer,
          responderId: this.currentUserId
        });
      }

      this.setCallState('CONNECTED');
      this.startTimer();
    } catch (err: any) {
      console.error('[VideoCallService] Error accepting call:', err);
      this.endCall(true);
    }
  }

  /**
   * Decline an incoming video call
   */
  declineCall(): void {
    this.endCall(true);
  }

  /**
   * End current call and cleanup all media tracks
   */
  endCall(emitSocket = true): void {
    const info = this.callerInfo();
    const socket = this.chatService.getSocket();

    if (emitSocket && info && socket) {
      socket.emit('end_call', {
        conversationId: info.conversationId,
        senderId: this.currentUserId
      });
    }

    // Stop all media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => t.stop());
      this.remoteStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }

    // Close RTCPeerConnection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.isRemoteDescriptionSet = false;
    this.iceCandidatesQueue = [];

    // Stop duration timer
    this.stopTimer();

    // Reset reactive state
    this.localStreamSignal.set(null);
    this.remoteStreamSignal.set(null);
    this.remoteHasVideo.set(false);

    this.setCallState('ENDED');
    setTimeout(() => {
      this.setCallState('IDLE');
      this.callerInfo.set(null);
      this.isMicMuted.set(false);
      this.isCameraOff.set(false);
      this.isScreenSharing.set(false);
    }, 1500);
  }

  /**
   * Toggle Microphone Mute/Unmute
   */
  toggleMic(): void {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        this.isMicMuted.set(!audioTrack.enabled);
      }
    }
  }

  /**
   * Toggle Camera On/Off
   */
  toggleCamera(): void {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        this.isCameraOff.set(!videoTrack.enabled);
        this.localStreamSignal.set(this.localStream);
      }
    }
  }

  /**
   * Toggle Screen Sharing with proper RTC Track Sender Replacement & Local PIP updates
   */
  async toggleScreenShare(): Promise<void> {
    if (!this.peerConnection) return;

    if (this.isScreenSharing()) {
      // Revert back to original camera track
      if (this.screenStream) {
        this.screenStream.getTracks().forEach((t) => t.stop());
        this.screenStream = null;
      }
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const senders = this.peerConnection.getSenders();
        const sender = senders.find((s) => s.track?.kind === 'video' || s.track === null);
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
      }
      this.isScreenSharing.set(false);
      this.localStreamSignal.set(this.localStream);
    } else {
      try {
        this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = this.screenStream.getVideoTracks()[0];

        const senders = this.peerConnection.getSenders();
        const sender = senders.find((s) => s.track?.kind === 'video' || s.track === null);

        if (sender) {
          await sender.replaceTrack(screenTrack);
        } else {
          this.peerConnection.addTrack(screenTrack, this.screenStream);
        }

        screenTrack.onended = () => {
          this.toggleScreenShare();
        };

        this.isScreenSharing.set(true);
        // Show screen preview in local stream PIP container
        this.localStreamSignal.set(this.screenStream);
      } catch (err) {
        console.warn('[VideoCallService] Screen sharing cancelled or failed:', err);
      }
    }
  }

  private createPeerConnection(conversationId: string): void {
    this.isRemoteDescriptionSet = false;
    this.peerConnection = new RTCPeerConnection(this.iceServers);

    // Track event: Remote media stream received
    this.peerConnection.ontrack = (event) => {
      console.log('🎥 [VideoCallService] Remote track received:', event.track.kind, event.streams);
      this.ngZone.run(() => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
        } else {
          if (!this.remoteStream) {
            this.remoteStream = new MediaStream();
          }
          this.remoteStream.addTrack(event.track);
        }
        this.remoteStreamSignal.set(this.remoteStream);
        this.checkRemoteVideoStatus();

        // Listen for track un-mute / mute state changes
        event.track.onunmute = () => this.checkRemoteVideoStatus();
        event.track.onmute = () => this.checkRemoteVideoStatus();
        event.track.onended = () => this.checkRemoteVideoStatus();
      });
    };

    // ICE Candidate event: Broadcast to peer
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = this.chatService.getSocket();
        if (socket) {
          socket.emit('ice_candidate', {
            conversationId,
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
            senderId: this.currentUserId
          });
        }
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('🔗 [VideoCallService] Peer connection state:', this.peerConnection?.connectionState);
      if (this.peerConnection?.connectionState === 'disconnected' || this.peerConnection?.connectionState === 'failed') {
        this.endCall(false);
      }
    };
  }

  private checkRemoteVideoStatus(): void {
    if (!this.remoteStream) {
      this.remoteHasVideo.set(false);
      return;
    }
    const videoTracks = this.remoteStream.getVideoTracks();
    const hasLiveVideo = videoTracks.some((t) => t.enabled && t.readyState === 'live');
    this.remoteHasVideo.set(hasLiveVideo);
  }

  private startTimer(): void {
    this.durationSeconds = 0;
    this.stopTimer();
    this.durationTimer = setInterval(() => {
      this.ngZone.run(() => {
        this.durationSeconds++;
        const m = Math.floor(this.durationSeconds / 60);
        const s = this.durationSeconds % 60;
        this.formattedDuration.set(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      });
    }, 1000);
  }

  private stopTimer(): void {
    if (this.durationTimer) {
      clearInterval(this.durationTimer);
      this.durationTimer = null;
    }
    this.formattedDuration.set('00:00');
  }
}
