import { Injectable, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { AssistantTtsService, type TtsFailure } from './assistant-tts.service';
import { AuthStore } from '../store/auth.store';
import { speakableText, speechChunks } from '../help/assistant-content';
import type { BeboDialect, BeboVoice } from '../../sheards/bebo-avatar/bebo-commands';

export interface ReplyAudioRequest {
  text: string;
  voice: BeboVoice;
  dialect: BeboDialect;
  model?: string;
}

export interface ReplyAudioClip {
  status: 'idle' | 'loading' | 'ready' | 'error';
  url?: string;
  generationMs?: number;
  error?: TtsFailure | string;
}

@Injectable({ providedIn: 'root' })
export class AssistantReplyAudioService implements OnDestroy {
  private readonly tts = inject(AssistantTtsService);
  private readonly authStore = inject(AuthStore, { optional: true });
  private readonly clips = signal<Map<string, ReplyAudioClip>>(new Map());
  private readonly pendingSubs = new Map<string, Subscription>();
  private readonly activeUrls = new Set<string>();
  private currentPlayer: HTMLAudioElement | null = null;
  private sessionIdentity = '';

  constructor() {
    if (this.authStore) {
      this.sessionIdentity = this.computeIdentity();
      effect(() => {
        const nextIdentity = this.computeIdentity();
        untracked(() => {
          if (nextIdentity !== this.sessionIdentity) {
            this.sessionIdentity = nextIdentity;
            this.resetAll();
          }
        });
      });
    }
  }

  private computeIdentity(): string {
    const token = this.authStore?.token?.() ?? '';
    if (!token) return '';
    const user = this.authStore?.currentUser?.();
    return [token, user?.id ?? '', user?.activeRole ?? user?.accountType ?? ''].join('\u0000');
  }

  private cleanText(raw: string): string {
    const chunks = speechChunks(raw, 1400);
    return chunks[0] || speakableText(raw).slice(0, 1400);
  }

  public key(req: ReplyAudioRequest): string {
    return `${req.voice}|${req.dialect}|${req.model ?? ''}|${this.cleanText(req.text)}`;
  }

  public state(req: ReplyAudioRequest): ReplyAudioClip {
    const k = this.key(req);
    return this.clips().get(k) ?? { status: 'idle' };
  }

  public prepare(req: ReplyAudioRequest): void {
    const k = this.key(req);
    const current = this.state(req);
    if (current.status === 'loading' || current.status === 'ready') return;

    const spokenText = this.cleanText(req.text);
    if (!spokenText) {
      this.updateClip(k, { status: 'error', error: 'INVALID_INPUT' });
      return;
    }

    this.updateClip(k, { status: 'loading' });
    const startTime = performance.now();

    const sub = this.tts.synthesize({ ...req, text: spokenText }).subscribe({
      next: (blob) => {
        const generationMs = Math.round(performance.now() - startTime);
        const url = URL.createObjectURL(blob);
        this.activeUrls.add(url);
        this.updateClip(k, { status: 'ready', url, generationMs });
        this.pendingSubs.delete(k);
      },
      error: (err) => {
        const errorCode = err?.code ?? 'UNAVAILABLE';
        this.updateClip(k, { status: 'error', error: errorCode });
        this.pendingSubs.delete(k);
      },
    });

    this.pendingSubs.set(k, sub);
  }

  public cancel(req: ReplyAudioRequest): void {
    const k = this.key(req);
    const sub = this.pendingSubs.get(k);
    if (sub) {
      sub.unsubscribe();
      this.pendingSubs.delete(k);
    }
    const current = this.state(req);
    if (current.status === 'loading') {
      this.updateClip(k, { status: 'idle' });
    }
  }

  public activate(player: HTMLAudioElement): void {
    if (this.currentPlayer && this.currentPlayer !== player) {
      try {
        this.currentPlayer.pause();
      } catch {}
    }
    this.currentPlayer = player;
  }

  public deactivate(player: HTMLAudioElement): void {
    if (this.currentPlayer === player) {
      this.currentPlayer = null;
    }
  }

  private updateClip(key: string, clip: ReplyAudioClip): void {
    this.clips.update((map) => {
      const next = new Map(map);
      next.set(key, clip);
      return next;
    });
  }

  public resetAll(): void {
    for (const sub of this.pendingSubs.values()) {
      sub.unsubscribe();
    }
    this.pendingSubs.clear();

    for (const url of this.activeUrls) {
      URL.revokeObjectURL(url);
    }
    this.activeUrls.clear();

    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause();
      } catch {}
      this.currentPlayer = null;
    }
    this.clips.set(new Map());
  }

  ngOnDestroy(): void {
    this.resetAll();
  }
}
