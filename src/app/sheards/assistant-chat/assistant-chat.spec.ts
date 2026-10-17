import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AssistantChatComponent } from './assistant-chat';
import { AssistantStore } from '../../core/store/assistant.store';
import { HELP_ASSISTANT_UNAVAILABLE_MESSAGE } from '../../core/help/assistant-errors';
import { AuthStore } from '../../core/store/auth.store';
import { HelpAssistantSocketService, HelpStreamEvent } from '../../core/services/help-assistant-socket.service';
import { AssistantTtsService } from '../../core/services/assistant-tts.service';
import { SECURE_CONTEXT, SPEECH_RECOGNITION, SPEECH_UNSUPPORTED } from '../../core/services/speech-recognition';

/** Minimal fake of the browser SpeechRecognition (no real microphone). */
class FakeRecognition {
	static instances: FakeRecognition[] = [];
	lang = '';
	continuous = true;
	interimResults = false;
	maxAlternatives = 0;
	onstart: (() => void) | null = null;
	onresult: ((e: any) => void) | null = null;
	onerror: ((e: { error: string }) => void) | null = null;
	onend: (() => void) | null = null;
	started = false;
	aborted = false;
	constructor() { FakeRecognition.instances.push(this); }
	start() { this.started = true; }
	stop() { this.onend?.(); }
	abort() { this.aborted = true; }
	say(transcript: string, isFinal = true) { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript }], { isFinal })] }); }
}

class FakeAudio {
	static instances: FakeAudio[] = [];
	onplaying: (() => void) | null = null;
	onended: (() => void) | null = null;
	onerror: (() => void) | null = null;
	paused = false;
	currentTime = 0;
	plays = 0;
	constructor(public src: string) { FakeAudio.instances.push(this); }
	play() { this.plays++; this.paused = false; return Promise.resolve(); }
	pause() { this.paused = true; }
	removeAttribute() {}
	load() {}
}

// Conversation UI of the shared assistant (widget panel + help pages).
// Transport and auth are faked — no socket, no network.

describe('AssistantChatComponent', () => {
	let fixture: ComponentFixture<AssistantChatComponent>;
	let store: AssistantStore;
	const events = new Subject<HelpStreamEvent>();
	const socket = { events$: events.asObservable(), ask: vi.fn(() => 'c-1'), cancel: vi.fn(), disconnect: vi.fn() };
	let ttsOut: Subject<Blob>;
	const tts = { synthesize: vi.fn(() => { ttsOut = new Subject<Blob>(); return ttsOut.asObservable(); }) };
	const token = signal<string | null>('jwt-a');
	const user = signal<any>({ id: 'a', accountType: 'CLIENT' });

	beforeEach(async () => {
		socket.ask.mockClear();
		socket.cancel.mockClear();
		tts.synthesize.mockClear();
		FakeRecognition.instances = [];
		FakeAudio.instances = [];
		vi.stubGlobal('Audio', FakeAudio as any);
		URL.createObjectURL = vi.fn(() => 'blob:chat');
		URL.revokeObjectURL = vi.fn();
		token.set('jwt-a');
		user.set({ id: 'a', accountType: 'CLIENT' });
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		await TestBed.configureTestingModule({
			imports: [AssistantChatComponent],
			providers: [
				provideRouter([]),
				{ provide: HelpAssistantSocketService, useValue: socket },
				{ provide: AuthStore, useValue: { token, currentUser: user } },
				{ provide: AssistantTtsService, useValue: tts },
				{ provide: SPEECH_RECOGNITION, useValue: FakeRecognition },
				{ provide: SECURE_CONTEXT, useValue: () => true },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(AssistantChatComponent);
		store = TestBed.inject(AssistantStore);
		fixture.detectChanges();
	});

	afterEach(() => vi.unstubAllGlobals());

	const el = () => fixture.nativeElement as HTMLElement;
	const textarea = () => el().querySelector('textarea') as HTMLTextAreaElement;
	const type = async (text: string) => {
		textarea().value = text;
		textarea().dispatchEvent(new Event('input'));
		fixture.detectChanges();
		await fixture.whenStable();
	};

	it('shows the empty state and a disabled send button with no draft', () => {
		expect(el().querySelector('.ac__empty')).toBeTruthy();
		expect((el().querySelector('.ac__btn') as HTMLButtonElement).disabled).toBe(true);
	});

	it('compact chat puts all persistent reply settings outside the conversation', () => {
		fixture.componentRef.setInput('compact', true);
		store.capabilityNotice.set('تعذر تحميل الخيارات');
		fixture.detectChanges();
		expect(el().querySelector('.ac__toolbar')).toBeNull();
		expect(el().querySelector('.ac__settings-panel')).toBeNull();
		expect(el().querySelector('.ac__voice,input[type=range],select')).toBeNull();
		expect(el().textContent).not.toContain('تعذر تحميل الخيارات');
		expect(el().querySelector('.ac__counter')).toBeNull();
	});

	it('shows a small counter only while drafting and labels web search truthfully', async () => {
		const web=el().querySelector('.ac__web') as HTMLButtonElement;expect(web.disabled).toBe(true);expect(web.title).toContain('غير متاح');
		store.capabilities.set({models:[],voices:[],webSearch:{available:true,provider:'google'}});fixture.detectChanges();expect(web.disabled).toBe(false);web.click();expect(store.webSearchEnabled()).toBe(true);
		await type('سؤال');expect(el().querySelector('.ac__counter')?.textContent).toBe('4/500');
		(el().querySelector('.ac__btn') as HTMLButtonElement).click();fixture.detectChanges();expect(el().querySelector('.ac__counter')).toBeNull();
	});

	it.each([false, true])('keeps the reading position during streaming and jumps to the newest message on demand (workspace=%s)', async (workspace) => {
		fixture.componentRef.setInput('workspace',workspace);fixture.componentRef.setInput('compact',true);store.messages.set([{role:'assistant',text:'رد سابق'}]);fixture.detectChanges();await fixture.whenStable();
		const log=el().querySelector('.ac__log') as HTMLElement;
		expect(log.getAttribute('tabindex')).toBe('0');expect(log.getAttribute('aria-label')).toBe('سجل المحادثة');
		Object.defineProperty(log,'scrollHeight',{configurable:true,value:1200});Object.defineProperty(log,'clientHeight',{configurable:true,value:300});log.scrollTop=200;log.dispatchEvent(new Event('scroll'));fixture.detectChanges();
		store.messages.set([{role:'assistant',text:'رد جديد'}]);fixture.detectChanges();await fixture.whenStable();
		expect(log.scrollTop).toBe(200);expect(el().querySelector('.ac__jump')).toBeTruthy();
		(el().querySelector('.ac__jump') as HTMLButtonElement).click();fixture.detectChanges();expect(log.scrollTop).toBe(1200);expect(el().querySelector('.ac__jump')).toBeNull();
		log.scrollTop=850;log.dispatchEvent(new Event('scroll'));store.messages.update(list=>[...list,{role:'assistant',text:'تكملة'}]);fixture.detectChanges();await fixture.whenStable();expect(log.scrollTop).toBe(1200);
	});

	it('follows a new question sent through another input while reading older widget messages', async () => {
		fixture.componentRef.setInput('compact', true);
		store.messages.set([{ role: 'assistant', text: 'رد سابق' }]);
		fixture.detectChanges();await fixture.whenStable();
		const log = el().querySelector('.ac__log') as HTMLElement;
		Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 1200 });
		Object.defineProperty(log, 'clientHeight', { configurable: true, value: 300 });
		log.scrollTop = 0;log.dispatchEvent(new Event('scroll'));
		fixture.detectChanges();
		expect(el().querySelector('.ac__jump')).toBeTruthy();
		store.ask('سؤال من المدخل السريع');
		fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
		expect(log.scrollTop).toBe(1200);
		expect(el().querySelector('.ac__jump')).toBeNull();
	});

	it('renders provider attribution with Angular sanitization, retaining a safe Google link', () => {
		store.messages.set([{role:'assistant',text:'رد',searchSuggestionsHtml:'<div><a href="https://google.com/search?q=test">Google</a><script>window.hacked=true</script><img src="x" onerror="alert(1)"><a href="javascript:alert(2)">bad</a></div>'}]);fixture.detectChanges();
		const attribution=el().querySelector('.ac__search-attribution')!;
		expect(attribution.querySelector('script')).toBeNull();expect(attribution.querySelector('[onerror]')).toBeNull();expect(attribution.querySelector('iframe')).toBeNull();expect(attribution.querySelector('a')?.getAttribute('href')).toBe('https://google.com/search?q=test');expect(attribution.innerHTML).not.toContain('href="javascript:');
	});

	it('sends on Enter, clears the draft, shows typing, then renders the streamed answer', async () => {
		await type('كيف يعمل الضمان؟');
		textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		fixture.detectChanges();
		expect(socket.ask).toHaveBeenCalledWith('كيف يعمل الضمان؟', [],expect.objectContaining({dialect:'msa',profile:'auto',pageContext:{path:'/'}}));
		expect(el().querySelector('.ac__typing')).toBeTruthy();
		await fixture.whenStable();
		fixture.detectChanges();
		expect(textarea().disabled).toBe(true);
		expect(el().querySelector('.ac__btn--ghost')!.textContent).toContain('إيقاف');

		events.next({ type: 'start', clientRequestId: 'c-1' });
		events.next({ type: 'chunk', clientRequestId: 'c-1', chunk: 'يحمي الطرفين' });
		events.next({ type: 'citations', clientRequestId: 'c-1', citations: [{ docId: 'd', title: 'دليل الضمان' }] });
		events.next({ type: 'complete', clientRequestId: 'c-1' });
		fixture.detectChanges();
		const bubbles = el().querySelectorAll('.ac__bubble');
		expect(bubbles[0].textContent).toContain('كيف يعمل الضمان؟');
		expect(bubbles[1].textContent).toContain('يحمي الطرفين');
		expect(el().querySelector('.ac__cite')!.textContent).toContain('دليل الضمان');
	});

	it('stop button cancels the in-flight answer', async () => {
		await type('سؤال');
		(el().querySelector('.ac__btn') as HTMLButtonElement).click();
		fixture.detectChanges();
		(el().querySelector('.ac__btn--ghost') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(socket.cancel).toHaveBeenCalledWith('c-1');
		expect(store.state()).toBe('idle');
	});

	it('replaces a legacy refusal with an honest retry notice without an irrelevant human-support link', async () => {
		await type('سؤال');
		(el().querySelector('.ac__btn') as HTMLButtonElement).click();
		events.next({ type: 'error', clientRequestId: 'c-1', code: 'NO_ANSWER', message: 'لم يجد المساعد الذكي إجابة معتمدة', humanSupportFallback: true });
		fixture.detectChanges();
		expect(el().querySelector('.ac__error')!.textContent).toContain(HELP_ASSISTANT_UNAVAILABLE_MESSAGE);
		expect(el().querySelector('.ac__error')!.textContent).not.toContain('إجابة معتمدة');
		expect(el().querySelector('.ac__error a')).toBeNull();
		expect(el().querySelectorAll('.ac__bubble--ai').length).toBe(0);
		(el().querySelector('.ac__error button') as HTMLButtonElement).click();
		expect(socket.ask).toHaveBeenCalledTimes(2);
	});

	it("after logout + another login, the previous user's conversation is no longer rendered", async () => {
		await type('سؤال خاص');
		(el().querySelector('.ac__btn') as HTMLButtonElement).click();
		events.next({ type: 'chunk', clientRequestId: 'c-1', chunk: 'إجابة خاصة' });
		events.next({ type: 'complete', clientRequestId: 'c-1' });
		fixture.detectChanges();
		expect(el().textContent).toContain('إجابة خاصة');

		token.set(null);
		user.set(null);
		token.set('jwt-b');
		user.set({ id: 'b', accountType: 'CLIENT' });
		TestBed.tick();
		fixture.detectChanges();
		expect(el().textContent).not.toContain('سؤال خاص');
		expect(el().textContent).not.toContain('إجابة خاصة');
		expect(el().querySelector('.ac__empty')).toBeTruthy();
	});

	// ── microphone ──
	const mic = () => el().querySelector('.ac__mic') as HTMLButtonElement;

	it('mic: nothing is requested on render; clicking starts listening (aria-pressed) and shows the live transcript', () => {
		expect(FakeRecognition.instances.length).toBe(0);
		mic().click();
		fixture.detectChanges();
		expect(FakeRecognition.instances[0].started).toBe(true);
		expect(mic().getAttribute('aria-pressed')).toBe('true');
		expect(store.state()).toBe('listening');
		FakeRecognition.instances[0].say('كيف أسحب', false);
		fixture.detectChanges();
		expect(el().querySelector('.ac__listening')!.textContent).toContain('كيف أسحب');
	});

	it('mic: clicking again finishes and sends the transcript through the same assistant flow', () => {
		mic().click();
		FakeRecognition.instances[0].say('كيف أسحب أرباحي');
		mic().click();
		fixture.detectChanges();
		expect(socket.ask).toHaveBeenCalledWith('كيف أسحب أرباحي', [],expect.objectContaining({dialect:'msa',language:'ar-SA',profile:'auto'}));
		expect(el().querySelector('.ac__bubble--user')!.textContent).toContain('كيف أسحب أرباحي');
		expect(mic().getAttribute('aria-pressed')).toBe('false');
	});

	it('mic: permission denied shows the handoff message', () => {
		mic().click();
		FakeRecognition.instances[0].onerror!({ error: 'not-allowed' });
		FakeRecognition.instances[0].onend!();
		fixture.detectChanges();
		expect(el().querySelector('.ac__mic-notice')!.textContent).toContain('اسمح بالمايك');
	});

	it('mic: disabled while an answer is in flight', async () => {
		await type('سؤال');
		(el().querySelector('.ac__btn') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(mic().disabled).toBe(true);
	});

	it('mic: destroying the chat (e.g. panel closed) stops listening', () => {
		mic().click();
		const rec = FakeRecognition.instances[0];
		fixture.destroy();
		expect(rec.aborted).toBe(true);
		expect(store.state()).toBe('idle');
	});

	it('mic: logout while listening stops the microphone and nothing is sent', () => {
		mic().click();
		const rec = FakeRecognition.instances[0];
		token.set(null);
		user.set(null);
		TestBed.tick();
		fixture.detectChanges();
		expect(rec.aborted).toBe(true);
		expect(mic().getAttribute('aria-pressed')).toBe('false');
		expect(socket.ask).not.toHaveBeenCalled();
	});

	// ── voice / dialect / replay / stop ──
	const select = (cls: string) => el().querySelector(cls) as HTMLSelectElement;
	const choose = (cls: string, value: string) => {
		select(cls).value = value;
		select(cls).dispatchEvent(new Event('change'));
		fixture.detectChanges();
	};
	const enableVoice = () => {
		const box = el().querySelector('.ac__voice input') as HTMLInputElement;
		box.checked = true;
		box.dispatchEvent(new Event('change'));
		fixture.detectChanges();
	};
	const answerNow = async (text = 'الإجابة') => {
		await type('سؤال');
		(el().querySelector('.ac__btn') as HTMLButtonElement).click();
		events.next({ type: 'chunk', clientRequestId: 'c-1', chunk: text });
		events.next({ type: 'complete', clientRequestId: 'c-1' });
		fixture.detectChanges();
	};

	it('dialect select offers exactly auto + the handoff dialects and drives the store', () => {
		const values = [...select('.ac__dialect').options].map((o) => o.value);
		expect(values).toEqual(['auto', 'egyptian', 'saudi', 'gulf', 'msa', 'english']);
		choose('.ac__dialect', 'gulf');
		expect(store.ttsDialect()).toBe('gulf');
	});

	it('voice select appears with voice on, offers exactly the handoff voices, and drives the TTS request', async () => {
		expect(el().querySelector('.ac__voice-select')).toBeNull();
		enableVoice();
		expect([...select('.ac__voice-select').options].map((o) => o.value)).toEqual(['Puck', 'Kore', 'Fenrir', 'Aoede', 'Zephyr', 'Sulafat', 'Charon', 'Leda']);
		choose('.ac__voice-select', 'Leda');
		await answerNow();
		expect(tts.synthesize).toHaveBeenCalledWith({ text: 'الإجابة', voice: 'Leda', dialect: 'egyptian' });
	});

	it('playback: stop button while speaking, then replay replays the same clip', async () => {
		enableVoice();
		await answerNow();
		expect(el().querySelector('.ac__stop-audio')).toBeTruthy(); // audio loading
		ttsOut.next(new Blob(['RIFF'], { type: 'audio/wav' }));
		FakeAudio.instances[0].onplaying!();
		fixture.detectChanges();
		expect(store.state()).toBe('speaking');
		(el().querySelector('.ac__stop-audio') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(FakeAudio.instances[0].paused).toBe(true);
		expect(store.state()).toBe('idle');
		(el().querySelector('.ac__replay') as HTMLButtonElement).click();
		expect(FakeAudio.instances[0].plays).toBe(2);
		expect(tts.synthesize).toHaveBeenCalledTimes(1);
	});

	it('TTS error: text answer remains, truthful voice notice shown', async () => {
		enableVoice();
		await answerNow('نص الإجابة');
		ttsOut.error(new Error('x'));
		fixture.detectChanges();
		expect(el().querySelector('.ac__bubble--ai')!.textContent).toContain('نص الإجابة');
		expect(el().querySelector('.ac__notice')!.textContent).toContain('الصوت غير متاح');
	});

	it('logout releases audio: no replay button remains for the next user', async () => {
		enableVoice();
		await answerNow();
		ttsOut.next(new Blob(['RIFF'], { type: 'audio/wav' }));
		FakeAudio.instances[0].onended!();
		fixture.detectChanges();
		expect(el().querySelector('.ac__replay')).toBeTruthy();
		token.set(null);
		user.set(null);
		TestBed.tick();
		fixture.detectChanges();
		expect(el().querySelector('.ac__replay')).toBeNull();
		expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:chat');
	});

	// ── local Bebo commands ──
	it('a Bebo command shows Bebo\'s acknowledgement, is not added to the conversation and is not sent', async () => {
		await type('ارقص');
		(el().querySelector('.ac__btn') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(socket.ask).not.toHaveBeenCalled();
		expect(el().querySelectorAll('.ac__bubble').length).toBe(0);
		expect(el().querySelector('.ac__bebo')!.textContent).toContain('شوف الرقصة');
		await fixture.whenStable();
		fixture.detectChanges();
		expect(textarea().value).toBe('');
	});

	it('a platform question containing a command word still goes to the assistant', async () => {
		await type('ازاي أعمل مشروع؟');
		(el().querySelector('.ac__btn') as HTMLButtonElement).click();
		expect(socket.ask).toHaveBeenCalledWith('ازاي أعمل مشروع؟', [],expect.objectContaining({dialect:'egyptian',language:'ar-EG',profile:'auto'}));
	});
});

describe('AssistantChatComponent — unsupported browser', () => {
	it('mic click shows the unsupported-browser message', async () => {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		await TestBed.configureTestingModule({
			imports: [AssistantChatComponent],
			providers: [
				provideRouter([]),
				{ provide: HelpAssistantSocketService, useValue: { events$: new Subject<HelpStreamEvent>(), ask: vi.fn(), cancel: vi.fn(), disconnect: vi.fn() } },
				{ provide: SPEECH_RECOGNITION, useValue: null },
			],
		}).compileComponents();
		const f = TestBed.createComponent(AssistantChatComponent);
		f.detectChanges();
		const button = f.nativeElement.querySelector('.ac__mic') as HTMLButtonElement;
		expect(button.title).toContain('Chrome');
		button.click();
		f.detectChanges();
		expect(f.nativeElement.querySelector('.ac__mic-notice').textContent).toContain(SPEECH_UNSUPPORTED.slice(0, 20));
		vi.unstubAllGlobals();
	});
});
