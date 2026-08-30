import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class NotificationSoundService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private audio: HTMLAudioElement | null = null;
  private permissionRequested = false;

  constructor() {
    if (this.isBrowser) {
      this.initAudio();
      this.requestNotificationPermission();
    }
  }

  private initAudio(): void {
    try {
      this.audio = new Audio('/assets/sounds/message-pop.mp3');
      this.audio.load();
    } catch (e) {
      console.warn('[NotificationSoundService] Could not preload audio:', e);
    }
  }

  private requestNotificationPermission(): void {
    if ('Notification' in window && Notification.permission === 'default' && !this.permissionRequested) {
      this.permissionRequested = true;
      Notification.requestPermission().catch(() => {});
    }
  }

  /**
   * Plays a sound alert and displays a native browser notification if condition is satisfied
   * @param message The incoming chat message payload
   * @param currentUserId Logged in user ID
   * @param isCurrentConversationActive Whether the user is viewing this exact conversation right now in focused tab
   */
  public handleNewMessageAlert(message: any, currentUserId?: string | null, isCurrentConversationActive: boolean = false): void {
    if (!this.isBrowser || !message) return;

    // Condition: Play sound ONLY if the incoming message is NOT from the current logged-in user
    const senderId = message.senderId;
    const isFromMe = (senderId && currentUserId) ? (senderId === currentUserId) : false;
    if (isFromMe) return;

    // Play crisp sound effect
    this.playPopSound();

    // If conversation is NOT currently open or the browser tab is blurred, trigger HTML5 Browser Notification
    const isTabBlurred = typeof document !== 'undefined' && document.hidden;
    if (!isCurrentConversationActive || isTabBlurred) {
      this.triggerBrowserNotification(message);
    }
  }

  /**
   * Play crisp sound effect with Web Audio API synthesizer fallback
   */
  public playPopSound(): void {
    if (!this.isBrowser) return;
    if (this.audio) {
      this.audio.currentTime = 0;
      this.audio.play().catch(() => {
        // Fallback to synthesizing a clean pop sound using Web Audio API if file play fails (e.g. user interaction / missing file)
        this.synthesizePopSound();
      });
    } else {
      this.synthesizePopSound();
    }
  }

  private synthesizePopSound(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Crisp two-tone pop chirp
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  }

  /**
   * Trigger native HTML5 browser notification
   */
  private triggerBrowserNotification(msg: any): void {
    if (!('Notification' in window)) return;

    const title = `رسالة جديدة في وسيط AI`;
    let body = msg.text || msg.content || 'رسالة جديدة في غرفة التفاوض';
    if (msg.type === 'AUDIO') body = '🎤 أرسل لك رسالة صوتية';
    if (msg.type === 'IMAGE') body = '📷 أرسل لك صورة جديدة';
    if (msg.type === 'FILE') body = `📁 أرسل لك ملفاً: ${msg.fileName || 'مرفق'}`;

    const show = () => {
      try {
        const n = new Notification(title, {
          body,
          icon: '/images/waseet-mark.png',
          tag: msg.conversationId || 'waseet_chat_msg'
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch (err) {
        console.warn('[NotificationSoundService] Notification trigger error:', err);
      }
    };

    if (Notification.permission === 'granted') {
      show();
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') show();
      });
    }
  }
}
