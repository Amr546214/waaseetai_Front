import { readFileSync } from 'node:fs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AssistantWidgetComponent } from './assistant-widget';
import { AssistantStore } from '../../core/store/assistant.store';
import { HelpAssistantSocketService, HelpStreamEvent } from '../../core/services/help-assistant-socket.service';
import type { CuteRobotElement } from '../bebo-avatar/bebo-loader';
import { SECURE_CONTEXT, SPEECH_RECOGNITION } from '../../core/services/speech-recognition';
import { AssistantTtsService } from '../../core/services/assistant-tts.service';
import { AuthStore } from '../../core/store/auth.store';

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
	// Signed-in by default; the visitor suite below flips the token to null.
	const authToken = signal<string | null>('test-token');
	const authStub = { token: authToken.asReadonly(), currentUser: signal({ id: 'u1', activeRole: 'CLIENT' }) };

	beforeEach(async () => {
		authToken.set('test-token');
		stubBrowserApis();
		loadRealBeboEngine();
		await TestBed.configureTestingModule({
			imports: [AssistantWidgetComponent],
			providers: [
				provideRouter([{ path: 'auth/login', children: [] }]),
				{ provide: AuthStore, useValue: authStub },
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

	describe('Bebo launcher positioning (closed ↔ open)', () => {
		const avatarHost = () => el().querySelector('app-bebo-avatar') as HTMLElement;
		const click = () => { robot().dispatchEvent(new MouseEvent('click', { bubbles: true })); fixture.detectChanges(); };

		it('closed: exactly one Bebo, in floating (viewport-fixed) launcher mode, no panel', () => {
			expect(el().querySelectorAll('cute-robot').length).toBe(1);
			expect(robot().hasAttribute('floating')).toBe(true); // robot.js :host([floating]) → position: fixed
			expect(el().querySelector('.aw__panel')).toBeNull();
			// Bebo is the widget's own child, never nested in the panel.
			expect(robot().closest('.aw__panel')).toBeNull();
		});

		it('open: Bebo stays rendered (same element, not inside the panel)', () => {
			const first = robot();
			click();
			expect(store.panelOpen()).toBe(true);
			expect(el().querySelector('.aw__panel')).toBeTruthy();
			expect(robot()).toBe(first);
			expect(robot().isConnected).toBe(true);
			expect(robot().closest('.aw__panel')).toBeNull();
			expect(el().querySelectorAll('cute-robot').length).toBe(1);
			// Panel first, Bebo after it: the panel sits above Bebo's corner.
			const aw = el().querySelector('.aw')!;
			expect(aw.lastElementChild).toBe(avatarHost());
		});

		it('closing returns to the launcher state with the same single Bebo', () => {
			const first = robot();
			click();
			(el().querySelector('.aw__close') as HTMLButtonElement).click();
			fixture.detectChanges();
			expect(store.panelOpen()).toBe(false);
			expect(el().querySelector('.aw__panel')).toBeNull();
			expect(robot()).toBe(first);
			click(); // Bebo still launches after a close
			expect(store.panelOpen()).toBe(true);
			expect(el().querySelectorAll('cute-robot').length).toBe(1);
		});

		it('Bebo is shown by itself: no launcher plate / ring / shadow, closed or open', () => {
			const bare = () => {
				const cs = getComputedStyle(robot());
				expect(cs.boxShadow === '' || cs.boxShadow === 'none').toBe(true);
				expect(cs.backgroundImage === '' || cs.backgroundImage === 'none').toBe(true);
				expect(avatarHost().hasAttribute('data-active')).toBe(false);
			};
			bare();
			click();
			expect(store.panelOpen()).toBe(true);
			bare();
		});

		it('opening brings a dragged-away Bebo back to its launcher spot; an at-home Bebo is left alone', () => {
			const reset = vi.spyOn(robot(), 'resetPosition');
			click();
			expect(reset).not.toHaveBeenCalled(); // already home → click-wave not cut off
			store.close();
			fixture.detectChanges();
			Object.defineProperty(robot(), 'position', { configurable: true, get: () => ({ x: 640, y: 300 }) });
			click();
			expect(reset).toHaveBeenCalledTimes(1);
		});
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

	describe('visitor (no session token): robot + login prompt only', () => {
		const click = () => { robot().dispatchEvent(new MouseEvent('click', { bubbles: true })); fixture.detectChanges(); };
		beforeEach(() => {
			authToken.set(null);
			fixture.detectChanges();
			socket.ask.mockClear();
			tts.synthesize.mockClear();
		});

		it('shows the robot, and clicking it opens a short login prompt instead of the chat', () => {
			expect(robot()).toBeTruthy();
			click();
			expect(store.panelOpen()).toBe(true);
			const prompt = el().querySelector('[data-testid="assistant-guest-prompt"]') as HTMLElement;
			expect(prompt).toBeTruthy();
			expect(prompt.textContent).toContain('سجّل الدخول لتتحدث مع بيبو');
			expect(el().querySelector('app-assistant-chat')).toBeNull();
			expect(el().querySelector('textarea, input')).toBeNull();
			expect(el().querySelector('.aw__state')).toBeNull();
		});

		it('the login button points to /auth/login and closes the panel', () => {
			click();
			const link = el().querySelector('.aw__login') as HTMLAnchorElement;
			expect(link.getAttribute('href')).toBe('/auth/login');
			expect(link.textContent).toContain('تسجيل الدخول');
			link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
			fixture.detectChanges();
			expect(store.panelOpen()).toBe(false);
		});

		it('makes no network/socket call: nothing is asked, no audio is requested', () => {
			click();
			expect(socket.ask).not.toHaveBeenCalled();
			expect(tts.synthesize).not.toHaveBeenCalled();
		});

		it('signing in removes the prompt; reopening then shows the real chat on the same robot', () => {
			click();
			const first = robot();
			authToken.set('fresh-token');
			fixture.detectChanges();
			expect(el().querySelector('[data-testid="assistant-guest-prompt"]')).toBeNull();
			if (!store.panelOpen()) click(); // a new identity resets the conversation/panel
			expect(el().querySelector('.aw__panel app-assistant-chat')).toBeTruthy();
			expect(robot()).toBe(first);
		});
	});
});
