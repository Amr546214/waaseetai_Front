import { DestroyRef, Injectable, Injector, NgZone, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HelpAssistantSocketService, HelpChatHistoryTurn, HelpCitation, HelpStreamEvent } from '../services/help-assistant-socket.service';
import { AssistantTtsError, AssistantTtsService } from '../services/assistant-tts.service';
import {
	SECURE_CONTEXT,
	SPEECH_ERROR_MESSAGES,
	SPEECH_GENERIC_ERROR,
	SPEECH_INSECURE,
	SPEECH_RECOGNITION,
	SPEECH_START_FAILED,
	SPEECH_UNSUPPORTED,
	SpeechRecognitionLike,
} from '../services/speech-recognition';
import {
	BEBO_DIALECTS,
	BeboAction,
	BeboDialect,
	BeboDialectChoice,
	BeboVoice,
	DEFAULT_DIALECT,
	DEFAULT_VOICE,
	acknowledge,
	chooseDialect,
	commandFor,
	isBeboDialect,
	isBeboVoice,
} from '../../sheards/bebo-avatar/bebo-commands';
import { AuthStore } from './auth.store';

// Single source of truth for the dashboard Help Assistant + Avatar. The
// floating Avatar widget and the help pages render this same conversation,
// so there is exactly ONE real engine (WaseetAI via the backend) and no
// per-page fake assistants.
//
// Avatar state machine (rendered by the Bebo avatar, see BeboAvatarComponent):
//
//   idle ──ask──▶ thinking ──first chunk──▶ thinking (text renders progressively)
//        ◀──complete────────────────────────────┘   (+ successTick → Bebo 'happy')
//   idle ──(voice on) TTS audio playing──▶ speaking ──ended / stopped / error──▶ idle
//   thinking ──help:error / connection lost / client timeout──▶ error ──retry/ask──▶ thinking
//   idle/error ──toggleListening() (mic click)──▶ listening
//        ──final transcript──▶ ask() (same flow as typing) ──▶ thinking
//        ──no speech / error / cancelled──▶ idle (+ micNotice)
//
// Microphone (Bebo v4 handoff bebo-chat.js `listen()`): the browser's own
// SpeechRecognition, started ONLY by an explicit user click. The final
// transcript goes through ask() exactly like typed text — same socket, same
// history, same command routing. No audio is sent to a Waseet STT service.
//
// Voice (WaseetAI TTS): only after a COMPLETE text answer, the answer text is
// sent to the authenticated backend endpoint (AssistantTtsService) with the
// chosen voice/dialect; the WAV comes back as a Blob and plays here. Any TTS
// or playback failure leaves the text answer untouched (voiceNotice only).
// The last reply's audio is kept for replay until a new question, a voice /
// dialect change, or an identity change releases it. While audio plays, a
// Web Audio analyser (handoff startMeter) drives Bebo's mouth.
//
// Local Bebo commands (handoff bebo-core.mjs commandFor): an EXACT command
// phrase ("ارقص", "dance"…) animates Bebo locally — it is not sent to
// WaseetAI and not added to the conversation/history. Everything else is a
// normal assistant question.
//
// Session isolation: the conversation belongs to ONE authenticated identity
// (token + user id + active role). When that identity changes — logout, a
// different user logging in on the same tab, a role switch — every piece of
// user-specific state is wiped (resetSession) before anything else can be
// shown or sent: messages, pending request, microphone, audio + replay, and
// the assistant socket itself.

export type AvatarState = 'idle' | 'thinking' | 'listening' | 'speaking' | 'error';

export interface AssistantMessage {
	role: 'user' | 'assistant';
	text: string;
	streaming?: boolean;
	citations?: HelpCitation[];
}

/** A local Bebo animation request; `seq` makes repeats distinct. */
export interface BeboCommand {
	action: BeboAction;
	seq: number;
}

export const MAX_QUESTION_LENGTH = 500;
/** Longest answer sent to TTS (the backend enforces the same bound). */
export const MAX_TTS_CHARS = 1500;
/** Client-side watchdog: a question with no terminal event in this window
 *  is treated as failed (the backend's own upstream timeout is 60 s). */
export const ANSWER_WATCHDOG_MS = 75_000;
const VOICE_PREF_KEY = 'waseet_assistant_voice';
const TTS_PREF_KEY = 'waseet_assistant_tts';

const CONNECTION_LOST_MESSAGE = 'انقطع الاتصال بالخادم أثناء انتظار الرد. يرجى المحاولة مرة أخرى.';
const WATCHDOG_MESSAGE = 'انتهت مهلة انتظار رد المساعد الذكي. يرجى المحاولة مرة أخرى.';
const VOICE_UNAVAILABLE = 'الصوت غير متاح لهذا الرد، والإجابة النصية كاملة أعلاه.';
const VOICE_TOO_LONG = 'الرد أطول من أن يُقرأ صوتياً، والإجابة النصية كاملة أعلاه.';
const VOICE_RATE_LIMITED = 'طلبات صوت كثيرة في وقت قصير. حاول لاحقاً، والإجابة النصية كاملة أعلاه.';
const VOICE_PLAY_FAILED = 'تعذر تشغيل الصوت، والإجابة النصية كاملة أعلاه.';
const VOICE_BLOCKED = 'منع المتصفح تشغيل الصوت تلقائياً. اضغط «إعادة الاستماع» لتشغيله.';
/** Roaming stays disabled until browser QA (the handoff's roam_on/off). */
export const ROAMING_DISABLED_NOTICE = 'التجوّل التلقائي لبيبو غير مفعّل حالياً.';

export type SpeechLevelListener = (level: number | null) => void;

interface MeterGraph {
	audio: HTMLAudioElement;
	source: MediaElementAudioSourceNode;
	analyser: AnalyserNode;
	data: Float32Array<ArrayBuffer>;
}

interface LastReply {
	text: string;
	dialect: BeboDialect;
}

@Injectable({ providedIn: 'root' })
export class AssistantStore {
	private readonly socket = inject(HelpAssistantSocketService);
	private readonly router = inject(Router);
	private readonly authStore = inject(AuthStore);
	private readonly zone = inject(NgZone);
	private readonly injector = inject(Injector);
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly Recognition = inject(SPEECH_RECOGNITION);
	private readonly isSecureContext = inject(SECURE_CONTEXT);

	readonly state = signal<AvatarState>('idle');
	/** Incremented on every successfully completed answer (Bebo 'happy'). */
	readonly successTick = signal(0);
	readonly messages = signal<AssistantMessage[]>([]);
	/** True while answer text is arriving (state stays 'thinking'). */
	readonly streaming = signal(false);
	readonly errorMessage = signal('');
	readonly humanSupportFallback = signal(false);
	/** Non-blocking note about audio (e.g. voice unavailable for this reply). */
	readonly voiceNotice = signal('');
	readonly lastQuestion = signal('');
	readonly panelOpen = signal(false);
	readonly voiceEnabled = signal(this.readVoicePref());

	// ── voice / dialect (Bebo v4 handoff option lists) ──
	readonly ttsVoice = signal<BeboVoice>(DEFAULT_VOICE);
	readonly ttsDialect = signal<BeboDialectChoice>('auto');
	/** Dialect detected from the user's words (used when ttsDialect is 'auto'). */
	readonly detectedDialect = signal<BeboDialect>(DEFAULT_DIALECT);
	/** True while the TTS audio for the last reply is being prepared. */
	readonly audioLoading = signal(false);
	private readonly lastReply = signal<LastReply | null>(null);

	// ── microphone ──
	/** Whether this browser offers SpeechRecognition at all. */
	readonly micSupported: boolean;
	readonly micActive = signal(false);
	/** Live (interim + final) transcript while listening. */
	readonly transcript = signal('');
	readonly micNotice = signal('');

	// ── local Bebo commands ──
	readonly beboCommand = signal<BeboCommand | null>(null);
	/** Bebo's short acknowledgement of the last local command. */
	readonly commandReply = signal('');

	readonly busy = computed(() => this.state() === 'thinking');
	readonly supportRoute = signal<string | null>(null);
	readonly canReplay = computed(
		() => !!this.lastReply() && this.voiceEnabled() && !this.busy() && this.state() !== 'listening' && this.state() !== 'speaking' && !this.audioLoading(),
	);

	private currentRequestId: string | null = null;
	private watchdog: ReturnType<typeof setTimeout> | null = null;
	private audio: HTMLAudioElement | null = null;
	private audioUrl: string | null = null;
	private audioContext: AudioContext | null = null;
	private meterGraph: MeterGraph | null = null;
	private meterFrame = 0;
	private readonly speechLevelListeners = new Set<SpeechLevelListener>();
	private ttsSub: Subscription | null = null;
	/** Bumped whenever audio is released; stale TTS responses compare it. */
	private audioSeq = 0;
	private recognizer: SpeechRecognitionLike | null = null;
	private micSeq = 0;
	private commandSeq = 0;
	/** Resolved on first use, so views that never speak need no HttpClient. */
	private tts: AssistantTtsService | null = null;

	/** Identity the current conversation belongs to ('' = signed out). */
	private readonly identity = computed(() => {
		const token = this.authStore.token();
		if (!token) return '';
		const user = this.authStore.currentUser();
		return [token, user?.id ?? '', user?.activeRole ?? user?.accountType ?? ''].join('\u0000');
	});
	private sessionIdentity = untracked(() => this.identity());

	constructor() {
		this.micSupported = !!this.Recognition;
		this.readTtsPrefs();
		const sub = this.socket.events$.subscribe((e) => this.onEvent(e));
		const nav = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.updateSupportRoute());
		this.updateSupportRoute();
		// Clears the previous identity's conversation as soon as auth changes
		// (logout / other user / role switch). ask(), retry(), replay() and the
		// microphone also check synchronously, so nothing can be sent or played
		// for the old identity before this effect runs.
		effect(() => {
			this.identity();
			untracked(() => this.ensureSessionIdentity());
		});
		inject(DestroyRef).onDestroy(() => {
			sub.unsubscribe();
			nav.unsubscribe();
			this.clearWatchdog();
			this.cancelListening();
			this.releaseAudio();
			this.speechLevelListeners.clear();
			this.audioContext?.close().catch(() => {});
			this.audioContext = null;
		});
	}

	// ── panel ──────────────────────────────────────────────────────────
	open(): void { this.panelOpen.set(true); }
	close(): void { this.panelOpen.set(false); }
	toggle(): void { this.panelOpen.update((v) => !v); }

	/** Opens the shared assistant panel and asks `question` (help hubs). */
	openAndAsk(question: string): void {
		this.ensureSessionIdentity();
		this.open();
		this.ask(question);
	}

	setVoiceEnabled(enabled: boolean): void {
		this.voiceEnabled.set(enabled);
		if (!enabled) this.releaseAudio();
		try { localStorage.setItem(VOICE_PREF_KEY, enabled ? '1' : '0'); } catch { /* storage unavailable */ }
	}

	/** Only voices from the handoff list are accepted. Releases cached audio. */
	setVoice(voice: string): void {
		if (!isBeboVoice(voice) || voice === this.ttsVoice()) return;
		this.ttsVoice.set(voice);
		this.releaseAudio();
		this.saveTtsPrefs();
	}

	/** 'auto' or a handoff dialect id. Affects the mic language and TTS. */
	setDialect(dialect: string): void {
		if (dialect !== 'auto' && !isBeboDialect(dialect)) return;
		if (dialect === this.ttsDialect()) return;
		this.ttsDialect.set(dialect as BeboDialectChoice);
		if (isBeboDialect(dialect)) this.detectedDialect.set(dialect);
		const reply = this.lastReply();
		if (reply && isBeboDialect(dialect)) this.lastReply.set({ ...reply, dialect });
		this.releaseAudio();
		this.saveTtsPrefs();
	}

	/** The dialect actually used for the mic language / speech. */
	effectiveDialect(): BeboDialect {
		const choice = this.ttsDialect();
		return choice === 'auto' ? this.detectedDialect() : choice;
	}

	// ── conversation ───────────────────────────────────────────────────
	ask(rawQuestion: string): boolean {
		this.ensureSessionIdentity();
		const question = rawQuestion.trim();
		if (!question || this.busy()) return false;
		// Exact local Bebo command → animate locally; never sent upstream.
		const action = commandFor(question);
		if (action) {
			this.runCommand(action, question);
			return true;
		}
		if (question.length > MAX_QUESTION_LENGTH) return false;
		// Called from a user gesture (send / Enter / mic): unlock Web Audio now
		// so the later answer audio can be metered for Bebo's mouth.
		if (this.voiceEnabled()) this.warmAudio();
		this.cancelListening();
		this.detectedDialect.set(chooseDialect(question, this.ttsDialect(), this.detectedDialect()));
		this.messages.update((list) => [...list, { role: 'user', text: question }]);
		this.lastQuestion.set(question);
		this.send(question);
		return true;
	}

	retry(): void {
		this.ensureSessionIdentity();
		const question = this.lastQuestion();
		if (!question || this.busy()) return;
		this.send(question);
	}

	/** Avatar "listening" pose. Used by the microphone flow. */
	startListening(): boolean {
		if (this.busy()) return false;
		this.stopAudio();
		this.errorMessage.set('');
		this.state.set('listening');
		return true;
	}

	stopListening(): void {
		if (this.state() === 'listening') this.state.set('idle');
	}

	/**
	 * Microphone button. Starts browser speech recognition (explicit user
	 * click only), or — when already listening — finishes it so the final
	 * transcript is sent (handoff behavior).
	 */
	toggleListening(): void {
		this.ensureSessionIdentity();
		if (this.recognizer) {
			try { this.recognizer.stop(); } catch { this.cancelListening(); }
			return;
		}
		this.micNotice.set('');
		if (this.busy() || !this.isBrowser) return;
		if (!this.Recognition) return void this.micNotice.set(SPEECH_UNSUPPORTED);
		if (!this.isSecureContext()) return void this.micNotice.set(SPEECH_INSECURE);

		const recog = new this.Recognition();
		const seq = ++this.micSeq;
		const identity = this.sessionIdentity;
		const current = () => seq === this.micSeq && this.recognizer === recog && identity === untracked(() => this.identity());
		let finalText = '';
		let failed = false;

		recog.lang = BEBO_DIALECTS[this.effectiveDialect()].language;
		recog.continuous = false;
		recog.interimResults = true;
		recog.maxAlternatives = 1;
		recog.onresult = (event) => {
			if (!current()) return;
			let interim = '';
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const r = event.results[i];
				if (r.isFinal) finalText += r[0].transcript + ' ';
				else interim += r[0].transcript;
			}
			this.transcript.set((finalText + interim).trim().slice(0, MAX_QUESTION_LENGTH));
		};
		recog.onerror = (event) => {
			if (!current()) return;
			failed = true;
			// 'aborted' = cancelled (by us or the browser): no error message.
			if (event?.error !== 'aborted') this.micNotice.set(SPEECH_ERROR_MESSAGES[event?.error] ?? SPEECH_GENERIC_ERROR);
		};
		recog.onend = () => {
			if (!current()) {
				if (seq === this.micSeq && this.recognizer === recog) this.cancelListening();
				return;
			}
			this.recognizer = null;
			this.micActive.set(false);
			this.transcript.set('');
			this.stopListening();
			const text = finalText.trim().slice(0, MAX_QUESTION_LENGTH);
			if (text && !failed) this.ask(text);
		};

		this.recognizer = recog;
		this.micActive.set(true);
		this.transcript.set('');
		this.startListening();
		try {
			recog.start();
		} catch {
			this.cancelListening();
			this.micNotice.set(SPEECH_START_FAILED);
		}
	}

	/** Stops the microphone immediately; nothing it heard is sent. */
	cancelListening(): void {
		const r = this.recognizer;
		if (!r) return;
		this.micSeq++;
		this.recognizer = null;
		r.onstart = r.onresult = r.onerror = r.onend = null;
		try { r.abort(); } catch { /* already stopped */ }
		this.micActive.set(false);
		this.transcript.set('');
		this.stopListening();
	}

	/**
	 * Subscribes to the loudness (0–1) of the answer audio while it plays;
	 * `null` means "not metered" (the avatar then cycles its speech frames).
	 * Returns the unsubscribe function. Called outside the Angular zone.
	 */
	onSpeechLevel(listener: SpeechLevelListener): () => void {
		this.speechLevelListeners.add(listener);
		return () => this.speechLevelListeners.delete(listener);
	}

	/**
	 * Wipes ALL user-specific assistant state: conversation/history, the
	 * in-flight request (cancelled upstream), streaming text, microphone,
	 * pending/playing audio and the replayable last reply, errors, notices,
	 * the open panel — and closes the assistant socket. Used whenever the
	 * authenticated identity changes.
	 */
	resetSession(): void {
		if (this.currentRequestId) this.socket.cancel(this.currentRequestId);
		this.currentRequestId = null;
		this.socket.disconnect();
		this.clearWatchdog();
		this.cancelListening();
		this.releaseAudio();
		this.lastReply.set(null);
		this.messages.set([]);
		this.lastQuestion.set('');
		this.streaming.set(false);
		this.errorMessage.set('');
		this.humanSupportFallback.set(false);
		this.voiceNotice.set('');
		this.micNotice.set('');
		this.commandReply.set('');
		this.beboCommand.set(null);
		this.panelOpen.set(false);
		this.state.set('idle');
		this.updateSupportRoute();
	}

	/** Leaves the error state without re-sending. */
	dismissError(): void {
		if (this.state() === 'error') this.state.set('idle');
		this.errorMessage.set('');
	}

	/** Stops an in-flight answer (the backend aborts the upstream stream). */
	cancel(): void {
		if (!this.busy()) return;
		this.socket.cancel(this.currentRequestId);
		this.currentRequestId = null;
		this.clearWatchdog();
		this.dropStreamingBubble();
		this.streaming.set(false);
		this.state.set('idle');
	}

	/**
	 * Stops playing / pending answer audio and returns to idle. The already
	 * received audio stays available for replay().
	 */
	stopAudio(): void {
		this.cancelPendingTts();
		this.stopPlayback();
	}

	/** Plays the last assistant reply again (re-synthesizes if needed). */
	replay(): boolean {
		this.ensureSessionIdentity();
		if (!this.canReplay()) return false;
		this.warmAudio();
		this.voiceNotice.set('');
		if (this.audio) {
			this.stopPlayback();
			this.playAudio(this.audio);
		} else {
			this.speak();
		}
		return true;
	}

	/** Last ≤3 completed question/answer pairs (bounded history). */
	historyTail(): HelpChatHistoryTurn[] {
		const msgs = this.messages();
		const turns: HelpChatHistoryTurn[] = [];
		for (let i = 0; i < msgs.length - 1; i++) {
			const a = msgs[i + 1];
			if (msgs[i].role === 'user' && a.role === 'assistant' && !a.streaming && a.text) turns.push({ question: msgs[i].text, answer: a.text });
		}
		return turns.slice(-3);
	}

	private runCommand(action: BeboAction, text: string): void {
		const dialect = chooseDialect(text, this.ttsDialect(), this.detectedDialect());
		this.detectedDialect.set(dialect);
		this.cancelListening();
		if (action === 'stop') this.stopAudio();
		if (action === 'roam_on' || action === 'roam_off') {
			this.commandReply.set(ROAMING_DISABLED_NOTICE);
			return;
		}
		this.commandReply.set(acknowledge(action, dialect));
		this.beboCommand.set({ action, seq: ++this.commandSeq });
	}

	private send(question: string): void {
		this.releaseAudio();
		this.lastReply.set(null);
		this.errorMessage.set('');
		this.voiceNotice.set('');
		this.commandReply.set('');
		this.humanSupportFallback.set(false);
		this.streaming.set(false);
		this.currentRequestId = null;
		// historyTail() only contains completed pairs, so the question being
		// asked now (the trailing user message) is never duplicated into it.
		const history = this.historyTail();
		this.state.set('thinking');
		// Speech now comes from WaseetAI TTS (speak()), never the socket.
		const id = this.socket.ask(question, history);
		this.currentRequestId = id;
		if (id) this.armWatchdog();
	}

	private onEvent(e: HelpStreamEvent): void {
		if (e.type === 'connection_lost') {
			if (this.busy()) this.fail(CONNECTION_LOST_MESSAGE, true);
			return;
		}
		if (e.type === 'error') {
			// Only an active question can fail; stale errors (cancelled or
			// superseded requests) are ignored. currentRequestId is still null
			// when ask() itself reports AUTH_REQUIRED synchronously.
			if (!this.busy()) return;
			if (e.clientRequestId && this.currentRequestId && e.clientRequestId !== this.currentRequestId) return;
			this.fail(e.message, e.humanSupportFallback);
			return;
		}
		if (!this.currentRequestId || e.clientRequestId !== this.currentRequestId) return;

		switch (e.type) {
			case 'start':
				this.ensureAssistantBubble();
				this.armWatchdog();
				break;
			case 'chunk':
				this.ensureAssistantBubble();
				this.streaming.set(true);
				this.armWatchdog();
				this.updateLastAssistant((m) => ({ ...m, text: m.text + e.chunk }));
				break;
			case 'citations':
				this.ensureAssistantBubble();
				this.updateLastAssistant((m) => ({ ...m, citations: e.citations }));
				break;
			case 'complete': {
				this.clearWatchdog();
				this.streaming.set(false);
				this.updateLastAssistant((m) => ({ ...m, streaming: false }));
				this.currentRequestId = null;
				this.state.set('idle');
				this.successTick.update((n) => n + 1);
				const last = this.messages().at(-1);
				if (last?.role === 'assistant' && last.text.trim()) {
					this.lastReply.set({ text: last.text.trim(), dialect: this.effectiveDialect() });
					if (this.voiceEnabled()) this.speak();
				}
				break;
			}
		}
	}

	// ── WaseetAI TTS playback ──────────────────────────────────────────
	private speak(): void {
		const reply = this.lastReply();
		if (!reply || !this.isBrowser) return;
		this.releaseAudio();
		if (reply.text.length > MAX_TTS_CHARS) return void this.voiceNotice.set(VOICE_TOO_LONG);
		const seq = this.audioSeq;
		const identity = this.sessionIdentity;
		const stale = () => seq !== this.audioSeq || identity !== untracked(() => this.identity());
		this.tts ??= this.injector.get(AssistantTtsService);
		this.audioLoading.set(true);
		this.ttsSub = this.tts.synthesize({ text: reply.text, voice: this.ttsVoice(), dialect: reply.dialect }).subscribe({
			next: (blob) => {
				if (stale()) return;
				this.ttsSub = null;
				this.audioLoading.set(false);
				// Only play into an idle assistant (not while a new question
				// is being asked or the mic is listening).
				if (this.state() !== 'idle') return;
				try {
					this.audioUrl = URL.createObjectURL(blob);
					this.audio = new Audio(this.audioUrl);
					this.playAudio(this.audio);
				} catch {
					this.releaseAudio();
					this.voiceNotice.set(VOICE_PLAY_FAILED);
				}
			},
			error: (err: unknown) => {
				if (stale()) return;
				this.ttsSub = null;
				this.audioLoading.set(false);
				const code = err instanceof AssistantTtsError ? err.code : 'UNAVAILABLE';
				this.voiceNotice.set(code === 'RATE_LIMITED' ? VOICE_RATE_LIMITED : VOICE_UNAVAILABLE);
			},
		});
	}

	private playAudio(audio: HTMLAudioElement): void {
		audio.onplaying = () => {
			if (this.audio !== audio) return;
			this.state.set('speaking');
			this.startMeter(audio);
		};
		audio.onended = () => { if (this.audio === audio) this.stopPlayback(); };
		audio.onerror = () => {
			if (this.audio !== audio) return;
			this.releaseAudio();
			this.voiceNotice.set(VOICE_PLAY_FAILED);
		};
		try { audio.currentTime = 0; } catch { /* not seekable yet */ }
		let playing: Promise<void> | undefined;
		try { playing = audio.play(); } catch { playing = Promise.reject(new Error('play failed')); }
		playing?.catch(() => {
			if (this.audio !== audio) return;
			this.stopPlayback();
			this.voiceNotice.set(VOICE_BLOCKED);
		});
	}

	/** Pauses playback (keeps the audio for replay) and returns to idle. */
	private stopPlayback(): void {
		this.stopMeter();
		if (this.audio) {
			try { this.audio.pause(); } catch { /* ignore */ }
		}
		if (this.state() === 'speaking') this.state.set('idle');
	}

	private cancelPendingTts(): void {
		this.ttsSub?.unsubscribe();
		this.ttsSub = null;
		if (this.audioLoading()) this.audioSeq++;
		this.audioLoading.set(false);
	}

	/** Stops everything audio-related and frees it: no replay remains. */
	private releaseAudio(): void {
		this.audioSeq++;
		this.cancelPendingTts();
		this.stopPlayback();
		this.releaseMeterGraph();
		if (this.audio) {
			const a = this.audio;
			a.onended = null;
			a.onerror = null;
			a.onplaying = null;
			try {
				a.removeAttribute?.('src');
				a.load?.();
			} catch { /* ignore */ }
			this.audio = null;
		}
		if (this.audioUrl) {
			URL.revokeObjectURL(this.audioUrl);
			this.audioUrl = null;
		}
	}

	/** Resets the conversation if it belongs to a different auth identity. */
	private ensureSessionIdentity(): void {
		const identity = untracked(() => this.identity());
		if (identity === this.sessionIdentity) return;
		this.sessionIdentity = identity;
		this.resetSession();
	}

	// ── speech meter (ported from Bebo v4 bebo-chat.js warmAudio/startMeter) ──
	private warmAudio(): void {
		if (!this.isBrowser) return;
		const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
		if (!Ctx) return;
		try {
			if (!this.audioContext || this.audioContext.state === 'closed') this.audioContext = new Ctx() as AudioContext;
			this.audioContext.resume().catch(() => {});
		} catch { /* Web Audio unavailable — the avatar cycles speech frames */ }
	}

	private startMeter(audio: HTMLAudioElement): void {
		this.stopMeter();
		const ctx = this.audioContext;
		// A suspended context would silence media routed through it.
		if (!ctx || ctx.state !== 'running') return;
		try {
			// A media element can be routed into Web Audio only once, so the
			// graph is reused for replays of the same element.
			if (!this.meterGraph || this.meterGraph.audio !== audio) {
				this.releaseMeterGraph();
				const source = ctx.createMediaElementSource(audio);
				const analyser = ctx.createAnalyser();
				analyser.fftSize = 512;
				source.connect(analyser);
				analyser.connect(ctx.destination);
				this.meterGraph = { audio, source, analyser, data: new Float32Array(analyser.fftSize) };
			}
			const graph = this.meterGraph;
			const measure = () => {
				if (this.meterGraph !== graph || this.state() !== 'speaking' || audio.paused) return;
				graph.analyser.getFloatTimeDomainData(graph.data);
				let energy = 0;
				for (const sample of graph.data) energy += sample * sample;
				this.emitSpeechLevel(Math.min(1, Math.sqrt(energy / graph.data.length) * 7));
				this.meterFrame = requestAnimationFrame(measure);
			};
			this.zone.runOutsideAngular(measure);
		} catch {
			this.emitSpeechLevel(null);
		}
	}

	private stopMeter(): void {
		if (this.meterFrame) cancelAnimationFrame(this.meterFrame);
		this.meterFrame = 0;
		this.emitSpeechLevel(null);
	}

	private releaseMeterGraph(): void {
		if (!this.meterGraph) return;
		try {
			this.meterGraph.source.disconnect();
			this.meterGraph.analyser.disconnect();
		} catch { /* already disconnected */ }
		this.meterGraph = null;
	}

	private emitSpeechLevel(level: number | null): void {
		for (const listener of this.speechLevelListeners) {
			try { listener(level); } catch { /* a view must never break playback */ }
		}
	}

	private fail(message: string, humanSupportFallback: boolean): void {
		this.clearWatchdog();
		if (this.currentRequestId) this.socket.cancel(this.currentRequestId);
		this.currentRequestId = null;
		this.streaming.set(false);
		// Never leave a half-written answer that looks like a real reply.
		this.dropStreamingBubble();
		this.errorMessage.set(message);
		this.humanSupportFallback.set(humanSupportFallback);
		this.state.set('error');
	}

	private armWatchdog(): void {
		this.clearWatchdog();
		if (!this.isBrowser) return;
		this.watchdog = setTimeout(() => { if (this.busy()) this.fail(WATCHDOG_MESSAGE, true); }, ANSWER_WATCHDOG_MS);
	}

	private clearWatchdog(): void {
		if (this.watchdog) clearTimeout(this.watchdog);
		this.watchdog = null;
	}

	private ensureAssistantBubble(): void {
		const last = this.messages().at(-1);
		if (last?.role === 'assistant' && last.streaming) return;
		this.messages.update((list) => [...list, { role: 'assistant', text: '', streaming: true }]);
	}

	private updateLastAssistant(fn: (m: AssistantMessage) => AssistantMessage): void {
		this.messages.update((list) => {
			const last = list.at(-1);
			if (!last || last.role !== 'assistant') return list;
			return [...list.slice(0, -1), fn(last)];
		});
	}

	private dropStreamingBubble(): void {
		this.messages.update((list) => {
			const last = list.at(-1);
			return last?.role === 'assistant' && last.streaming ? list.slice(0, -1) : list;
		});
	}

	private updateSupportRoute(): void {
		const url = this.router.url || '';
		if (url.startsWith('/client-overview')) this.supportRoute.set('/client-overview/help/live-support');
		else if (url.startsWith('/provider-overview')) this.supportRoute.set('/provider-overview/help/live-support');
		else if (url.startsWith('/marketer-overview')) this.supportRoute.set('/marketer-overview/help');
		else this.supportRoute.set(null);
	}

	private readVoicePref(): boolean {
		try { return typeof localStorage !== 'undefined' && localStorage.getItem(VOICE_PREF_KEY) === '1'; } catch { return false; }
	}

	private readTtsPrefs(): void {
		try {
			const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TTS_PREF_KEY) : null;
			const prefs = raw ? JSON.parse(raw) : null;
			if (isBeboVoice(prefs?.voice)) this.ttsVoice.set(prefs.voice);
			if (prefs?.dialect === 'auto' || isBeboDialect(prefs?.dialect)) this.ttsDialect.set(prefs.dialect);
			if (isBeboDialect(prefs?.dialect)) this.detectedDialect.set(prefs.dialect);
		} catch { /* storage unavailable / malformed — defaults */ }
	}

	private saveTtsPrefs(): void {
		try { localStorage.setItem(TTS_PREF_KEY, JSON.stringify({ voice: this.ttsVoice(), dialect: this.ttsDialect() })); } catch { /* storage unavailable */ }
	}
}
