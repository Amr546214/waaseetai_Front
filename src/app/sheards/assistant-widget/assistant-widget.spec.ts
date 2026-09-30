import { readFileSync } from 'node:fs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AssistantWidgetComponent } from './assistant-widget';
import { AssistantStore } from '../../core/store/assistant.store';
import { HelpAssistantSocketService, HelpStreamEvent } from '../../core/services/help-assistant-socket.service';
import type { CuteRobotElement } from '../bebo-avatar/bebo-loader';
import { SECURE_CONTEXT, SPEECH_RECOGNITION } from '../../core/services/speech-recognition';
import { AssistantTtsService } from '../../core/services/assistant-tts.service';

class FakeRecognition {
	static last: FakeRecognition | null = null;
	lang = ''; continuous = true; interimResults = false; maxAlternatives = 0;
	onstart: any = null; onresult: any = null; onerror: any = null; onend: any = null;
	aborted = false;
	constructor() { FakeRecognition.last = this; }
	start() {}
	stop() { this.onend?.(); }
	abort() { this.aborted = true; }
}

// The floating dashboard assistant with the REAL Bebo v4 engine
// (public/bebo/robot.js) rendering the avatar. Transport is faked.

/** jsdom lacks these; stubbed per test because afterEach unstubs globals. */
function stubBrowserApis(): void {
	vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
	class FakeObserver { observe() {} unobserve() {} disconnect() {} }
	vi.stubGlobal('IntersectionObserver', FakeObserver);
	vi.stubGlobal('ResizeObserver', FakeObserver);
	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
}

function loadRealBeboEngine(): void {
	if (!customElements.get('cute-robot')) new Function(readFileSync('public/bebo/robot.js', 'utf8'))();
}

describe('AssistantWidgetComponent (floating dashboard assistant + Bebo)', () => {
	let fixture: ComponentFixture<AssistantWidgetComponent>;
	let store: AssistantStore;
	const events = new Subject<HelpStreamEvent>();
	const socket = { events$: events.asObservable(), ask: vi.fn(() => 'w-1'), cancel: vi.fn(), disconnect: vi.fn() };
	const tts = { synthesize: vi.fn(() => new Subject<Blob>().asObservable()) };

	beforeEach(async () => {
		stubBrowserApis();
		loadRealBeboEngine();
		await TestBed.configureTestingModule({
			imports: [AssistantWidgetComponent],
			providers: [
				provideRouter([]),
				{ provide: HelpAssistantSocketService, useValue: socket },
				{ provide: AssistantTtsService, useValue: tts },
				{ provide: SPEECH_RECOGNITION, useValue: FakeRecognition },
				{ provide: SECURE_CONTEXT, useValue: () => true },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(AssistantWidgetComponent);
		store = TestBed.inject(AssistantStore);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	});

	afterEach(() => vi.unstubAllGlobals());

	const el = () => fixture.nativeElement as HTMLElement;
	const robot = () => el().querySelector('app-bebo-avatar cute-robot') as CuteRobotElement;

	it('renders Bebo (the real <cute-robot>), not the old 3D robot', () => {
		expect(robot()).toBeTruthy();
		expect(typeof robot().play).toBe('function');
		expect(robot().hasAttribute('floating')).toBe(true);
		expect(el().querySelector('app-robot-avatar')).toBeNull();
		expect(el().querySelector('canvas')).toBeNull();
		expect(el().querySelector('.aw__panel')).toBeNull();
	});

	it('clicking Bebo opens and the close button closes the assistant panel', () => {
		robot().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		fixture.detectChanges();
		expect(store.panelOpen()).toBe(true);
		expect(el().querySelector('.aw__panel app-assistant-chat')).toBeTruthy();
		expect(robot().getAttribute('label')).toContain('لإغلاق');
		(el().querySelector('.aw__close') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(el().querySelector('.aw__panel')).toBeNull();
	});

	it('drives Bebo from the real store state (idle → thinking → happy on a completed answer)', () => {
		store.ask('سؤال');
		fixture.detectChanges();
		expect(el().querySelector('app-bebo-avatar')!.getAttribute('data-state')).toBe('thinking');
		expect(robot().state).toBe('thinking');
		events.next({ type: 'chunk', clientRequestId: 'w-1', chunk: 'نص' });
		events.next({ type: 'complete', clientRequestId: 'w-1' });
		fixture.detectChanges();
		expect(el().querySelector('app-bebo-avatar')!.getAttribute('data-state')).toBe('idle');
		expect(robot().state).toBe('happy');
	});

	it('listening and speaking store states reach Bebo', () => {
		store.startListening();
		fixture.detectChanges();
		expect(robot().state).toBe('listening');
		store.stopListening();
		store.state.set('speaking');
		fixture.detectChanges();
		expect(robot().state).toBe('speaking');
	});

	it('forwards the metered answer-audio level to Bebo\'s mouth, and stops on destroy', () => {
		const spy = vi.spyOn(robot(), 'setSpeechLevel');
		(store as any).emitSpeechLevel(0.42);
		expect(spy).toHaveBeenLastCalledWith(0.42);
		fixture.destroy();
		spy.mockClear();
		(store as any).emitSpeechLevel(0.9);
		expect(spy).not.toHaveBeenCalledWith(0.9);
		expect((store as any).speechLevelListeners.size).toBe(0);
	});
	it('a typed Bebo command ("ارقص") makes the real Bebo dance — locally, nothing sent upstream', () => {
		socket.ask.mockClear();
		store.ask('ارقص');
		fixture.detectChanges();
		expect(robot().state).toBe('dance');
		expect(socket.ask).not.toHaveBeenCalled();
		store.ask('ارجع مكانك');
		fixture.detectChanges();
		expect(store.beboCommand()?.action).toBe('reset');
	});

	it('the microphone puts Bebo in the listening pose, and a spoken command animates Bebo', () => {
		store.toggleListening();
		fixture.detectChanges();
		expect(robot().state).toBe('listening');
		FakeRecognition.last!.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'انط' }], { isFinal: true })] });
		store.toggleListening(); // finish → onend → command
		fixture.detectChanges();
		expect(robot().state).toBe('jump');
	});

	it('shows the audio-preparing status while WaseetAI TTS is pending', () => {
		store.setVoiceEnabled(true);
		store.open();
		store.ask('سؤال');
		events.next({ type: 'chunk', clientRequestId: 'w-1', chunk: 'نص' });
		events.next({ type: 'complete', clientRequestId: 'w-1' });
		fixture.detectChanges();
		expect(el().querySelector('.aw__state')!.textContent).toContain('يجهّز الصوت');
		expect(tts.synthesize).toHaveBeenCalled();
	});
});
