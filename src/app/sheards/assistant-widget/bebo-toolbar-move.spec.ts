import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AssistantWidgetComponent } from './assistant-widget';
import { BeboToolbarComponent } from './bebo-toolbar';
import { AssistantToolbarState } from './assistant-toolbar-state';
import { AssistantStore } from '../../core/store/assistant.store';
import { HelpAssistantSocketService, HelpStreamEvent } from '../../core/services/help-assistant-socket.service';
import { SECURE_CONTEXT, SPEECH_RECOGNITION } from '../../core/services/speech-recognition';
import { AssistantTtsService } from '../../core/services/assistant-tts.service';
import { AuthStore } from '../../core/store/auth.store';

/** The bar as it was: [compass] [mic] | [full chat] [guide] [motions] [settings] [collapse] [close] (labels of the character «بيبو»). */
const bar = (name: string) => [`اكتب لـ ${name}`, `تحدث لـ ${name}`, 'المحادثة الكاملة', 'دليل وسيط', 'حركات الشخصية', `إعدادات ${name}`, `طي أدوات ${name}`, `إغلاق ${name}`];
const nameOf = () => TestBed.inject(AssistantStore).characterName();
const ICONS = ['pl-assistant-compass', 'pl-assistant-mic', 'pl-assistant-clock', 'pl-assistant-map', 'pl-assistant-smile', 'pl-assistant-sliders', 'ws-chevron-right', 'ws-close'];

function stubBrowserApis(store: Record<string, string> = {}): void {
	vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
	class FakeObserver { observe() {} unobserve() {} disconnect() {} }
	vi.stubGlobal('IntersectionObserver', FakeObserver);
	vi.stubGlobal('ResizeObserver', FakeObserver);
	vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: () => {} });
}
function loadRealBeboEngine(): void { if (!customElements.get('cute-robot')) new Function(readFileSync('public/bebo/robot.js', 'utf8'))(); }

class FakeRecognition { continuous = true; interimResults = false; maxAlternatives = 0; lang = ''; onstart: any; onresult: any; onerror: any; onend: any; start() {} stop() { this.onend?.(); } abort() {} }

function configure(): void {
	const events = new Subject<HelpStreamEvent>();
	TestBed.configureTestingModule({
		imports: [AssistantWidgetComponent, BeboToolbarComponent],
		providers: [
			provideRouter([{ path: 'assistant', children: [] }]),
			{ provide: AuthStore, useValue: { token: signal<string | null>('test-token').asReadonly(), currentUser: signal({ id: 'u1', activeRole: 'ADMIN' }) } },
			{ provide: HelpAssistantSocketService, useValue: { events$: events.asObservable(), ask: vi.fn(() => 'w-1'), cancel: vi.fn(), disconnect: vi.fn() } },
			{ provide: AssistantTtsService, useValue: { synthesize: vi.fn(() => new Subject<Blob>().asObservable()) } },
			{ provide: SPEECH_RECOGNITION, useValue: FakeRecognition },
			{ provide: SECURE_CONTEXT, useValue: () => true },
		],
	});
}
const buttons = (root: HTMLElement) => [...root.querySelectorAll('app-bebo-toolbar button.pg-btn')] as HTMLButtonElement[];
const labels = (root: HTMLElement) => buttons(root).map(b => b.getAttribute('aria-label'));
const icons = (root: HTMLElement) => buttons(root).map(b => b.querySelector('svg')?.getAttribute('data-ws-icon'));

describe('Bebo tool bar moved to the admin «بيبو» tab', () => {
	beforeEach(() => { stubBrowserApis(); loadRealBeboEngine(); configure(); });
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('the floating widget still draws the bar (same order, labels, icons) everywhere the admin flag is off', async () => {
		const f = TestBed.createComponent(AssistantWidgetComponent); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const root = f.nativeElement as HTMLElement;
		expect(labels(root)).toEqual(bar(nameOf())); expect(icons(root)).toEqual(ICONS);
		expect(root.querySelector('.pg-toolbar-divider')).toBeTruthy(); expect(root.querySelector('app-bebo-avatar cute-robot')).toBeTruthy();
	});

	it('with hideToolbar (the admin panel) the floating bar is gone but the robot, and the whole widget, stay', async () => {
		const f = TestBed.createComponent(AssistantWidgetComponent); f.componentRef.setInput('hideToolbar', true); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const root = f.nativeElement as HTMLElement;
		expect(root.querySelector('app-bebo-toolbar')).toBeNull(); expect(root.querySelector('.pg-toolbar')).toBeNull(); expect(root.querySelector('.pg-dock')).toBeNull();
		expect(root.querySelector('app-bebo-avatar cute-robot')).toBeTruthy();
	});

	it('the tab draws the SAME bar: identical buttons, labels, icons and order as the floating one', async () => {
		const floating = TestBed.createComponent(AssistantWidgetComponent); floating.detectChanges(); await floating.whenStable(); floating.detectChanges();
		const tab = TestBed.createComponent(BeboToolbarComponent); tab.detectChanges();
		const a = floating.nativeElement as HTMLElement, b = tab.nativeElement as HTMLElement;
		const shape = (r: HTMLElement) => [...r.querySelectorAll('button.pg-btn, .pg-toolbar-divider')].map(x => x.classList.contains('pg-toolbar-divider') ? '|' : x.getAttribute('aria-label') + '/' + x.querySelector('svg')?.getAttribute('data-ws-icon'));
		expect(shape(b)).toEqual(shape(a)); expect(shape(b)).toHaveLength(9);
		expect([...b.querySelectorAll('button.pg-btn')].map(x => x.getAttribute('aria-label'))).toEqual(bar(nameOf()));
	});

	describe('every tool still does what it did (driven from the tab bar)', () => {
		const make = () => { const f = TestBed.createComponent(BeboToolbarComponent); f.detectChanges(); return { f, root: f.nativeElement as HTMLElement, ui: TestBed.inject(AssistantToolbarState), store: TestBed.inject(AssistantStore) }; };
		const click = (t: ReturnType<typeof make>, i: number) => { (t.root.querySelectorAll('button.pg-btn')[i] as HTMLButtonElement).click(); t.f.detectChanges(); };

		it('compass opens / closes the quick composer; closes an open panel instead', () => {
			const t = make(); click(t, 0); expect(t.ui.expanded()).toBe(true); expect(t.root.querySelector('button.pg-btn')!.classList.contains('is-active')).toBe(true);
			click(t, 0); expect(t.ui.expanded()).toBe(false);
			t.store.open(); click(t, 0); expect(t.store.panelOpen()).toBe(false);
		});
		it('mic toggles listening', () => { const t = make(); const spy = vi.spyOn(t.store, 'toggleListening').mockImplementation(() => undefined); click(t, 1); expect(spy).toHaveBeenCalledTimes(1); });
		it('the clock opens the full chat page and closes the floating panel', async () => {
			const t = make(); const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true); t.store.open(); click(t, 2);
			expect(nav).toHaveBeenCalledWith('/assistant'); expect(t.store.panelOpen()).toBe(false);
		});
		it('guide / motions / settings open their panel tab, mark the button active and toggle off on a second click', () => {
			const t = make();
			for (const [i, tab] of [[3, 'tour'], [4, 'motions'], [5, 'settings']] as const) {
				click(t, i); expect(t.store.panelOpen()).toBe(true); expect(t.ui.panelTab()).toBe(tab);
				expect((t.root.querySelectorAll('button.pg-btn')[i] as HTMLElement).classList.contains('is-active')).toBe(true);
				click(t, i); expect(t.store.panelOpen()).toBe(false);
			}
		});
		it('collapse folds the bar to its caption and is remembered; the arrow reopens it', () => {
			const memory: Record<string, string> = {}; vi.unstubAllGlobals(); stubBrowserApis(memory);
			TestBed.resetTestingModule(); configure(); const t = make();
			click(t, 6); expect(t.ui.toolbarCollapsed()).toBe(true); expect(memory['waseet_assistant_toolbar_collapsed']).toBe('1');
			expect((t.root.querySelector('.pg-toolbar-caption') as HTMLElement).hidden).toBe(false); expect((t.root.querySelector('#aw-toolbar-tools') as HTMLElement).hidden).toBe(true);
			click(t, 6); expect(t.ui.toolbarCollapsed()).toBe(false); expect(memory['waseet_assistant_toolbar_collapsed']).toBe('0');
		});
		it('close hides Bebo (the floating «إظهار بيبو» button brings it back) and closes the composer', () => {
			const t = make(); t.ui.expanded.set(true); click(t, 7); expect(t.store.dismissed()).toBe(true); expect(t.ui.expanded()).toBe(false);
		});
		it('a tool clicked in the tab opens the panel of the floating widget: both share one state', async () => {
			const f = TestBed.createComponent(AssistantWidgetComponent); f.componentRef.setInput('hideToolbar', true); f.detectChanges(); await f.whenStable(); f.detectChanges();
			const t = make(); click(t, 5); f.detectChanges(); await f.whenStable(); f.detectChanges();
			expect((f.nativeElement as HTMLElement).querySelector('.aw__panel')).toBeTruthy();
			expect(t.ui.panelTab()).toBe('settings');
		});
	});
});
