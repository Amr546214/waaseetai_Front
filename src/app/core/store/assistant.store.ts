import { DestroyRef, Injectable, Injector, NgZone, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HelpAssistantSocketService, HelpChatHistoryTurn, HelpCitation, HelpStreamEvent } from '../services/help-assistant-socket.service';
import { AssistantTtsError, AssistantTtsService } from '../services/assistant-tts.service';
import { AssistantCapabilities, AssistantCapabilitiesService } from '../services/assistant-capabilities.service';
import { AssistantLiveSession } from '../services/assistant-live-session';
import { AssistantAskOptions } from '../services/help-assistant-socket.service';
import { speechChunks, speakableText } from '../help/assistant-content';
import { HELP_ASSISTANT_UNAVAILABLE_MESSAGE, isObsoleteKnowledgeRefusal, normalizeAssistantError } from '../help/assistant-errors';
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
import { BEBO_EXTRA_POSES, BeboPose } from '../../sheards/bebo-avatar/bebo-loader';
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
import { HelpRole, helpRoleOfUrl } from '../help/help-guided';
import { AuthStore } from './auth.store';
import { AssistantConversation, AssistantHistory, cleanMessages, conversationTitle, emptyHistory, mergeHistory, newConversationId, readHistory } from '../help/assistant-history';

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
// Voice (WaseetAI TTS): a COMPLETE text answer stays silent. Only an explicit
// playback action sends text to the authenticated backend endpoint with the
// chosen voice/dialect. Any TTS
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
export type BeboSkin = 'classic' | 'scout';

export interface AssistantMessage {
	role: 'user' | 'assistant';
	text: string;
	streaming?: boolean;
	citations?: HelpCitation[];
	/** Provider attribution is rendered with Angular sanitization and never persisted. */
	searchSuggestionsHtml?: string;
	createdAt?: number;
}

export type BeboCommandAction = BeboAction | BeboPose;

/** A local Bebo animation request; `seq` makes repeats distinct. */
export interface BeboCommand {
	action: BeboCommandAction;
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
const SKIN_PREF_KEY = 'waseet_assistant_skin';

const CONNECTION_LOST_MESSAGE = 'انقطع الاتصال بالخادم أثناء انتظار الرد. يرجى المحاولة مرة أخرى.';
const WATCHDOG_MESSAGE = 'انتهت مهلة انتظار رد المساعد الذكي. يرجى المحاولة مرة أخرى.';
const VOICE_UNAVAILABLE = 'الصوت غير متاح لهذا الرد، والإجابة النصية كاملة أعلاه.';
const VOICE_TOO_LONG = 'الرد أطول من أن يُقرأ صوتياً، والإجابة النصية كاملة أعلاه.';
const VOICE_RATE_LIMITED = 'طلبات صوت كثيرة في وقت قصير. حاول لاحقاً، والإجابة النصية كاملة أعلاه.';
const VOICE_PLAY_FAILED = 'تعذر تشغيل الصوت، والإجابة النصية كاملة أعلاه.';
const VOICE_BLOCKED = 'منع المتصفح تشغيل الصوت تلقائياً. اضغط «إعادة الاستماع» لتشغيله.';
/** Roaming stays disabled until browser QA (the handoff's roam_on/off). */
export const ROAMING_DISABLED_NOTICE = 'التجوّل التلقائي للشخصية غير مفعّل حالياً.';

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
	readonly conversations = signal<AssistantConversation[]>([]);
	readonly activeConversationId = signal<string | null>(null);
	readonly storageNotice = signal('');
	readonly activeConversation = computed(() => this.conversations().find(c => c.id === this.activeConversationId()) ?? null);
	readonly webSearchEnabled = signal(false);
	/** True while answer text is arriving (state stays 'thinking'). */
	readonly streaming = signal(false);
	readonly errorMessage = signal('');
	readonly humanSupportFallback = signal(false);
	/** Non-blocking note about audio (e.g. voice unavailable for this reply). */
	readonly voiceNotice = signal('');
	readonly lastQuestion = signal('');
	readonly panelOpen = signal(false);
	readonly dismissed = signal(false);
	readonly skin = signal<BeboSkin>(this.loadSkinPref());
	readonly characterName = computed(() => (this.skin() === 'scout' ? 'نديم' : 'بيبو'));
	readonly characterRole = computed(() => (this.skin() === 'scout' ? 'دليل وسيط' : 'المساعد الذكي'));
	readonly characterFullName = computed(() => (this.skin() === 'scout' ? 'نديم — دليل وسيط' : 'بيبو — مساعد وسيط الذكي'));
	readonly voiceEnabled = signal(this.readVoicePref());
	readonly profile = signal<NonNullable<AssistantAskOptions['profile']>>('auto');
	readonly effort = signal<NonNullable<AssistantAskOptions['effort']>>('medium');
	readonly textModel = signal('');
	readonly ttsModel = signal('');
	readonly capabilities = signal<AssistantCapabilities | null>(null);
	readonly capabilityNotice = signal('');
	readonly progress = signal<Array<{ stage: string; message: string; status?: string; runId?: string }>>([]);
	readonly lastAssistant = computed(() => this.messages().filter(m => m.role === 'assistant' && m.text).at(-1) ?? null);
	readonly preview = computed(() => {
		const latest = this.messages().at(-1);
		return latest?.role === 'assistant' && !latest.streaming && !this.busy() && !this.errorMessage()
			? speakableText(latest.text ?? '').slice(0, 220)
			: '';
	});
	readonly voiceVolume = signal(1);
	readonly recording = signal(false);
	readonly sttLoading = signal(false);
	readonly liveActive = signal(false);
	readonly liveConnecting = signal(false);
	readonly liveTranscript = signal('');
	readonly liveNotice = signal('');
	private liveSession: AssistantLiveSession | null = null;
	private liveTokenSub: Subscription | null = null;
	private liveSeq = 0;
	private mediaRecorder: MediaRecorder | null = null;
	private mediaStream: MediaStream | null = null;
	private recordingSeq = 0;
	private speechParts: string[] = [];
	private speechPart = 0;
	private readonly speechCache = new Map<number, Blob>();
	private capabilitiesSub: Subscription | null = null;
	private sttSub: Subscription | null = null;
	private storageKey = '';

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
	/** Help pages: Bebo is a guided FAQ navigator (ready questions and answers, no free text, no model call). null outside the help pages. */
	readonly guidedRole = signal<HelpRole | null>(null);
	readonly guided = computed(() => this.guidedRole() !== null);
	/** The ready question the user picked (also set by the help page chips). */
	readonly guidedPick = signal<string | null>(null);
	readonly canReplay = computed(
		() => !!this.lastReply() && this.voiceEnabled() && !this.busy() && this.state() !== 'listening' && this.state() !== 'speaking' && !this.audioLoading(),
	);

	private currentRequestId: string | null = null;
	private watchdog: ReturnType<typeof setTimeout> | null = null;
	private audio: HTMLAudioElement | null = null;
	private manualAudio: HTMLAudioElement | null = null;
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
		this.restoreConversation();
		effect(() => { this.messages(); untracked(() => this.persistConversation()); });
		if (this.isBrowser) {
			const hidden = () => { if (document.hidden) { this.cancelListening(); this.cancelRecording(); this.stopLive(); this.stopAudio(); } };
			document.addEventListener('visibilitychange', hidden);
			inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', hidden));
		}
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
			this.cancelRecording();
			this.stopLive();
			this.capabilitiesSub?.unsubscribe();
			this.releaseAudio();
			this.speechLevelListeners.clear();
			this.audioContext?.close().catch(() => {});
			this.audioContext = null;
		});
	}

	// ── panel ──────────────────────────────────────────────────────────
	open(): void { this.dismissed.set(false); this.panelOpen.set(true); this.loadCapabilities(); }
	close(): void { this.cancel(); this.cancelListening(); this.cancelRecording(); this.stopLive(); this.stopAudio(); this.panelOpen.set(false); }
	toggle(): void { this.panelOpen() ? this.close() : this.open(); }
	dismiss(): void { this.close(); this.dismissed.set(true); }
	restore(): void { this.dismissed.set(false); }
	toggleDismissed(): void { this.dismissed() ? this.restore() : this.dismiss(); }

	setProfile(profile: string): void {
		if (!['auto', 'fast', 'balanced', 'deep'].includes(profile)) return;
		this.profile.set(profile as NonNullable<AssistantAskOptions['profile']>);
		if (profile !== 'auto') this.effort.set(profile === 'fast' ? 'low' : profile === 'deep' ? 'high' : 'medium');
	}
	setVolume(value: number): void { this.voiceVolume.set(Math.max(0, Math.min(1, value))); if (this.audio) this.audio.volume = this.voiceVolume(); }
	newConversation(): void {
		this.ensureSessionIdentity();
		this.cancel(); this.cancelListening(); this.cancelRecording(); this.stopLive(); this.releaseAudio();
		this.persistConversation();
		this.messages.set([]); this.lastReply.set(null); this.lastQuestion.set(''); this.progress.set([]); this.errorMessage.set(''); this.voiceNotice.set(''); this.commandReply.set(''); this.state.set('idle');
		this.activeConversationId.set(newConversationId());
		this.persistConversation();
	}
	selectConversation(id: string): boolean {
		this.ensureSessionIdentity();
		const conversation = this.conversations().find(c => c.id === id);
		if (!conversation) return false;
		if (id === this.activeConversationId() && this.messages().length) return true;
		this.cancel(); this.cancelListening(); this.cancelRecording(); this.stopLive(); this.releaseAudio();
		this.persistConversation();
		this.activeConversationId.set(id);
		this.messages.set(cleanMessages(conversation.messages));
		this.restoreReplyState();
		this.persistConversation();
		return true;
	}
	renameConversation(id: string, title: string): void {
		this.ensureSessionIdentity();
		if (!title.trim()) return;
		this.conversations.update(list => list.map(c => c.id === id ? { ...c, title: title.trim().slice(0, 70) } : c));
		this.persistConversation();
	}
	pinConversation(id: string): void {
		this.ensureSessionIdentity();
		this.conversations.update(list => list.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c));
		this.persistConversation();
	}
	deleteConversation(id: string): void {
		this.ensureSessionIdentity();
		if (!this.conversations().some(c => c.id === id)) return;
		if (id === this.activeConversationId()) {
			this.cancel(); this.cancelListening(); this.cancelRecording(); this.stopLive(); this.releaseAudio();
			this.activeConversationId.set(null); this.messages.set([]); this.restoreReplyState();
		}
		this.conversations.update(list => list.filter(c => c.id !== id));
		const next = this.conversations()[0];
		if (!this.activeConversationId() && next) { this.activeConversationId.set(next.id); this.messages.set(cleanMessages(next.messages)); this.restoreReplyState(); }
		this.persistConversation();
	}
	exportHistory(): AssistantHistory { this.ensureSessionIdentity(); this.persistConversation(); return { version: 2, activeId: this.activeConversationId(), conversations: this.conversations() }; }
	importHistory(value: unknown): boolean {
		this.ensureSessionIdentity();
		if (!this.authStore.token() || !readHistory(JSON.stringify(value)).conversations.length) return false;
		const merged = mergeHistory(this.exportHistory(), value);
		this.conversations.set(merged.conversations);
		if (!this.activeConversationId() && merged.activeId) { this.activeConversationId.set(merged.activeId); this.messages.set(merged.conversations.find(c => c.id === merged.activeId)?.messages ?? []); this.restoreReplyState(); }
		this.persistConversation(); return true;
	}
	editMessage(index: number, text: string): boolean {
		this.ensureSessionIdentity();
		if (this.guided() || this.busy() || this.messages()[index]?.role !== 'user' || !text.trim() || text.trim().length > MAX_QUESTION_LENGTH) return false;
		this.releaseAudio(); this.messages.update(list => list.slice(0, index)); return this.ask(text);
	}
	regenerate(): boolean {
		this.ensureSessionIdentity();
		const index = this.messages().map(m => m.role).lastIndexOf('user');
		return index >= 0 ? this.editMessage(index, this.messages()[index].text) : false;
	}
	runMotion(action: BeboCommandAction): void { if (!this.busy()) this.runCommand(action, ''); }
	loadCapabilities(): void {
		if (!this.isBrowser || !this.authStore.token() || this.capabilities() || this.capabilitiesSub) return;
		try {
			this.capabilitiesSub = this.injector.get(AssistantCapabilitiesService).get().subscribe({
				next: (data) => { if (data && Array.isArray(data.models) && Array.isArray(data.voices)) { this.capabilities.set(data); this.capabilityNotice.set(''); const preferred = data.voices.find(v => v.id === this.ttsVoice()) ?? data.voices[0]; if (preferred) this.ttsVoice.set(preferred.id as BeboVoice); if (data.defaultTtsModel) this.ttsModel.set(data.defaultTtsModel); } },
				error: () => { this.capabilitiesSub = null; this.capabilityNotice.set('تعذر تحميل خيارات النماذج؛ سيستخدم الخادم الإعداد الافتراضي.'); },
				complete: () => { this.capabilitiesSub = null; },
			});
		} catch { this.capabilitiesSub = null; }
	}
	/** Live is hidden unless the authenticated server advertises the capability. */
	toggleLive(): void {
		this.ensureSessionIdentity();
		if (this.liveActive() || this.liveConnecting()) { this.stopLive(); return; }
		if (!this.isBrowser || !this.authStore.token() || !this.capabilities()?.live?.available || this.busy() || this.guided()) return;
		if (!this.isSecureContext() || !navigator.mediaDevices?.getUserMedia) { this.liveNotice.set('الصوت المباشر يحتاج اتصالًا آمنًا وإذن الميكروفون.'); return; }
		this.cancelListening(); this.cancelRecording(); this.releaseAudio();
		const seq = ++this.liveSeq, identity = this.sessionIdentity;
		const current = () => seq === this.liveSeq && identity === untracked(() => this.identity());
		this.liveConnecting.set(true); this.liveNotice.set('جاري فتح المحادثة الصوتية…');
		this.liveTokenSub = this.injector.get(AssistantCapabilitiesService).liveToken({ voice: this.ttsVoice(), language: BEBO_DIALECTS[this.effectiveDialect()].language }).subscribe({
			next: token => {
				if (!current()) return;
				this.liveTokenSub = null;
				this.liveSession = new AssistantLiveSession({
					state: value => { if (!current()) return; this.zone.run(() => { this.liveConnecting.set(value === 'connecting'); this.liveActive.set(value === 'listening' || value === 'speaking'); this.state.set(value === 'speaking' ? 'speaking' : value === 'listening' ? 'listening' : 'idle'); if (value === 'listening') this.liveNotice.set('المحادثة الصوتية تعمل؛ يمكنك مقاطعة بيبو بالكلام.'); if (value === 'ended') this.liveTranscript.set(''); }); },
					transcript: (role, text, complete) => { if (!current()) return; this.zone.run(() => { if (complete) { this.messages.update(messages => [...messages, { role, text: text.slice(0, 30_000), createdAt: Date.now() }].slice(-100)); this.liveTranscript.set(''); } else this.liveTranscript.set(`${role === 'user' ? 'أنت' : 'بيبو'}: ${text.slice(-500)}`); }); },
					level: level => { if (current()) this.emitSpeechLevel(level); },
					error: message => { if (current()) this.zone.run(() => this.liveNotice.set(message)); },
				});
				void this.liveSession.start(token, this.capabilities()?.live?.tokenMaxSeconds);
			},
			error: () => { if (current()) { this.liveConnecting.set(false); this.liveNotice.set('الصوت المباشر غير متاح حاليًا. استخدم الإملاء أو الرسالة المسجلة.'); } },
		});
	}
	stopLive(): void { this.liveTokenSub?.unsubscribe(); this.liveTokenSub = null; this.liveSession?.stop(); this.liveSession = null; this.liveSeq++; this.liveActive.set(false); this.liveConnecting.set(false); this.liveTranscript.set(''); if (this.state() === 'listening' || this.state() === 'speaking') this.state.set('idle'); }
	async toggleRecording(): Promise<void> {
		this.ensureSessionIdentity();
		if (this.mediaRecorder) { this.mediaRecorder.stop(); return; }
		if (!this.authStore.token() || !this.capabilities()?.stt?.available || this.busy() || this.sttLoading() || this.guided()) return;
		this.stopLive(); this.cancelListening(); this.stopAudio(); const seq = ++this.recordingSeq;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (seq !== this.recordingSeq || !this.panelOpen()) { stream.getTracks().forEach(t => t.stop()); return; }
			this.mediaStream = stream; const recorder = new MediaRecorder(stream); const parts: Blob[] = []; this.mediaRecorder = recorder;
			let bytes = 0;
			recorder.ondataavailable = e => { if (e.data.size) { bytes += e.data.size; if (bytes > (this.capabilities()?.stt?.maxBytes ?? 5_000_000)) { this.cancelRecording(); this.micNotice.set('التسجيل تجاوز الحجم المسموح.'); } else parts.push(e.data); } };
			recorder.onstop = () => {
				stream.getTracks().forEach(t => t.stop()); this.mediaRecorder = null; this.mediaStream = null; this.recording.set(false); this.stopListening();
				if (seq !== this.recordingSeq || !parts.length) return;
				const blob = new Blob(parts, { type: recorder.mimeType }); const reader = new FileReader(); this.sttLoading.set(true);
				reader.onload = () => { if (seq !== this.recordingSeq) return; const audioBase64 = String(reader.result).split(',')[1]; this.sttSub = this.injector.get(AssistantCapabilitiesService).transcribe(audioBase64, blob.type, BEBO_DIALECTS[this.effectiveDialect()].language).subscribe({ next: result => { if (seq !== this.recordingSeq) return; const text = result.text ?? result.transcript ?? result.data?.text ?? result.data?.transcript ?? ''; this.sttLoading.set(false); if (text) this.ask(text.slice(0, MAX_QUESTION_LENGTH)); else this.micNotice.set('لم يظهر كلام واضح في التسجيل.'); }, error: () => { if (seq === this.recordingSeq) { this.sttLoading.set(false); this.micNotice.set('تعذر تفريغ التسجيل. يمكنك استخدام الإملاء أو الكتابة.'); } } }); };
				reader.onerror = () => { this.sttLoading.set(false); this.micNotice.set('تعذر قراءة التسجيل.'); };
				reader.readAsDataURL(blob);
			};
			this.recording.set(true); this.startListening(); recorder.start(1000);
			setTimeout(() => { if (this.mediaRecorder === recorder && seq === this.recordingSeq) recorder.stop(); }, 60_000);
		} catch { this.cancelRecording(); this.micNotice.set('تعذر فتح الميكروفون. تحقق من إذن المتصفح.'); }
	}
	cancelRecording(): void { this.recordingSeq++; this.sttSub?.unsubscribe(); this.sttSub = null; if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') { this.mediaRecorder.onstop = null; this.mediaRecorder.stop(); } this.mediaRecorder = null; this.mediaStream?.getTracks().forEach(t => t.stop()); this.mediaStream = null; this.recording.set(false); this.sttLoading.set(false); this.stopListening(); }

	/** Help page chips / the "اسأل المساعد" button: opens Bebo on a ready question (or on the list when no id). */
	openGuided(id: string | null = null): void {
		this.updateSupportRoute();
		this.guidedPick.set(id);
		this.open();
	}

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
		if (!(this.capabilities()?.voices.some(v => v.id === voice) ?? isBeboVoice(voice)) || voice === this.ttsVoice()) return;
		this.ttsVoice.set(voice as BeboVoice);
		this.stopLive();
		this.releaseAudio();
		this.saveTtsPrefs();
	}

	/** 'auto' or a handoff dialect id. Affects the mic language and TTS. */
	setDialect(dialect: string): void {
		if (dialect !== 'auto' && !isBeboDialect(dialect)) return;
		if (dialect === this.ttsDialect()) return;
		this.ttsDialect.set(dialect as BeboDialectChoice);
		this.stopLive();
		if (isBeboDialect(dialect)) this.detectedDialect.set(dialect);
		const reply = this.lastReply();
		if (reply && isBeboDialect(dialect)) this.lastReply.set({ ...reply, dialect });
		this.releaseAudio();
		this.saveTtsPrefs();
	}
	setTtsModel(model: string): void {
		if (model === this.ttsModel()) return;
		const allowed = this.capabilities()?.models.some(candidate => candidate.id === model && candidate.available !== false && candidate.modalities?.some(mode => ['tts','speech'].includes(mode.toLowerCase())));
		if (!allowed) return;
		this.releaseAudio(); this.ttsModel.set(model);
	}

	/** The dialect actually used for the mic language / speech. */
	effectiveDialect(): BeboDialect {
		const choice = this.ttsDialect();
		return choice === 'auto' ? this.detectedDialect() : choice;
	}

	// ── conversation ───────────────────────────────────────────────────
	ask(rawQuestion: string): boolean {
		this.ensureSessionIdentity();
		// Help pages are guided only: nothing typed or spoken ever reaches the model from here.
		if (this.guided()) return false;
		const question = rawQuestion.trim();
		if (!question || this.busy()) return false;
		this.stopLive(); this.cancelRecording();
		// Exact local Bebo command → animate locally; never sent upstream.
		const action = commandFor(question);
		if (action) {
			this.runCommand(action, question);
			return true;
		}
		if (question.length > MAX_QUESTION_LENGTH) {
			this.errorMessage.set(`اكتب سؤالًا لا يتجاوز ${MAX_QUESTION_LENGTH} حرفًا.`);
			this.state.set('error');
			return false;
		}
		this.cancelListening();
		this.detectedDialect.set(chooseDialect(question, this.ttsDialect(), this.detectedDialect()));
		this.messages.update((list) => [...(list.at(-1)?.role === 'user' ? list.slice(0, -1) : list), { role: 'user' as const, text: question, createdAt: Date.now() }].slice(-100));
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
		if (this.guided()) return;
		this.stopLive(); this.cancelRecording();
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
		this.stopLive(); this.liveNotice.set('');
		this.cancelRecording(); this.capabilitiesSub?.unsubscribe(); this.capabilitiesSub = null; this.capabilities.set(null); this.progress.set([]); this.textModel.set(''); this.ttsModel.set('');
		this.releaseAudio();
		this.lastReply.set(null);
		this.messages.set([]);
		this.conversations.set([]); this.activeConversationId.set(null); this.webSearchEnabled.set(false); this.storageNotice.set('');
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
		this.stopManualAudio();
		this.cancelPendingTts();
		this.stopPlayback();
	}

	/** Native reply players call this only when playback starts after a user action. */
	beginManualAudio(audio: HTMLAudioElement): void {
		this.ensureSessionIdentity();
		if (!this.isBrowser || !this.authStore.token() || this.busy() || this.state() === 'listening') {
			try { audio.pause(); } catch { /* detached player */ }
			return;
		}
		if (this.manualAudio === audio) return;
		this.stopAudio();
		this.manualAudio = audio;
		this.state.set('speaking');
		// Native players retain their own audio routing across pauses and old-reply replays.
		this.emitSpeechLevel(null);
	}

	/** Preserve the native player's position and cached clip after pause or end. */
	endManualAudio(audio: HTMLAudioElement): void {
		if (this.manualAudio !== audio) return;
		this.manualAudio = null;
		this.stopMeter();
		if (this.state() === 'speaking') this.state.set('idle');
	}

	private stopManualAudio(): void {
		const audio = this.manualAudio;
		if (!audio) return;
		this.endManualAudio(audio);
		try { audio.pause(); } catch { /* detached player */ }
	}

	/** Plays the last assistant reply again (re-synthesizes if needed). */
	replay(): boolean {
		this.ensureSessionIdentity();
		if (!this.canReplay()) return false;
		this.warmAudio();
		this.voiceNotice.set('');
		if (this.speechParts.length > 1) {
			this.stopPlayback(); this.speechPart = 0; this.synthesizePart(this.audioSeq, this.sessionIdentity);
		} else if (this.audio) {
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
			if (msgs[i].role === 'user' && a.role === 'assistant' && !a.streaming && a.text && a.text !== HELP_ASSISTANT_UNAVAILABLE_MESSAGE) {
				turns.push({ question: msgs[i].text.slice(0, 500), answer: a.text.slice(0, 1000) });
			}
		}
		return turns.slice(-3);
	}

	private runCommand(action: BeboCommandAction, text: string): void {
		const dialect = chooseDialect(text, this.ttsDialect(), this.detectedDialect());
		this.detectedDialect.set(dialect);
		this.cancelListening();
		if (this.skin() === 'classic' && (BEBO_EXTRA_POSES as readonly string[]).includes(action)) {
			this.commandReply.set('هذه الحركة متاحة لنديم — دليل وسيط. يمكنك تغيير الشخصية من الإعدادات.');
			return;
		}
		if (action === 'stop') this.stopAudio();
		if (action === 'roam_on' || action === 'roam_off') {
			this.commandReply.set(ROAMING_DISABLED_NOTICE);
			return;
		}
		this.commandReply.set(acknowledge(action as BeboAction, dialect));
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
		this.progress.set([]);
		this.currentRequestId = null;
		// historyTail() only contains completed pairs, so the question being
		// asked now (the trailing user message) is never duplicated into it.
		const history = this.historyTail();
		this.state.set('thinking');
		// Speech now comes from WaseetAI TTS (speak()), never the socket.
		const dialect = this.effectiveDialect();
		const path = (this.router.url || '/').split(/[?#]/)[0];
		let projectId: string | undefined; for (let route = this.router.routerState?.snapshot.root; route; route = route.firstChild!) { projectId ||= route.paramMap.get('projectId') ?? undefined; }
		const id = this.socket.ask(question, history, { skin: this.skin(), dialect, language: BEBO_DIALECTS[dialect].language, ...(this.profile() === 'auto' ? {} : { effort: this.effort() }), profile: this.profile(), ...(this.textModel() ? { model: this.textModel() } : {}), ...(this.webSearchEnabled() && this.capabilities()?.webSearch?.available ? { webSearch: true } : {}), pageContext: { path, ...(projectId ? { projectId } : {}) } });
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
			const error = normalizeAssistantError(e);
			this.fail(error.message, error.humanSupportFallback);
			return;
		}
		if (!this.currentRequestId || e.clientRequestId !== this.currentRequestId) return;

		switch (e.type) {
			case 'progress':
				this.progress.update(items => [...items.slice(-19), { stage: e.stage, message: e.message, status: e.status, runId: e.runId }]); this.armWatchdog(); break;
			case 'start':
				this.ensureAssistantBubble();
				this.armWatchdog();
				break;
			case 'chunk':
				if (isObsoleteKnowledgeRefusal((this.messages().at(-1)?.role === 'assistant' ? this.messages().at(-1)!.text : '') + e.chunk)) {
					const error = normalizeAssistantError({ code: 'NO_ANSWER' });
					this.fail(error.message, error.humanSupportFallback);
					return;
				}
				this.ensureAssistantBubble();
				this.streaming.set(true);
				this.armWatchdog();
				this.updateLastAssistant((m) => ({ ...m, text: m.text + e.chunk }));
				break;
			case 'citations':
				this.ensureAssistantBubble();
				this.updateLastAssistant((m) => ({ ...m, citations: e.citations, ...(e.searchSuggestionsHtml ? { searchSuggestionsHtml: e.searchSuggestionsHtml } : {}) }));
				break;
			case 'complete': {
				this.clearWatchdog();
				this.streaming.set(false);
				this.updateLastAssistant((m) => ({ ...m, streaming: false }));
				this.currentRequestId = null;
				this.state.set('idle');
				// A successful network answer is not a successful dispute or payment.
				if (!/نزاع|شكوى|احتيال|تحكيم|ضمان|سحب|استرداد|غرامة|عقوبة|dispute|fraud|complaint|escrow|withdraw|refund|penalty/i.test(this.lastQuestion())) this.successTick.update((n) => n + 1);
				const last = this.messages().at(-1);
				if (last?.role === 'assistant' && last.text.trim()) {
					this.lastReply.set({ text: last.text.trim(), dialect: this.effectiveDialect() });
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
		this.speechParts = speechChunks(reply.text, MAX_TTS_CHARS - 100); this.speechPart = 0;
		if (!this.speechParts.length) return;
		this.synthesizePart(this.audioSeq, this.sessionIdentity);
	}
	private synthesizePart(seq: number, identity: string): void {
		const reply = this.lastReply(); if (!reply) return;
		const stale = () => seq !== this.audioSeq || identity !== untracked(() => this.identity());
		const prepare = (blob: Blob) => {
			if (stale()) return;
			this.audioLoading.set(false);
			if (this.state() !== 'idle') return;
			this.speechCache.set(this.speechPart, blob);
			if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
			try { this.audioUrl = URL.createObjectURL(blob); this.audio = new Audio(this.audioUrl); this.audio.volume = this.voiceVolume(); this.playAudio(this.audio); } catch { this.voiceNotice.set(VOICE_PLAY_FAILED); }
		};
		const cached = this.speechCache.get(this.speechPart); if (cached) { prepare(cached); return; }
		this.tts ??= this.injector.get(AssistantTtsService);
		this.audioLoading.set(true);
		this.ttsSub = this.tts.synthesize({ text: this.speechParts[this.speechPart], voice: this.ttsVoice(), dialect: reply.dialect, ...(this.ttsModel() ? { model: this.ttsModel() } : {}) }).subscribe({
			next: (blob) => {
				if (stale()) return;
				this.ttsSub = null;
				this.audioLoading.set(false);
				prepare(blob);
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
		audio.onended = () => { if (this.audio !== audio) return; this.stopPlayback(); if (this.speechPart + 1 < this.speechParts.length) { this.speechPart++; this.synthesizePart(this.audioSeq, this.sessionIdentity); } };
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
		this.stopManualAudio();
		this.speechParts = []; this.speechPart = 0; this.speechCache.clear();
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
		this.persistConversation();
		this.sessionIdentity = identity;
		this.resetSession();
		this.restoreConversation();
	}

	private restoreConversation(): void {
		const user = this.authStore.currentUser();
		this.storageKey = this.authStore.token() && user?.id ? `waseet.bebo.session.${encodeURIComponent(String(user.id))}.${encodeURIComponent(String(user.activeRole ?? user.accountType))}` : '';
		let saved = emptyHistory();
		if (this.isBrowser && this.storageKey) {
			try {
				const raw = localStorage.getItem(this.storageKey);
				saved = readHistory(raw);
				// Keep the source intact before the first v2 write. It is per-user and per-role.
				if (raw && JSON.parse(raw)?.version === 1 && saved.conversations.length) {
					try { const backupKey = `${this.storageKey}.legacy-v1`; if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, raw); }
					catch { this.storageNotice.set('تعذر حفظ النسخة الاحتياطية للسجل القديم.'); }
				}
			}
			catch { this.storageNotice.set('تعذر فتح السجل المحلي في هذا المتصفح.'); }
		}
		this.conversations.set(saved.conversations); this.activeConversationId.set(saved.activeId);
		this.messages.set(saved.conversations.find(c => c.id === saved.activeId)?.messages ?? []);
		this.restoreReplyState();
	}
	private persistConversation(): void {
		if (!this.isBrowser || !this.storageKey) return;
		const messages = cleanMessages(this.messages());
		let id = this.activeConversationId();
		if (!id && messages.length) { id = newConversationId(); this.activeConversationId.set(id); }
		const list = [...this.conversations()];
		if (id) {
			const index = list.findIndex(c => c.id === id), previous = list[index];
			// Navigation/hydration may temporarily clear a view; preserve its saved history.
			// Explicit new/delete operations change the active id before saving emptiness.
			if (!messages.length && previous?.messages.length) {
				try { localStorage.setItem(this.storageKey, JSON.stringify({ version: 2, activeId: id, conversations: list })); }
				catch { this.storageNotice.set('تعذر حفظ السجل محليًا. صدّر محادثاتك للاحتفاظ بها.'); }
				return;
			}
			const changed = !previous || JSON.stringify(previous.messages) !== JSON.stringify(messages);
			const title = previous && previous.title !== 'محادثة جديدة' ? previous.title : conversationTitle(messages);
			const conversation = { id, title, messages, updatedAt: changed ? Date.now() : previous.updatedAt, pinned: previous?.pinned ?? false };
			if (index >= 0) list[index] = conversation; else list.unshift(conversation);
		}
		const saved = readHistory(JSON.stringify({ version: 2, activeId: id, conversations: list }));
		this.conversations.set(saved.conversations);
		try { localStorage.setItem(this.storageKey, JSON.stringify(saved)); this.storageNotice.set(''); }
		catch { this.storageNotice.set('تعذر حفظ السجل محليًا. صدّر محادثاتك للاحتفاظ بها.'); }
	}
	private restoreReplyState(): void {
		this.lastQuestion.set([...this.messages()].reverse().find(m => m.role === 'user')?.text ?? '');
		const last = this.messages().at(-1);
		this.lastReply.set(last?.role === 'assistant' && last.text ? { text: last.text, dialect: this.effectiveDialect() } : null);
		this.progress.set([]); this.errorMessage.set(''); this.humanSupportFallback.set(false); this.voiceNotice.set(''); this.micNotice.set(''); this.commandReply.set(''); this.streaming.set(false); this.state.set('idle');
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
		const error = normalizeAssistantError({ message, humanSupportFallback });
		this.clearWatchdog();
		if (this.currentRequestId) this.socket.cancel(this.currentRequestId);
		this.currentRequestId = null;
		this.streaming.set(false);
		// Never leave a half-written answer that looks like a real reply.
		this.dropStreamingBubble();
		this.errorMessage.set(error.message);
		this.humanSupportFallback.set(error.humanSupportFallback);
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
		const role = helpRoleOfUrl(url);
		this.guidedRole.set(role);
		if (!role) this.guidedPick.set(null);
		if (url.startsWith('/client-overview')) this.supportRoute.set('/client-overview/help/live-support');
		else if (url.startsWith('/provider-overview')) this.supportRoute.set('/provider-overview/help/live-support');
		else if (url.startsWith('/marketer-overview')) this.supportRoute.set('/marketer-overview/help');
		else this.supportRoute.set(null);
	}

	setSkin(skin: BeboSkin): void {
		if (skin !== 'scout' && skin !== 'classic') return;
		this.skin.set(skin);
		try {
			if (typeof localStorage !== 'undefined') localStorage.setItem(SKIN_PREF_KEY, skin);
		} catch {}
	}

	private loadSkinPref(): BeboSkin {
		try {
			const s = typeof localStorage !== 'undefined' ? localStorage.getItem(SKIN_PREF_KEY) : null;
			if (s === 'scout' || s === 'classic') return s;
		} catch {}
		return 'scout';
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
