import { ChangeDetectionStrategy, Component, ElementRef, Injector, OnDestroy, ViewChild, afterNextRender, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { AssistantStore } from '../../core/store/assistant.store';
import { AssistantReplyAudioService } from '../../core/services/assistant-reply-audio.service';
import { speakableText } from '../../core/help/assistant-content';

@Component({
	selector: 'app-assistant-reply-audio', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	@if (canListen()) {
		<div class="reply-audio" dir="rtl">
			@if (clip().status === 'loading') {
				<span class="reply-audio__preparing" role="status"><span class="reply-audio__spinner" aria-hidden="true"></span>جارٍ تجهيز الصوت…</span>
				<button type="button" class="reply-audio__button" (click)="cancel()" aria-label="إلغاء تجهيز صوت الرد">إلغاء</button>
			} @else {
				<button type="button" class="reply-audio__button" (click)="listen()" aria-label="الاستماع إلى هذا الرد">
					<svg data-ws-icon="pl-assistant-volume" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>
					{{ clip().status === 'ready' ? 'تشغيل الصوت' : clip().status === 'error' ? 'إعادة تجهيز الصوت' : 'استمع للرد' }}
				</button>
			}
			@if (clip().status === 'ready' && clip().url) {
				<div class="reply-audio__player">
					<audio #player controls preload="metadata" [src]="clip().url" aria-label="مشغل صوت الرد" (playing)="onPlaying($event)" (pause)="onStopped($event)" (ended)="onStopped($event)" (error)="onPlayerError($event)"></audio>
					@if (clip().generationMs !== undefined) { <small class="reply-audio__time">جهز الصوت خلال {{ preparationTime() }} ثانية</small> }
				</div>
			}
			@if (clip().status === 'error') { <small class="reply-audio__error" role="status">{{ errorMessage() }}</small> }
			@if (playNotice()) { <small class="reply-audio__notice" role="status">{{ playNotice() }}</small> }
		</div>
	}`,
	styles: [`
		:host { display:block;max-width:100%;width:100%; }
		.reply-audio { display:flex;align-items:center;flex-wrap:wrap;gap:8px;max-width:100%;margin-top:6px;color:var(--assistant-muted,var(--tc-muted,var(--txt-3,#94a3b8)));font-size:12px; }
		.reply-audio__button { display:inline-flex;align-items:center;gap:6px;border:1px solid var(--assistant-input-border,var(--sec-bd,rgba(165,107,224,.35)));border-radius:999px;background:rgba(123,47,190,.08);padding:5px 12px;color:inherit;font:inherit;font-weight:600;line-height:1.3;cursor:pointer;transition:background .15s,border-color .15s; }
		.reply-audio__button svg { width:15px;height:15px;flex-shrink:0; }
		.reply-audio__button:hover { color:var(--assistant-text,var(--tc-text,inherit));background:var(--assistant-input-bg,rgba(123,47,190,.16));border-color:rgba(165,107,224,.55); }
		.reply-audio__button:focus-visible { outline:2px solid var(--tc-accent,#2f68c9);outline-offset:2px; }
		.reply-audio__preparing { display:inline-flex;align-items:center;gap:6px; }
		.reply-audio__spinner { width:12px;height:12px;border:2px solid currentColor;border-inline-end-color:transparent;border-radius:50%;animation:reply-audio-spin .8s linear infinite; }
		.reply-audio__player { display:flex;flex-direction:column;gap:4px;flex-basis:100%;width:100%;max-width:100%;min-width:0;margin-top:2px; }
		audio { width:100%;max-width:280px;height:34px;border-radius:999px;color-scheme:light dark; }
		.reply-audio__time,.reply-audio__notice,.reply-audio__error { font-size:11px;line-height:1.5;opacity:.85; }
		.reply-audio__error { flex-basis:100%;color:var(--assistant-muted,var(--tc-muted,inherit)); }
		@keyframes reply-audio-spin { to { transform:rotate(360deg); } }
		@media(prefers-reduced-motion:reduce) { .reply-audio__spinner { animation:none; } }
		@media print { :host { display:none; } }
	`],
})
export class AssistantReplyAudioComponent implements OnDestroy {
	readonly text = input.required<string>();
	readonly complete = input(true);
	readonly store = inject(AssistantStore);
	private readonly audio = inject(AssistantReplyAudioService);
	private readonly injector = inject(Injector);
	readonly request = computed(() => ({ text: this.text(), voice: this.store.ttsVoice(), dialect: this.store.effectiveDialect(), ...(this.store.ttsModel() ? { model: this.store.ttsModel() } : {}) }));
	readonly clip = computed(() => this.audio.state(this.request()));
	readonly canListen = computed(() => this.complete() && !!speakableText(this.text()));
	readonly playNotice = signal('');
	readonly preparationTime = computed(() => ((this.clip().generationMs ?? 0) / 1000).toFixed(1));
	readonly errorMessage = computed(() => {
		switch (this.clip().error) {
			case 'AUTH_REQUIRED': return 'سجّل الدخول مجددًا للاستماع إلى الرد.';
			case 'RATE_LIMITED': return 'وصلت للحد المؤقت للصوت. انتظر قليلًا ثم حاول مجددًا.';
			case 'TIMEOUT': return 'انتهت مهلة تجهيز الصوت. يمكنك المحاولة مجددًا.';
			default: return 'تعذر تجهيز الصوت حاليًا. يمكنك المحاولة مجددًا.';
		}
	});
	@ViewChild('player') private player?: ElementRef<HTMLAudioElement>;
	private pendingKey: string | null = null;
	private sequence = 0;
	private destroyed = false;

	constructor() {
		let previousKey: string | undefined, previousUrl: string | undefined;
		effect(() => {
			const key = this.audio.key(this.request());
			const ready = this.canListen();
			const clip = this.clip();
			untracked(() => {
				if ((previousKey !== undefined && previousKey !== key) || !ready) {
					this.pendingKey = null; this.sequence++; this.playNotice.set(''); this.pausePlayer();
				} else if (previousUrl && previousUrl !== clip.url) this.pausePlayer();
				previousKey = key; previousUrl = clip.url;
				if (clip.status === 'error') this.pendingKey = null;
				if (ready && clip.status === 'ready' && this.pendingKey === key) {
					this.pendingKey = null; this.playAfterRender(key, this.sequence);
				}
			});
		});
	}

	listen(): void {
		if (!this.canListen()) return;
		this.playNotice.set('');
		const request = this.request();
		const key = this.audio.key(request);
		this.sequence++;
		if (this.clip().status === 'ready') this.playAfterRender(key, this.sequence);
		else { this.pendingKey = key; this.audio.prepare(request); }
	}
	cancel(): void { this.pendingKey = null; this.sequence++; this.audio.cancel(this.request()); this.playNotice.set(''); }
	onPlaying(event: Event): void {
		const player = event.target as HTMLAudioElement;
		player.volume = this.store.voiceVolume();
		this.audio.activate(player); this.store.beginManualAudio(player); this.playNotice.set('');
	}
	onStopped(event: Event): void { const player = event.target as HTMLAudioElement; this.audio.deactivate(player); this.store.endManualAudio(player); }
	onPlayerError(event: Event): void { this.onStopped(event); this.playNotice.set('تعذر تشغيل الملف الصوتي. يمكنك إعادة المحاولة من المشغّل.'); }
	private playAfterRender(key: string, sequence: number): void {
		afterNextRender(() => {
			if (this.destroyed || sequence !== this.sequence || !this.canListen() || key !== this.audio.key(this.request())) return;
			const player = this.player?.nativeElement;
			if (!player) return;
			player.volume = this.store.voiceVolume();
			try { void player.play()?.catch(() => { if (!this.destroyed && sequence === this.sequence) this.playNotice.set('الصوت جاهز. اضغط تشغيل من المشغّل للاستماع.'); }); }
			catch { this.playNotice.set('الصوت جاهز. اضغط تشغيل من المشغّل للاستماع.'); }
		}, { injector: this.injector });
	}
	private pausePlayer(): void { const player = this.player?.nativeElement; if (!player) return; try { player.pause(); } catch {} this.audio.deactivate(player); this.store.endManualAudio(player); }
	ngOnDestroy(): void { this.destroyed = true; this.pendingKey = null; this.sequence++; this.pausePlayer(); }
}
