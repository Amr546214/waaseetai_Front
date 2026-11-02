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

	it('collapses and restores the toolbar while keeping the avatar and open chat available', () => {
		store.open();fixture.detectChanges();
		const toggle = el().querySelector('.pg-toolbar-toggle') as HTMLButtonElement;
		const tools = el().querySelector('#aw-toolbar-tools') as HTMLElement;
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(toggle.getAttribute('aria-controls')).toBe(tools.id);
		expect(tools.hidden).toBe(false);
		toggle.click();fixture.detectChanges();
		expect(tools.hidden).toBe(true);
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(toggle.getAttribute('aria-label')).toBe('فتح أدوات نديم');
		expect(el().querySelector('.pg-toolbar-caption')?.textContent).toContain('أدوات نديم');
		expect(store.panelOpen()).toBe(true);
		expect(el().querySelector('.aw__panel app-assistant-chat')).toBeTruthy();
		expect(robot().paused).toBe(false);
		expect(el().querySelector('.aw')?.lastElementChild?.tagName).toBe('APP-BEBO-AVATAR');
		robot().dispatchEvent(new MouseEvent('click', { bubbles: true }));fixture.detectChanges();
		expect(store.panelOpen()).toBe(false);
		robot().dispatchEvent(new MouseEvent('click', { bubbles: true }));fixture.detectChanges();
		expect(store.panelOpen()).toBe(true);
		toggle.click();fixture.detectChanges();
		expect(tools.hidden).toBe(false);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect((el().querySelector('.pg-toolbar-caption') as HTMLElement).hidden).toBe(true);
	});

	it('remembers collapsed and expanded toolbar choices across widget recreation', async () => {
		const saved = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => saved.get(key) ?? null,
			setItem: (key: string, value: string) => saved.set(key, value),
			removeItem: (key: string) => saved.delete(key)
		});
		fixture.componentInstance.toggleToolbar();
		expect(saved.get('waseet_assistant_toolbar_collapsed')).toBe('1');
		fixture.destroy();fixture = TestBed.createComponent(AssistantWidgetComponent);
		fixture.detectChanges();await fixture.whenStable();
		expect(fixture.componentInstance.toolbarCollapsed()).toBe(true);
		expect((el().querySelector('#aw-toolbar-tools') as HTMLElement).hidden).toBe(true);
		(el().querySelector('.pg-toolbar-toggle') as HTMLButtonElement).click();fixture.detectChanges();
		expect(saved.get('waseet_assistant_toolbar_collapsed')).toBe('0');
		fixture.destroy();fixture = TestBed.createComponent(AssistantWidgetComponent);
		fixture.detectChanges();await fixture.whenStable();
		expect(fixture.componentInstance.toolbarCollapsed()).toBe(false);
	});

	it('keeps toolbar controls usable when preference storage is unavailable', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => { throw new Error('blocked storage'); },
			setItem: () => { throw new Error('blocked storage'); },
			removeItem: () => {}
		});
		fixture.destroy();fixture = TestBed.createComponent(AssistantWidgetComponent);
		fixture.detectChanges();
		expect(fixture.componentInstance.toolbarCollapsed()).toBe(false);
		expect(() => fixture.componentInstance.toggleToolbar()).not.toThrow();
		fixture.detectChanges();
		expect(fixture.componentInstance.toolbarCollapsed()).toBe(true);
		expect(() => fixture.componentInstance.toggleToolbar()).not.toThrow();
		expect(fixture.componentInstance.toolbarCollapsed()).toBe(false);
	});

	it('keeps the compact toolbar dock aligned when dragging the avatar', () => {
		fixture.componentInstance.toggleToolbar();
		fixture.componentInstance.onRobotDragStart({ x: 300, y: 300 });
		const first = fixture.componentInstance.dockStyle();
		fixture.componentInstance.onRobotMove({ x: 450, y: 250 });
		const moved = fixture.componentInstance.dockStyle();
		expect(first['width']).toBe('126px');
		expect(moved['width']).toBe('126px');
		expect(Number.parseFloat(moved['left'])).toBeGreaterThan(Number.parseFloat(first['left']));
		expect(fixture.componentInstance.hasMoved()).toBe(true);
	});

	it('previews position controls immediately and updates engine bounds only on configuration changes', async () => {
		fixture.componentRef.setInput('lift', 96);fixture.detectChanges();await fixture.whenStable();
		const widget = fixture.componentInstance;
		const original = widget.movementBounds();
		widget.openTab('settings');fixture.detectChanges();
		const height = el().querySelector('input[aria-label="ارتفاع الشخصية"]') as HTMLInputElement;
		expect(height).toBeTruthy();
		expect(el().querySelectorAll('app-assistant-position-settings input')).toHaveLength(5);
		const apply = vi.spyOn(robot(), 'setMovementBounds');
		const write = vi.spyOn(localStorage, 'setItem');
		height.value = '-48';height.dispatchEvent(new Event('input'));
		fixture.detectChanges();await fixture.whenStable();
		expect(widget.positionLift()).toBe(48);
		expect(widget.movementBounds().maxY).toBe(original.maxY + 48);
		expect(write).not.toHaveBeenCalledWith('waseet_assistant_position', expect.anything());
		height.dispatchEvent(new Event('change'));
		expect(write).toHaveBeenCalledWith('waseet_assistant_position', expect.stringContaining('"verticalOffset":-48'));
		apply.mockClear();
		widget.onRobotMove({ x: 300, y: 300 });fixture.detectChanges();await fixture.whenStable();
		widget.onRobotMove({ x: 310, y: 300 });fixture.detectChanges();await fixture.whenStable();
		expect(apply).not.toHaveBeenCalled();
		(el().querySelector('.position-reset') as HTMLButtonElement).click();
		fixture.detectChanges();await fixture.whenStable();
		expect(widget.positionSettings.preferences().verticalOffset).toBe(0);
		expect(widget.hasMoved()).toBe(false);
	});

	it('keeps the avatar and its toolbar together inside a keyboard-shrunken viewport', async () => {
		const widget = fixture.componentInstance;
		fixture.componentRef.setInput('lift', 96);
		widget.positionSettings.preview('verticalOffset', 240);
		vi.stubGlobal('visualViewport', { width: 320, height: 240, offsetLeft: 0, offsetTop: 80 });
		widget.updateViewport();fixture.detectChanges();await fixture.whenStable();
		const bounds = widget.movementBounds();
		expect(bounds.minY).toBeGreaterThanOrEqual(80);
		expect(bounds.maxY + widget.beboSize()).toBeLessThanOrEqual(320);
		expect(widget.positionLift()).toBeLessThanOrEqual(240 - widget.beboSize() - 24 - 54);
		expect(widget.dockStyle()['bottom']).toContain('calc(100dvh - 320px');
	});

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

	it('quick composer sends each question and replaces the old greeting with the latest streamed answer', () => {
		store.setSkin('classic');
		fixture.componentInstance.toggleComposerOrChat();
		fixture.componentInstance.quickText = 'أهلًا';
		fixture.componentInstance.onQuickSend(new Event('submit'));
		events.next({ type: 'chunk', clientRequestId: 'w-1', chunk: 'أهلًا! أنا بيبو.' });
		events.next({ type: 'complete', clientRequestId: 'w-1' });
		fixture.detectChanges();
		expect(el().querySelector('.aw__bubble')?.textContent).toContain('أهلًا! أنا بيبو.');
		expect((el().querySelector('.pg-composer input') as HTMLInputElement).maxLength).toBe(500);
		fixture.componentInstance.quickText = 'اكتب وصفًا لمشروع متجر إلكتروني';
		fixture.componentInstance.onQuickSend(new Event('submit'));
		fixture.detectChanges();
		expect(socket.ask).toHaveBeenLastCalledWith('اكتب وصفًا لمشروع متجر إلكتروني', expect.any(Array), expect.objectContaining({ skin: 'classic' }));
		expect(el().querySelector('.aw__bubble')).toBeNull();
		expect(fixture.componentInstance.quickText).toBe('');
		events.next({ type: 'chunk', clientRequestId: 'w-1', chunk: 'متجر إلكتروني لعرض المنتجات وإدارة الطلبات.' });
		events.next({ type: 'complete', clientRequestId: 'w-1' });
		fixture.detectChanges();
		expect(el().querySelector('.aw__bubble')?.textContent).toContain('متجر إلكتروني');
		expect(el().querySelector('.aw__bubble')?.textContent).not.toContain('أهلًا!');
	});

	it('quick composer retains rejected text and shows the error instead of the old greeting', () => {
		store.messages.set([{ role: 'assistant', text: 'أهلًا! أنا بيبو.' }]);
		fixture.componentInstance.expanded.set(true);
		fixture.componentInstance.quickText = 'س'.repeat(501);
		fixture.componentInstance.onQuickSend(new Event('submit'));
		fixture.detectChanges();
		expect(fixture.componentInstance.quickText.length).toBe(501);
		expect(el().querySelector('[role="alert"]')?.textContent).toContain('500');
		expect(el().querySelector('.aw__bubble')?.textContent).not.toContain('أهلًا!');
		expect(el().querySelector('.pg-status')?.textContent).toContain('تعذر الرد');
	});

	it('compact chat keeps only the character name and puts navigation and history actions in one menu', () => {
		store.open();
		fixture.detectChanges();
		expect(el().querySelector('#aw-title')?.textContent).toBe('نديم');
		expect(el().querySelector('.aw__state')).toBeNull();
		expect(el().querySelector('.ac__toolbar')).toBeNull();
		expect(el().querySelector('#aw-menu')).toBeNull();
		(el().querySelector('[aria-controls="aw-menu"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(el().querySelector('#aw-menu')?.textContent).toContain('تصدير السجل');
		expect(el().querySelectorAll('#aw-menu button').length).toBe(6);
		fixture.componentInstance.onEscape();
		fixture.detectChanges();
		expect(el().querySelector('#aw-menu')).toBeNull();
		expect(store.panelOpen()).toBe(true);
	});
	it('uses the settings tab to control profile, voice, dialect, and volume without exposing raw model selectors', () => {
		store.capabilities.set({models:[{id:'chat-model',modalities:['text'],available:true},{id:'tts-model',modalities:['tts'],available:true},{id:'recording-model',modalities:['audio'],available:true}],voices:[{id:'Kore',label:'صوت'}]});
		store.capabilityNotice.set('تنبيه الخيارات');fixture.componentInstance.openTab('settings');fixture.detectChanges();
		const change=(selector:string,value:string)=>{const input=el().querySelector(selector) as HTMLSelectElement;input.value=value;input.dispatchEvent(new Event('change'));fixture.detectChanges();};
		change('.pg-profile','deep');
		expect(store.profile()).toBe('deep');expect(store.effort()).toBe('high');
		expect(el().querySelector('.pg-text-model')).toBeNull();
		expect(el().querySelector('.pg-speech-model')).toBeNull();
		expect(el().querySelector('.pg-voice-enabled')).toBeNull();
		expect(el().querySelector('.pg-manual-audio-help')?.textContent).toContain('تشغيل الصوت يدويًا من زر كل رد');
		change('.pg-speech-voice','Kore');expect(store.ttsVoice()).toBe('Kore');
		change('.pg-speech-dialect','gulf');expect(store.ttsDialect()).toBe('gulf');
		const volume=el().querySelector('.pg-volume') as HTMLInputElement;volume.value='0.4';volume.dispatchEvent(new Event('input'));expect(store.voiceVolume()).toBe(0.4);
		expect(el().querySelector('.pg-capability-notice')?.textContent).toBe('تنبيه الخيارات');
		fixture.componentInstance.openTab('chat');fixture.detectChanges();expect(el().querySelector('.ac__settings-panel,.ac__voice,select')).toBeNull();expect(el().textContent).not.toContain('تنبيه الخيارات');
	});
	it('keeps manual voice controls visible without capabilities or an automatic-reading preference', () => {
		store.voiceEnabled.set(false);
		store.capabilities.set(null);
		fixture.componentInstance.openTab('settings');fixture.detectChanges();
		expect(el().querySelector('.pg-voice-enabled')).toBeNull();
		for (const selector of ['.pg-speech-voice', '.pg-speech-dialect', '.pg-volume']) {
			const control = el().querySelector(selector) as HTMLElement;
			expect(control).toBeTruthy();
			expect(control.closest('label')).toBeTruthy();
			expect(control.getAttribute('aria-describedby')).toBe('aw-manual-audio-help');
		}
		store.voiceEnabled.set(true);fixture.detectChanges();
		expect(el().querySelector('.pg-voice-enabled')).toBeNull();
		expect(el().querySelector('.pg-volume')).toBeTruthy();
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

		it('opening a panel preserves the dragged avatar and anchors to it', () => {
			const reset = vi.spyOn(robot(), 'resetPosition');
			fixture.componentInstance.onRobotDragStart({ x: 640, y: 300 });
			fixture.detectChanges();
			click();
			expect(reset).not.toHaveBeenCalled();
			expect(fixture.componentInstance.robotPos()).toEqual({ x: 640, y: 300 });
			expect((el().querySelector('.aw__panel') as HTMLElement).style.position).toBe('fixed');
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

	it('hides an older reply for a new question and keeps it hidden after cancellation', () => {
		store.ask('ما هي منصة وسيط؟');
		events.next({ type: 'chunk', clientRequestId: 'w-1', chunk: 'رد قديم' });
		events.next({ type: 'complete', clientRequestId: 'w-1' });
		fixture.detectChanges();
		expect(el().querySelector('.aw__bubble')?.textContent).toContain('رد قديم');
		store.ask('كيف أسحب رصيدي؟');
		fixture.detectChanges();
		expect(el().querySelector('.aw__bubble')).toBeNull();
		store.cancel();
		fixture.detectChanges();
		expect(el().querySelector('.aw__bubble')).toBeNull();
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

	it('shows the audio-preparing status while a manual TTS request is pending', () => {
		store.open();
		store.audioLoading.set(true);
		fixture.detectChanges();
		expect(el().querySelector('.aw__state')!.textContent).toContain('يجهّز الصوت');
	});
	it('completing a text answer never requests audio, even with an older saved voice preference', () => {
		store.voiceEnabled.set(true);
		tts.synthesize.mockClear();
		store.open();
		store.ask('سؤال');
		events.next({ type: 'chunk', clientRequestId: 'w-1', chunk: 'نص' });
		events.next({ type: 'complete', clientRequestId: 'w-1' });
		fixture.detectChanges();
		expect(tts.synthesize).not.toHaveBeenCalled();
		expect(store.audioLoading()).toBe(false);
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
			expect(prompt.textContent).toMatch(/سجّل الدخول لتتحدث مع (نديم|بيبو)/);
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

		it('lets a guest switch skin and play local motions without opening a remote chat', () => {
			fixture.componentInstance.openTab('settings');
			fixture.detectChanges();
			expect(el().querySelector('[data-testid="assistant-guest-prompt"]')).toBeNull();
			const appearance = el().querySelector('.pg-settings select') as HTMLSelectElement;
			expect(appearance).toBeTruthy();
			appearance.value = 'classic';
			appearance.dispatchEvent(new Event('change'));
			fixture.detectChanges();
			expect(robot().getAttribute('skin')).toBe('classic');
			fixture.componentInstance.openTab('motions');
			fixture.detectChanges();
			expect(el().querySelectorAll('.pg-motions button')).toHaveLength(12);
			(el().querySelector('.pg-motions button') as HTMLButtonElement).click();
			fixture.detectChanges();
			expect(robot().state).toBe('wave');
			expect(socket.ask).not.toHaveBeenCalled();
			expect(tts.synthesize).not.toHaveBeenCalled();
		});

		it('requires login for guest questions from the dock and tour, without sending them', () => {
			fixture.componentInstance.toggleComposerOrChat();
			fixture.detectChanges();
			expect(el().querySelector('[data-testid="assistant-guest-prompt"]')).toBeTruthy();
			expect(el().querySelector('.pg-composer')).toBeNull();
			fixture.componentInstance.openTab('tour');
			fixture.detectChanges();
			(el().querySelector('.pg-tour-ask') as HTMLButtonElement).click();
			fixture.detectChanges();
			expect(el().querySelector('[data-testid="assistant-guest-prompt"]')).toBeTruthy();
			store.close();
			fixture.componentInstance.toggleListening();
			fixture.detectChanges();
			expect(store.micActive()).toBe(false);
			expect(el().querySelector('[data-testid="assistant-guest-prompt"]')).toBeTruthy();
			expect(socket.ask).not.toHaveBeenCalled();
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

	describe('lift (pages with a fixed bottom action bar)', () => {
		it('reserves space below the avatar for the expanded input bar', () => {
			fixture.componentInstance.toggleComposerOrChat();
			fixture.detectChanges();
			expect(robot().getAttribute('floor-offset')).toBe('64');
			expect(el().querySelector('.pg-composer')).toBeTruthy();
			fixture.componentInstance.toggleComposerOrChat();
			fixture.detectChanges();
			expect(robot().getAttribute('floor-offset')).toBe('0');
		});

		it('defaults to the normal corner: floor-offset 0 and 12px from the bottom', () => {
			expect(robot().getAttribute('floor-offset')).toBe('0');
			expect((fixture.nativeElement as HTMLElement).style.insetBlockEnd).toBe('12px');
		});

		it('lift floats Bebo and its panel up by the same amount, and clears it again', async () => {
			fixture.componentRef.setInput('lift', 96);
			fixture.detectChanges();
			await fixture.whenStable();
			expect(robot().getAttribute('floor-offset')).toBe('96');
			expect((fixture.nativeElement as HTMLElement).style.insetBlockEnd).toBe('108px');
			fixture.componentRef.setInput('lift', 0);
			fixture.detectChanges();
			expect(robot().getAttribute('floor-offset')).toBe('0');
			expect((fixture.nativeElement as HTMLElement).style.insetBlockEnd).toBe('12px');
		});
	});

	describe('Character identity & role (Nadeem default vs Bebo)', () => {
		it('defaults to skin scout: name is نديم, role is دليل وسيط, 25 guide motions', () => {
			expect(store.skin()).toBe('scout');
			expect(fixture.componentInstance.characterName()).toBe('نديم');
			expect(fixture.componentInstance.characterRole()).toBe('دليل وسيط');
			expect(fixture.componentInstance.currentMotions().length).toBe(25);
		});

		it('switching skin to classic: name is بيبو, role is المساعد الذكي, 12 core motions', () => {
			store.setSkin('classic');
			fixture.detectChanges();
			expect(store.skin()).toBe('classic');
			expect(fixture.componentInstance.characterName()).toBe('بيبو');
			expect(fixture.componentInstance.characterRole()).toBe('المساعد الذكي');
			expect(fixture.componentInstance.currentMotions().length).toBe(12);
		});

		it('updates the real shadow button name immediately when switching characters without a pose change', () => {
			const button = robot().shadowRoot!.querySelector('button')!;
			expect(button.getAttribute('aria-label')).toContain('نديم');
			store.setSkin('classic');
			fixture.detectChanges();
			expect(button.getAttribute('aria-label')).toContain('بيبو');
			expect(button.getAttribute('aria-label')).not.toContain('نديم');
			store.setSkin('scout');
			fixture.detectChanges();
			expect(button.getAttribute('aria-label')).toContain('نديم');
		});

		it('tour buttons dynamically show the active character name', () => {
			store.open();
			fixture.componentInstance.openTab('tour');
			fixture.detectChanges();
			const askButtons = el().querySelectorAll('.pg-tour-ask');
			expect(askButtons.length).toBeGreaterThan(0);
			expect(askButtons[0].textContent).toContain('اسأل نديم عن هذا الموضوع');
			store.setSkin('classic');
			fixture.detectChanges();
			expect(askButtons[0].textContent).toContain('اسأل بيبو عن هذا الموضوع');
		});
	});

	describe('Intelligent follow when dragged', () => {
		it('calculates dockStyle clamped to viewport when robot moves', () => {
			fixture.componentInstance.onRobotDragStart({ x: 400, y: 300 });
			fixture.detectChanges();
			const style = fixture.componentInstance.dockStyle();
			expect(style).toBeTruthy();
			expect(style?.['position']).toBe('fixed');
			expect(style?.['left']).toBeDefined();
			expect(style?.['top']).toBeDefined();
		});

		it('resetPosition clears the dragged coordinates back to home layout', () => {
			const reset = vi.spyOn(robot(), 'resetPosition');
			fixture.componentInstance.onRobotDragStart({ x: 400, y: 300 });
			fixture.detectChanges();
			expect(fixture.componentInstance.dockStyle()).toBeTruthy();
			fixture.componentInstance.resetPosition();
			fixture.detectChanges();
			expect(fixture.componentInstance.hasMoved()).toBe(false);
			expect(reset).toHaveBeenCalledOnce();
			expect(fixture.componentInstance.robotPos()).not.toEqual({ x: 400, y: 300 });
		});
	});

	describe('Assistant dismissal and restoration', () => {
		it('clicking toolbar X button dismisses the assistant and reveals the reopen pill', () => {
			const aw = el().querySelector('.aw')!;
			expect(aw.classList.contains('is-dismissed')).toBe(false);
			expect(el().querySelector('.pg-dock')).toBeTruthy();
			expect(el().querySelector('.pg-reopen')).toBeNull();

			const closeBtn = el().querySelector('.pg-toolbar > button[title="إغلاق"]') as HTMLButtonElement;
			expect(closeBtn).toBeTruthy();
			closeBtn.click();
			fixture.detectChanges();

			expect(fixture.componentInstance.dismissed()).toBe(true);
			expect(store.dismissed()).toBe(true);
			expect(aw.classList.contains('is-dismissed')).toBe(true);
			expect(el().querySelector('.pg-dock')).toBeNull();
			expect(robot().paused).toBe(true);
			expect((robot() as any)._raf).toBe(0);

			// Reopen button appears
			const reopenBtn = el().querySelector('.pg-reopen') as HTMLButtonElement;
			expect(reopenBtn).toBeTruthy();
			expect(reopenBtn.textContent).toContain('إظهار نديم');
		});

		it('clicking the reopen pill restores the assistant and dock', () => {
			fixture.componentInstance.dismissAssistant();
			fixture.detectChanges();
			expect(fixture.componentInstance.dismissed()).toBe(true);

			const reopenBtn = el().querySelector('.pg-reopen') as HTMLButtonElement;
			reopenBtn.click();
			fixture.detectChanges();

			expect(fixture.componentInstance.dismissed()).toBe(false);
			expect(store.dismissed()).toBe(false);
			expect(el().querySelector('.pg-dock')).toBeTruthy();
			expect(el().querySelector('.pg-reopen')).toBeNull();
			expect(robot().paused).toBe(false);
		});

		it('window open-assistant event restores and opens the assistant', () => {
			fixture.componentInstance.dismissAssistant();
			fixture.detectChanges();
			expect(fixture.componentInstance.dismissed()).toBe(true);

			window.dispatchEvent(new CustomEvent('open-assistant'));
			fixture.detectChanges();

			expect(fixture.componentInstance.dismissed()).toBe(false);
			expect(store.panelOpen()).toBe(true);
		});

		it('preserves the aw.lastElementChild contract even when dismissed', () => {
			const aw = el().querySelector('.aw')!;
			const avatar = el().querySelector('app-bebo-avatar')!;
			fixture.componentInstance.dismissAssistant();
			fixture.detectChanges();

			expect(aw.lastElementChild).toBe(avatar);
		});
	});
});
