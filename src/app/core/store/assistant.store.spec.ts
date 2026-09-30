import { TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AssistantStore, ANSWER_WATCHDOG_MS, MAX_TTS_CHARS, ROAMING_DISABLED_NOTICE } from './assistant.store';
import { HelpAssistantSocketService, HelpStreamEvent } from '../services/help-assistant-socket.service';
import { AssistantTtsError, AssistantTtsService, TtsRequest } from '../services/assistant-tts.service';
import { SECURE_CONTEXT, SPEECH_ERROR_MESSAGES, SPEECH_INSECURE, SPEECH_RECOGNITION, SPEECH_UNSUPPORTED } from '../services/speech-recognition';
import { AuthStore } from './auth.store';

// Avatar/assistant state machine. Every external dependency is faked: the
// socket transport (same `events$` stream), the WaseetAI TTS HTTP service
// (a controllable Subject per request), the browser SpeechRecognition and
// HTMLAudioElement. No network, no real socket, no real microphone.

class FakeHelpSocket {
	events = new Subject<HelpStreamEvent>();
	events$ = this.events.asObservable();
	asks: Array<{ question: string; history: any[]; options: any; id: string | null }> = [];
	cancels: Array<string | null> = [];
	nextId: string | null = 'req-1';
	ask = vi.fn((question: string, history: any[] = [], options: any = {}) => {
		const id = this.nextId;
		this.asks.push({ question, history, options, id });
		if (!id) {
			this.events.next({ type: 'error', clientRequestId: 'local', code: 'AUTH_REQUIRED', message: 'يجب تسجيل الدخول', humanSupportFallback: false });
		}
		return id;
	});
	cancel = vi.fn((id: string | null) => { this.cancels.push(id); });
	disconnect = vi.fn();
	emit(e: HelpStreamEvent) { this.events.next(e); }
}

class FakeTts {
	requests: Array<{ req: TtsRequest; subject: Subject<Blob>; unsubscribed: boolean }> = [];
	synthesize = vi.fn((req: TtsRequest) => {
		const subject = new Subject<Blob>();
		const entry = { req, subject, unsubscribed: false };
		this.requests.push(entry);
		return new Observable<Blob>((sub) => {
			const s = subject.subscribe(sub);
			return () => { entry.unsubscribed = true; s.unsubscribe(); };
		});
	});
	resolveLast(blob = new Blob(['RIFF....WAVE'], { type: 'audio/wav' })) {
		const last = this.requests.at(-1)!;
		last.subject.next(blob);
		last.subject.complete();
	}
	failLast(code: ConstructorParameters<typeof AssistantTtsError>[0] = 'UNAVAILABLE') {
		this.requests.at(-1)!.subject.error(new AssistantTtsError(code));
	}
}

class FakeAudio {
	static instances: FakeAudio[] = [];
	static playResult: 'ok' | 'reject' = 'ok';
	onplaying: (() => void) | null = null;
	onended: (() => void) | null = null;
	onerror: (() => void) | null = null;
	paused = false;
	currentTime = 0;
	plays = 0;
	removedSrc = false;
	constructor(public src: string) { FakeAudio.instances.push(this); }
	play() { this.plays++; this.paused = false; return FakeAudio.playResult === 'ok' ? Promise.resolve() : Promise.reject(new Error('NotAllowedError')); }
	pause() { this.paused = true; }
	removeAttribute(name: string) { if (name === 'src') this.removedSrc = true; }
	load() {}
}

class FakeRecognition {
	static instances: FakeRecognition[] = [];
	static throwOnStart = false;
	lang = '';
	continuous = true;
	interimResults = false;
	maxAlternatives = 0;
	onstart: (() => void) | null = null;
	onresult: ((e: any) => void) | null = null;
	onerror: ((e: { error: string }) => void) | null = null;
	onend: (() => void) | null = null;
	started = false;
	stopped = false;
	aborted = false;
	constructor() { FakeRecognition.instances.push(this); }
	start() { if (FakeRecognition.throwOnStart) throw new Error('InvalidStateError'); this.started = true; this.onstart?.(); }
	stop() { this.stopped = true; }
	abort() { this.aborted = true; }
	/** Simulates the browser delivering a result (interim or final). */
	say(transcript: string, isFinal = true) {
		this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript }], { isFinal })] });
	}
	end() { this.onend?.(); }
	fail(error: string) { this.onerror?.({ error }); this.onend?.(); }
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

function stubBrowser() {
	FakeAudio.instances = [];
	FakeAudio.playResult = 'ok';
	FakeRecognition.instances = [];
	FakeRecognition.throwOnStart = false;
	vi.stubGlobal('Audio', FakeAudio as any);
	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
	URL.createObjectURL = vi.fn(() => 'blob:fake');
	URL.revokeObjectURL = vi.fn();
}

describe('AssistantStore (Help assistant + Avatar state machine)', () => {
	let store: AssistantStore;
	let socket: FakeHelpSocket;
	let tts: FakeTts;

	beforeEach(() => {
		stubBrowser();
		socket = new FakeHelpSocket();
		tts = new FakeTts();
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{ provide: HelpAssistantSocketService, useValue: socket },
				{ provide: AssistantTtsService, useValue: tts },
				{ provide: SPEECH_RECOGNITION, useValue: FakeRecognition },
				{ provide: SECURE_CONTEXT, useValue: () => true },
			],
		});
		store = TestBed.inject(AssistantStore);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	const answer = (id = 'req-1', chunks = ['الضمان ', 'يحمي الطرفين.']) => {
		socket.emit({ type: 'start', clientRequestId: id });
		for (const chunk of chunks) socket.emit({ type: 'chunk', clientRequestId: id, chunk });
		socket.emit({ type: 'complete', clientRequestId: id });
	};

	it('starts idle with an empty conversation (no canned greeting)', () => {
		expect(store.state()).toBe('idle');
		expect(store.messages()).toEqual([]);
	});

	it('idle → thinking on ask, renders chunks progressively, → idle on complete (no audio)', () => {
		expect(store.ask('كيف يعمل الضمان؟')).toBe(true);
		expect(store.state()).toBe('thinking');
		expect(socket.asks[0].question).toBe('كيف يعمل الضمان؟');
		expect(socket.ask.mock.calls[0].length).toBe(2); // question + history only — no socket voice flag

		socket.emit({ type: 'start', clientRequestId: 'req-1' });
		socket.emit({ type: 'chunk', clientRequestId: 'req-1', chunk: 'الضمان ' });
		expect(store.state()).toBe('thinking');
		expect(store.streaming()).toBe(true);
		expect(store.messages()[1]).toEqual({ role: 'assistant', text: 'الضمان ', streaming: true });
		socket.emit({ type: 'chunk', clientRequestId: 'req-1', chunk: 'يحمي الطرفين.' });
		expect(store.messages()[1].text).toBe('الضمان يحمي الطرفين.');

		socket.emit({ type: 'complete', clientRequestId: 'req-1' });
		expect(store.state()).toBe('idle');
		expect(store.streaming()).toBe(false);
		expect(store.messages()[1].streaming).toBe(false);
		expect(tts.synthesize).not.toHaveBeenCalled();
	});

	it('thinking → error on help:error: truthful message, partial bubble dropped, retry re-sends without duplicating', () => {
		store.ask('سؤال');
		socket.emit({ type: 'start', clientRequestId: 'req-1' });
		socket.emit({ type: 'chunk', clientRequestId: 'req-1', chunk: 'جزء' });
		socket.emit({ type: 'error', clientRequestId: 'req-1', code: 'NO_ANSWER', message: 'لم يجد المساعد الذكي إجابة معتمدة', humanSupportFallback: true });

		expect(store.state()).toBe('error');
		expect(store.errorMessage()).toContain('إجابة معتمدة');
		expect(store.humanSupportFallback()).toBe(true);
		expect(store.messages()).toEqual([{ role: 'user', text: 'سؤال' }]);

		socket.nextId = 'req-2';
		store.retry();
		expect(store.state()).toBe('thinking');
		expect(socket.asks.at(-1)!.question).toBe('سؤال');
		expect(store.messages().filter((m) => m.role === 'user').length).toBe(1);
		answer('req-2');
		expect(store.state()).toBe('idle');
	});

	it('no authenticated session → error state immediately, nothing streamed', () => {
		socket.nextId = null;
		store.ask('سؤال');
		expect(store.state()).toBe('error');
		expect(store.errorMessage()).toContain('تسجيل الدخول');
	});

	it('connection lost while thinking → error; while idle → ignored', () => {
		socket.emit({ type: 'connection_lost' });
		expect(store.state()).toBe('idle');
		store.ask('سؤال');
		socket.emit({ type: 'connection_lost' });
		expect(store.state()).toBe('error');
		expect(socket.cancels).toContain('req-1');
	});

	it('client watchdog: no terminal event in time → error (and upstream cancelled)', () => {
		vi.useFakeTimers();
		store.ask('سؤال');
		vi.advanceTimersByTime(ANSWER_WATCHDOG_MS + 1);
		expect(store.state()).toBe('error');
		expect(socket.cancels).toContain('req-1');
	});

	it('events for a stale/other request are ignored', () => {
		store.ask('سؤال');
		socket.emit({ type: 'chunk', clientRequestId: 'someone-else', chunk: 'دخيل' });
		socket.emit({ type: 'error', clientRequestId: 'someone-else', code: 'UNAVAILABLE', message: 'x', humanSupportFallback: true });
		expect(store.state()).toBe('thinking');
		expect(store.messages().length).toBe(1);
	});

	it('cancel() stops thinking and asks the backend to abort', () => {
		store.ask('سؤال');
		store.cancel();
		expect(store.state()).toBe('idle');
		expect(socket.cancel).toHaveBeenCalledWith('req-1');
	});

	it('sends at most the last 3 completed turns as history', () => {
		for (let i = 0; i < 4; i++) {
			socket.nextId = `r${i}`;
			store.ask(`سؤال ${i}`);
			answer(`r${i}`, [`إجابة ${i}`]);
		}
		socket.nextId = 'last';
		store.ask('سؤال أخير');
		const { history } = socket.asks.at(-1)!;
		expect(history.length).toBe(3);
		expect(history[0]).toEqual({ question: 'سؤال 1', answer: 'إجابة 1' });
		expect(history[2]).toEqual({ question: 'سؤال 3', answer: 'إجابة 3' });
	});

	it('openAndAsk opens the shared panel and asks (used by help hub pages)', () => {
		store.openAndAsk('كيف أسحب أرباحي؟');
		expect(store.panelOpen()).toBe(true);
		expect(store.state()).toBe('thinking');
	});

	// ── WaseetAI TTS (mocked AssistantTtsService) ─────────────────────────

	describe('WaseetAI TTS playback', () => {
		beforeEach(() => store.setVoiceEnabled(true));

		it('complete → TTS request with the answer text + selected voice/dialect; speaking while audio plays → idle when it ends', async () => {
			store.setVoice('Kore');
			store.setDialect('saudi');
			store.ask('سؤال');
			answer();
			expect(store.state()).toBe('idle');
			expect(store.audioLoading()).toBe(true);
			expect(tts.requests[0].req).toEqual({ text: 'الضمان يحمي الطرفين.', voice: 'Kore', dialect: 'saudi' });

			tts.resolveLast();
			expect(store.audioLoading()).toBe(false);
			const audio = FakeAudio.instances[0];
			expect(audio.src).toBe('blob:fake');
			expect(audio.plays).toBe(1);
			audio.onplaying!();
			expect(store.state()).toBe('speaking');
			audio.onended!();
			expect(store.state()).toBe('idle');
			// The clip is kept for replay until released.
			expect(URL.revokeObjectURL).not.toHaveBeenCalled();
			expect(store.canReplay()).toBe(true);
		});

		it('TTS failure: text answer stays complete, state idle, a truthful voice note — no fake speech', () => {
			store.ask('سؤال');
			answer();
			tts.failLast('UNAVAILABLE');
			expect(store.state()).toBe('idle');
			expect(store.errorMessage()).toBe('');
			expect(store.messages()[1].text).toBe('الضمان يحمي الطرفين.');
			expect(store.voiceNotice()).toContain('الصوت غير متاح');
			expect(store.audioLoading()).toBe(false);
			expect(FakeAudio.instances.length).toBe(0);
		});

		it('TTS rate limited → specific notice', () => {
			store.ask('سؤال');
			answer();
			tts.failLast('RATE_LIMITED');
			expect(store.voiceNotice()).toContain('طلبات صوت كثيرة');
		});

		it('audio playback error event → idle, audio released, notice', () => {
			store.ask('سؤال');
			answer();
			tts.resolveLast();
			FakeAudio.instances[0].onplaying!();
			FakeAudio.instances[0].onerror!();
			expect(store.state()).toBe('idle');
			expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
			expect(store.voiceNotice()).toContain('تعذر تشغيل الصوت');
		});

		it('audio blocked by the browser: returns to idle and offers replay, never falls back to fake speech', async () => {
			FakeAudio.playResult = 'reject';
			store.ask('سؤال');
			answer();
			tts.resolveLast();
			await flush();
			expect(store.state()).toBe('idle');
			expect(store.voiceNotice()).toContain('منع المتصفح');
			expect(store.canReplay()).toBe(true);
		});

		it('an answer longer than the TTS bound is not sent to TTS', () => {
			store.ask('سؤال');
			answer('req-1', ['x'.repeat(MAX_TTS_CHARS + 1)]);
			expect(tts.synthesize).not.toHaveBeenCalled();
			expect(store.voiceNotice()).toContain('أطول');
		});

		it('stopAudio() stops playback (speaking → idle) and keeps the clip for replay; replay() plays the SAME clip without a new TTS call', () => {
			store.ask('سؤال');
			answer();
			tts.resolveLast();
			const audio = FakeAudio.instances[0];
			audio.onplaying!();
			store.stopAudio();
			expect(audio.paused).toBe(true);
			expect(store.state()).toBe('idle');
			expect(store.replay()).toBe(true);
			expect(audio.plays).toBe(2);
			expect(audio.currentTime).toBe(0);
			expect(tts.synthesize).toHaveBeenCalledTimes(1);
			audio.onplaying!();
			expect(store.state()).toBe('speaking');
		});

		it('stopAudio() while the TTS request is pending cancels it (HTTP unsubscribed) and a late response is ignored', () => {
			store.ask('سؤال');
			answer();
			store.stopAudio();
			expect(tts.requests[0].unsubscribed).toBe(true);
			expect(store.audioLoading()).toBe(false);
			tts.requests[0].subject.next(new Blob(['x'], { type: 'audio/wav' }));
			expect(FakeAudio.instances.length).toBe(0);
		});

		it('changing voice/dialect releases the cached clip (URL revoked) so replay re-synthesizes with the new choice', () => {
			store.ask('سؤال');
			answer();
			tts.resolveLast();
			FakeAudio.instances[0].onended!();
			store.setVoice('Charon');
			expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
			expect(FakeAudio.instances[0].removedSrc).toBe(true);
			store.replay();
			expect(tts.requests.at(-1)!.req.voice).toBe('Charon');
			store.setDialect('english');
			store.replay();
			expect(tts.requests.at(-1)!.req.dialect).toBe('english');
		});

		it('voice/dialect setters only accept the handoff lists', () => {
			store.setVoice('Alloy');
			store.setDialect('levantine');
			expect(store.ttsVoice()).toBe('Puck');
			expect(store.ttsDialect()).toBe('auto');
			store.setDialect('gulf');
			expect(store.effectiveDialect()).toBe('gulf');
		});

		it("'auto' dialect is detected from the user's words (handoff chooseDialect)", () => {
			store.ask('شلونك شنو الضمان');
			answer();
			expect(tts.requests[0].req.dialect).toBe('gulf');
		});

		it('a new question releases the previous clip (no stale replay) and old object URL is revoked', () => {
			store.ask('سؤال');
			answer();
			tts.resolveLast();
			FakeAudio.instances[0].onended!();
			socket.nextId = 'req-2';
			store.ask('سؤال ثاني');
			expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
			expect(store.canReplay()).toBe(false);
		});

		it('disabling voice releases audio and hides replay', () => {
			store.ask('سؤال');
			answer();
			tts.resolveLast();
			store.setVoiceEnabled(false);
			expect(FakeAudio.instances[0].paused).toBe(true);
			expect(store.canReplay()).toBe(false);
		});
	});

	it('voice disabled: no TTS request after an answer', () => {
		store.ask('سؤال');
		answer();
		expect(tts.synthesize).not.toHaveBeenCalled();
		expect(store.canReplay()).toBe(false);
	});

	// ── Microphone (fake SpeechRecognition) ───────────────────────────────

	describe('microphone / speech-to-text', () => {
		it('nothing touches the microphone until the user clicks it', () => {
			expect(FakeRecognition.instances.length).toBe(0);
			expect(store.micSupported).toBe(true);
		});

		it('supported: click → listening; final transcript → the SAME authenticated ask() flow → thinking', () => {
			store.toggleListening();
			const rec = FakeRecognition.instances[0];
			expect(rec.started).toBe(true);
			expect(rec.lang).toBe('ar-EG');
			expect(rec.continuous).toBe(false);
			expect(rec.interimResults).toBe(true);
			expect(store.state()).toBe('listening');
			expect(store.micActive()).toBe(true);

			rec.say('كيف يعمل', false);
			expect(store.transcript()).toBe('كيف يعمل');
			rec.say('كيف يعمل الضمان');
			rec.end();
			expect(store.micActive()).toBe(false);
			expect(store.state()).toBe('thinking');
			expect(socket.asks[0].question).toBe('كيف يعمل الضمان');
			expect(store.messages()).toEqual([{ role: 'user', text: 'كيف يعمل الضمان' }]);
		});

		it('clicking again while listening finishes recognition (stop, not abort) so the transcript is sent', () => {
			store.toggleListening();
			const rec = FakeRecognition.instances[0];
			store.toggleListening();
			expect(rec.stopped).toBe(true);
			rec.say('سؤالي');
			rec.end();
			expect(socket.asks[0].question).toBe('سؤالي');
		});

		it('recognition language follows the selected dialect', () => {
			store.setDialect('english');
			store.toggleListening();
			expect(FakeRecognition.instances[0].lang).toBe('en-US');
		});

		it('permission denied → handoff message, idle, nothing sent', () => {
			store.toggleListening();
			FakeRecognition.instances[0].fail('not-allowed');
			expect(store.state()).toBe('idle');
			expect(store.micNotice()).toBe(SPEECH_ERROR_MESSAGES['not-allowed']);
			expect(socket.ask).not.toHaveBeenCalled();
		});

		it('no speech → message, idle; generic error → generic message', () => {
			store.toggleListening();
			FakeRecognition.instances[0].fail('no-speech');
			expect(store.micNotice()).toBe(SPEECH_ERROR_MESSAGES['no-speech']);
			store.toggleListening();
			FakeRecognition.instances[1].fail('something-new');
			expect(store.micNotice()).toContain('التسجيل وقف');
			expect(store.state()).toBe('idle');
		});

		it('an error after a partial transcript never sends the partial text', () => {
			store.toggleListening();
			const rec = FakeRecognition.instances[0];
			rec.say('نص جزئي');
			rec.fail('network');
			expect(socket.ask).not.toHaveBeenCalled();
		});

		it('cancelled (aborted by the browser) → idle, no error message, nothing sent', () => {
			store.toggleListening();
			FakeRecognition.instances[0].fail('aborted');
			expect(store.state()).toBe('idle');
			expect(store.micNotice()).toBe('');
			expect(socket.ask).not.toHaveBeenCalled();
		});

		it('cancelListening() aborts immediately and a late result/end is ignored', () => {
			store.toggleListening();
			const rec = FakeRecognition.instances[0];
			const onend = rec.onend!;
			const onresult = rec.onresult!;
			store.cancelListening();
			expect(rec.aborted).toBe(true);
			expect(store.state()).toBe('idle');
			onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'متأخر' }], { isFinal: true })] });
			onend();
			expect(socket.ask).not.toHaveBeenCalled();
		});

		it('start() throwing → idle + message', () => {
			FakeRecognition.throwOnStart = true;
			store.toggleListening();
			expect(store.state()).toBe('idle');
			expect(store.micActive()).toBe(false);
			expect(store.micNotice()).toContain('مش قادر أفتح المايك');
		});

		it('refused while an answer is in flight', () => {
			store.ask('سؤال');
			store.toggleListening();
			expect(FakeRecognition.instances.length).toBe(0);
			expect(store.state()).toBe('thinking');
		});

		it('listening stops audio that is playing', () => {
			store.setVoiceEnabled(true);
			store.ask('سؤال');
			answer();
			tts.resolveLast();
			FakeAudio.instances[0].onplaying!();
			store.toggleListening();
			expect(FakeAudio.instances[0].paused).toBe(true);
			expect(store.state()).toBe('listening');
		});

		it('a spoken Bebo command animates Bebo locally and is not sent upstream', () => {
			store.toggleListening();
			const rec = FakeRecognition.instances[0];
			rec.say('ارقص');
			rec.end();
			expect(socket.ask).not.toHaveBeenCalled();
			expect(store.beboCommand()?.action).toBe('dance');
		});

		it('typing a question while listening cancels the mic and sends the typed text', () => {
			store.toggleListening();
			const rec = FakeRecognition.instances[0];
			store.ask('سؤال مكتوب');
			expect(rec.aborted).toBe(true);
			expect(socket.asks[0].question).toBe('سؤال مكتوب');
		});
	});

	// ── Local Bebo commands ───────────────────────────────────────────────

	describe('local Bebo commands', () => {
		it('Arabic command → local action + handoff acknowledgement; not sent upstream, not added to history', () => {
			expect(store.ask('ارقص')).toBe(true);
			expect(socket.ask).not.toHaveBeenCalled();
			expect(store.messages()).toEqual([]);
			expect(store.beboCommand()).toEqual({ action: 'dance', seq: 1 });
			expect(store.commandReply()).toBe('على واحدة ونص! شوف الرقصة دي.');
			expect(store.state()).toBe('idle');
		});

		it('English command → local action with the English acknowledgement', () => {
			store.ask('Dance for me');
			expect(store.beboCommand()?.action).toBe('dance');
			expect(store.commandReply()).toBe('Here comes my little dance!');
			// Handoff chooseDialect needs >4 Latin letters to detect English;
			// a short word keeps the current dialect unless English is selected.
			store.ask('Jump');
			expect(store.beboCommand()?.action).toBe('jump');
			expect(store.commandReply()).toBe('Sure! Here comes a little jump.');
		});

		it('repeating a command produces a new seq (Bebo replays it)', () => {
			store.ask('انط');
			store.ask('انط');
			expect(store.beboCommand()).toEqual({ action: 'jump', seq: 2 });
		});

		it('platform questions are NOT intercepted and go to the assistant', () => {
			for (const q of ['ازاي أعمل مشروع؟', 'كيف أسحب أرباحي؟', 'ارقص معايا في المشروع ده ازاي', 'what is escrow?']) {
				socket.nextId = `q-${q.length}`;
				store.ask(q);
				expect(socket.asks.at(-1)!.question).toBe(q);
				answer(`q-${q.length}`, ['إجابة']);
			}
			expect(store.beboCommand()).toBeNull();
		});

		it("'stop' command stops audio", () => {
			store.setVoiceEnabled(true);
			store.ask('سؤال');
			answer();
			tts.resolveLast();
			FakeAudio.instances[0].onplaying!();
			store.ask('اسكت');
			expect(FakeAudio.instances[0].paused).toBe(true);
			expect(store.state()).toBe('idle');
			expect(store.beboCommand()?.action).toBe('stop');
		});

		it('roaming commands are recognised but roaming is NOT enabled (no Bebo command emitted)', () => {
			store.ask('اتحرك لوحدك');
			expect(store.beboCommand()).toBeNull();
			expect(store.commandReply()).toBe(ROAMING_DISABLED_NOTICE);
			expect(socket.ask).not.toHaveBeenCalled();
		});

		it('commands are refused while an answer is in flight', () => {
			store.ask('سؤال');
			expect(store.ask('ارقص')).toBe(false);
			expect(store.beboCommand()).toBeNull();
		});

		it('a following real question clears the command acknowledgement', () => {
			store.ask('سلم');
			expect(store.commandReply()).not.toBe('');
			store.ask('سؤال');
			expect(store.commandReply()).toBe('');
		});
	});
});

describe('AssistantStore microphone availability', () => {
	afterEach(() => vi.unstubAllGlobals());

	const make = (Recognition: any, secure: boolean) => {
		stubBrowser();
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{ provide: HelpAssistantSocketService, useValue: new FakeHelpSocket() },
				{ provide: SPEECH_RECOGNITION, useValue: Recognition },
				{ provide: SECURE_CONTEXT, useValue: () => secure },
			],
		});
		return TestBed.inject(AssistantStore);
	};

	it('unsupported browser → truthful message, stays idle, never listening', () => {
		const store = make(null, true);
		expect(store.micSupported).toBe(false);
		store.toggleListening();
		expect(store.micNotice()).toBe(SPEECH_UNSUPPORTED);
		expect(store.state()).toBe('idle');
	});

	it('insecure context (plain http) → message, no recognition created', () => {
		const store = make(FakeRecognition, false);
		store.toggleListening();
		expect(store.micNotice()).toBe(SPEECH_INSECURE);
		expect(FakeRecognition.instances.length).toBe(0);
	});
});

// ── Session isolation (logout / identity change) + Bebo state plumbing ──
// AuthStore is faked with writable signals so identity changes can be
// simulated exactly as AuthStore.logout()/authenticate() perform them
// (SPA navigation, no page reload — the root store instance survives).

describe('AssistantStore session isolation, listening/happy and speech meter', () => {
	let store: AssistantStore;
	let socket: FakeHelpSocket;
	let tts: FakeTts;
	let token: WritableSignal<string | null>;
	let user: WritableSignal<{ id: string; accountType: string; activeRole?: string; firstName?: string } | null>;

	const USER_A = { id: 'user-a', accountType: 'CLIENT', activeRole: 'CLIENT', firstName: 'A' };
	const USER_B = { id: 'user-b', accountType: 'CLIENT', activeRole: 'CLIENT', firstName: 'B' };

	beforeEach(() => {
		stubBrowser();
		socket = new FakeHelpSocket();
		tts = new FakeTts();
		token = signal<string | null>('jwt-a');
		user = signal<any>(USER_A);
		TestBed.configureTestingModule({
			providers: [
				provideRouter([]),
				{ provide: HelpAssistantSocketService, useValue: socket },
				{ provide: AuthStore, useValue: { token, currentUser: user } },
				{ provide: AssistantTtsService, useValue: tts },
				{ provide: SPEECH_RECOGNITION, useValue: FakeRecognition },
				{ provide: SECURE_CONTEXT, useValue: () => true },
			],
		});
		store = TestBed.inject(AssistantStore);
		TestBed.tick();
	});

	afterEach(() => vi.unstubAllGlobals());

	const answer = (id: string, text: string) => {
		socket.emit({ type: 'start', clientRequestId: id });
		socket.emit({ type: 'chunk', clientRequestId: id, chunk: text });
		socket.emit({ type: 'complete', clientRequestId: id });
	};

	/** User A has a completed private conversation, with the panel open. */
	const userAConversation = () => {
		socket.nextId = 'a-1';
		store.openAndAsk('سؤال خاص بالمستخدم أ');
		answer('a-1', 'إجابة خاصة بالمستخدم أ');
		expect(store.messages().length).toBe(2);
		expect(store.historyTail().length).toBe(1);
	};

	/** User A's answer is being spoken (voice on). */
	const userASpeaking = () => {
		store.setVoiceEnabled(true);
		userAConversation();
		tts.resolveLast();
		FakeAudio.instances[0].onplaying!();
		expect(store.state()).toBe('speaking');
	};

	const expectPristine = () => {
		expect(store.messages()).toEqual([]);
		expect(store.historyTail()).toEqual([]);
		expect(store.lastQuestion()).toBe('');
		expect(store.state()).toBe('idle');
		expect(store.streaming()).toBe(false);
		expect(store.errorMessage()).toBe('');
		expect(store.humanSupportFallback()).toBe(false);
		expect(store.voiceNotice()).toBe('');
		expect(store.panelOpen()).toBe(false);
		expect(store.canReplay()).toBe(false);
		expect(store.micActive()).toBe(false);
		expect(store.transcript()).toBe('');
		expect(store.commandReply()).toBe('');
		expect(store.audioLoading()).toBe(false);
	};

	const logout = () => { token.set(null); user.set(null); TestBed.tick(); };

	it('1. logout clears messages', () => {
		userAConversation();
		logout();
		expectPristine();
	});

	it('2. logout clears the last (replayable) response', () => {
		store.setVoiceEnabled(true);
		userAConversation();
		tts.resolveLast();
		FakeAudio.instances[0].onended!();
		expect(store.canReplay()).toBe(true);
		logout();
		expect(store.canReplay()).toBe(false);
		// replay() cannot resurrect it.
		const before = tts.synthesize.mock.calls.length;
		expect(store.replay()).toBe(false);
		expect(tts.synthesize.mock.calls.length).toBe(before);
		expect(FakeAudio.instances[0].plays).toBe(1);
	});

	it('3. logout stops audio immediately (paused, URL revoked, idle)', () => {
		userASpeaking();
		logout();
		expect(FakeAudio.instances[0].paused).toBe(true);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
		expect(store.state()).toBe('idle');
	});

	it('3b. logout cancels a pending TTS request; its late audio never plays', () => {
		store.setVoiceEnabled(true);
		userAConversation();
		logout();
		expect(tts.requests[0].unsubscribed).toBe(true);
		tts.requests[0].subject.next(new Blob(['x'], { type: 'audio/wav' }));
		expect(FakeAudio.instances.length).toBe(0);
	});

	it('4. logout stops the microphone immediately; its late transcript is never sent', () => {
		store.toggleListening();
		const rec = FakeRecognition.instances[0];
		const onresult = rec.onresult!;
		const onend = rec.onend!;
		logout();
		expect(rec.aborted).toBe(true);
		expect(store.state()).toBe('idle');
		onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'سؤال أ' }], { isFinal: true })] });
		onend();
		expect(socket.ask).not.toHaveBeenCalled();
	});

	it('4b. identity change BEFORE the effect flushes: the mic result for user A is dropped, not sent as user B', () => {
		store.toggleListening();
		const rec = FakeRecognition.instances[0];
		rec.say('سؤال أ الخاص');
		token.set('jwt-b');
		user.set(USER_B);
		rec.end(); // no TestBed.tick() yet
		expect(socket.ask).not.toHaveBeenCalled();
		expect(store.state()).toBe('idle');
		expect(store.micActive()).toBe(false);
	});

	it('5. logout disconnects the assistant socket', () => {
		userAConversation();
		logout();
		expect(socket.disconnect).toHaveBeenCalled();
	});

	it('6. identity change clears the conversation', () => {
		userAConversation();
		token.set('jwt-b');
		user.set(USER_B);
		TestBed.tick();
		expectPristine();
		expect(socket.disconnect).toHaveBeenCalled();
	});

	it('7. identity change clears replayable audio/text — user B cannot replay user A', () => {
		store.setVoiceEnabled(true);
		userAConversation();
		tts.resolveLast();
		FakeAudio.instances[0].onended!();
		token.set('jwt-b');
		user.set(USER_B);
		// Even before the effect flushes, replay() resets first.
		expect(store.replay()).toBe(false);
		expect(FakeAudio.instances[0].plays).toBe(1);
		expect(tts.synthesize).toHaveBeenCalledTimes(1);
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
	});

	it("8. the previous user's messages are never included in the next user's request — even before effects flush", () => {
		userAConversation();
		// Logout + login as B in the same tab, then B asks immediately.
		token.set(null);
		user.set(null);
		token.set('jwt-b');
		user.set(USER_B);
		socket.nextId = 'b-1';
		expect(store.ask('سؤال المستخدم ب')).toBe(true);
		const sent = socket.asks.at(-1)!;
		expect(sent.question).toBe('سؤال المستخدم ب');
		expect(sent.history).toEqual([]);
		expect(JSON.stringify(sent)).not.toContain('المستخدم أ');
		expect(store.messages()).toEqual([{ role: 'user', text: 'سؤال المستخدم ب' }]);
	});

	it("8b. user B's TTS request never carries user A's answer text", () => {
		store.setVoiceEnabled(true);
		userAConversation();
		token.set('jwt-b');
		user.set(USER_B);
		socket.nextId = 'b-1';
		store.ask('سؤال ب');
		answer('b-1', 'إجابة ب');
		expect(tts.requests.at(-1)!.req.text).toBe('إجابة ب');
		expect(JSON.stringify(tts.requests.slice(1).map((r) => r.req))).not.toContain('المستخدم أ');
	});

	it("retry() after an identity change cannot resend the previous user's question", () => {
		socket.nextId = 'a-1';
		store.ask('سؤال أ');
		socket.emit({ type: 'error', clientRequestId: 'a-1', code: 'UNAVAILABLE', message: 'x', humanSupportFallback: false });
		token.set('jwt-b');
		user.set(USER_B);
		const before = socket.asks.length;
		store.retry();
		expect(socket.asks.length).toBe(before);
		expect(store.lastQuestion()).toBe('');
	});

	it('9. a role switch (new token + role) starts a fresh conversation — no old-role context retained', () => {
		userAConversation();
		token.set('jwt-a-provider');
		user.set({ ...USER_A, activeRole: 'PROVIDER' });
		TestBed.tick();
		expectPristine();
		socket.nextId = 'p-1';
		store.ask('سؤال كمقدم خدمة');
		expect(socket.asks.at(-1)!.history).toEqual([]);
	});

	it('9b. a role switch on the SAME token also resets (role is part of the identity)', () => {
		userAConversation();
		user.set({ ...USER_A, activeRole: 'PROVIDER' });
		TestBed.tick();
		expectPristine();
	});

	it('10. a pending request from the old identity cannot populate the new user state', () => {
		socket.nextId = 'a-1';
		store.ask('سؤال أ');
		socket.emit({ type: 'start', clientRequestId: 'a-1' });
		socket.emit({ type: 'chunk', clientRequestId: 'a-1', chunk: 'جزء' });
		token.set('jwt-b');
		user.set(USER_B);
		TestBed.tick();
		expect(socket.cancel).toHaveBeenCalledWith('a-1');
		socket.emit({ type: 'chunk', clientRequestId: 'a-1', chunk: 'متأخر' });
		socket.emit({ type: 'complete', clientRequestId: 'a-1' });
		socket.emit({ type: 'error', clientRequestId: 'a-1', code: 'UNAVAILABLE', message: 'x', humanSupportFallback: true });
		expectPristine();
		expect(store.successTick()).toBe(0);
	});

	it('a profile update for the same user/session does NOT wipe the conversation', () => {
		userAConversation();
		user.set({ ...USER_A, firstName: 'A-renamed' });
		TestBed.tick();
		expect(store.messages().length).toBe(2);
		expect(socket.disconnect).not.toHaveBeenCalled();
	});

	it('listening state plumbing: idle → listening → idle; ask from listening → thinking; refused while busy', () => {
		expect(store.startListening()).toBe(true);
		expect(store.state()).toBe('listening');
		store.stopListening();
		expect(store.state()).toBe('idle');
		store.startListening();
		socket.nextId = 'l-1';
		store.ask('سؤال');
		expect(store.state()).toBe('thinking');
		expect(store.startListening()).toBe(false);
		expect(store.state()).toBe('thinking');
	});

	it('successTick (Bebo happy) increments on a completed answer only, never on an error', () => {
		socket.nextId = 's-1';
		store.ask('سؤال');
		socket.emit({ type: 'error', clientRequestId: 's-1', code: 'NO_ANSWER', message: 'لا توجد إجابة', humanSupportFallback: true });
		expect(store.successTick()).toBe(0);
		socket.nextId = 's-2';
		store.ask('سؤال');
		answer('s-2', 'إجابة');
		expect(store.successTick()).toBe(1);
	});

	it('speech meter: real audio loudness is published while speaking; the graph is reused on replay and released with the clip', () => {
		const rafs: FrameRequestCallback[] = [];
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafs.push(cb); return rafs.length; });
		vi.stubGlobal('cancelAnimationFrame', vi.fn());
		const source = { connect: vi.fn(), disconnect: vi.fn() };
		const analyser = {
			fftSize: 0, connect: vi.fn(), disconnect: vi.fn(),
			getFloatTimeDomainData: (d: Float32Array) => d.fill(0.1),
		};
		const createMediaElementSource = vi.fn(() => source);
		class FakeAudioContext {
			state = 'running';
			destination = {};
			resume = vi.fn(() => Promise.resolve());
			close = vi.fn(() => Promise.resolve());
			createMediaElementSource = createMediaElementSource;
			createAnalyser = vi.fn(() => analyser);
		}
		vi.stubGlobal('AudioContext', FakeAudioContext);
		const levels: Array<number | null> = [];
		const off = store.onSpeechLevel((l) => levels.push(l));

		store.setVoiceEnabled(true);
		socket.nextId = 'm-1';
		store.ask('سؤال'); // user gesture → AudioContext warmed
		answer('m-1', 'إجابة');
		tts.resolveLast();
		const audio = FakeAudio.instances[0];
		audio.onplaying!();
		expect(store.state()).toBe('speaking');
		expect(analyser.fftSize).toBe(512);
		expect(source.connect).toHaveBeenCalledWith(analyser);
		// rms(0.1) * 7 = 0.7 — same formula as the Bebo handoff.
		expect(levels.at(-1)).toBeCloseTo(0.7, 5);
		rafs.at(-1)!(0);
		expect(levels.at(-1)).toBeCloseTo(0.7, 5);

		audio.onended!();
		expect(store.state()).toBe('idle');
		expect(levels.at(-1)).toBeNull();

		// Replay: same element → same graph (createMediaElementSource once).
		store.replay();
		audio.onplaying!();
		expect(createMediaElementSource).toHaveBeenCalledTimes(1);
		expect(levels.at(-1)).toBeCloseTo(0.7, 5);

		// Logout releases the graph.
		token.set(null);
		user.set(null);
		TestBed.tick();
		expect(levels.at(-1)).toBeNull();
		expect(source.disconnect).toHaveBeenCalled();
		expect(analyser.disconnect).toHaveBeenCalled();
		off();
	});
});
