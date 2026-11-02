import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AssistantPageComponent } from './assistant-page';
import { AssistantStore } from '../../core/store/assistant.store';
import { AuthStore } from '../../core/store/auth.store';
import { ThemeService } from '../../core/services/theme.service';
import { HelpAssistantSocketService, HelpStreamEvent } from '../../core/services/help-assistant-socket.service';
import { SPEECH_RECOGNITION } from '../../core/services/speech-recognition';
import { AssistantCapabilitiesService } from '../../core/services/assistant-capabilities.service';

describe('AssistantPageComponent (ChatGPT-like Redesign R1-R7)', () => {
	let fixture: ComponentFixture<AssistantPageComponent>;
	let store: AssistantStore;
	let events: Subject<HelpStreamEvent>;
	let sequence = 0;
	let socket: any;
	const token = signal('jwt');
	const user = signal<any>({ id: 'workspace-user', firstName: 'مريم', activeRole: 'CLIENT' });
	const theme = signal<'dark' | 'light'>('light');

	const mockCapabilitiesService = {
		get: () => of({
			models: [{ id: 'gemini-1.5-flash', label: 'Flash', available: true }],
			voices: [{ id: 'ar-XA-Standard-A', label: 'صوت قياسي' }],
			stt: { available: true },
			webSearch: { available: true }
		}),
		transcribe: () => of({ text: '' }),
		liveToken: () => of({ token: 'test-token', expiresAt: '', model: '', voice: '', wsUrl: '', sessionConfig: { setup: {} } })
	};

	beforeEach(async () => {
		sequence = 0;
		events = new Subject<HelpStreamEvent>();
		user.set({ id: 'workspace-user', firstName: 'مريم', activeRole: 'CLIENT' });
		theme.set('light');

		const saved = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => saved.get(key) ?? null,
			setItem: (key: string, value: string) => saved.set(key, value)
		});

		socket = {
			events$: events.asObservable(),
			ask: vi.fn(() => `page-${++sequence}`),
			cancel: vi.fn(),
			disconnect: vi.fn()
		};

		await TestBed.configureTestingModule({
			imports: [AssistantPageComponent],
			providers: [
				provideRouter([]),
				{ provide: AuthStore, useValue: { token, currentUser: user } },
				{ provide: ThemeService, useValue: { theme, toggleTheme: () => theme.update(v => v === 'dark' ? 'light' : 'dark') } },
				{ provide: HelpAssistantSocketService, useValue: socket },
				{ provide: SPEECH_RECOGNITION, useValue: null },
				{ provide: AssistantCapabilitiesService, useValue: mockCapabilitiesService }
			]
		}).compileComponents();

		fixture = TestBed.createComponent(AssistantPageComponent);
		store = TestBed.inject(AssistantStore);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const el = () => fixture.nativeElement as HTMLElement;

	it('focuses the composer when the assistant page opens', () => {
		expect(document.activeElement).toBe(el().querySelector('#user-input'));
	});

	it('keeps the composer focused through sending and completing a reply', async () => {
		const textarea = el().querySelector('#user-input') as HTMLTextAreaElement;
		textarea.focus();
		textarea.value = 'Hello';
		textarea.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		await fixture.whenStable();
		const send = el().querySelector('.tc-send-button') as HTMLButtonElement;
		send.focus();
		send.click();
		fixture.detectChanges();
		await fixture.whenStable();
		expect(store.busy()).toBe(true);
		expect(textarea.disabled).toBe(false);
		expect(textarea.readOnly).toBe(true);
		expect(document.activeElement).toBe(textarea);
		events.next({ type: 'complete', clientRequestId: `page-${sequence}` });
		fixture.detectChanges();
		await fixture.whenStable();
		expect(textarea.readOnly).toBe(false);
		expect(document.activeElement).toBe(textarea);
	});

	function answer(question: string, text: string) {
		store.ask(question);
		const id = `page-${sequence}`;
		events.next({ type: 'chunk', clientRequestId: id, chunk: text });
		events.next({ type: 'complete', clientRequestId: id });
		fixture.detectChanges();
		return store.activeConversationId()!;
	}

	it('preserves older-message reading through response updates and resumes following on demand or a new question', async () => {
		answer('سؤال سابق', 'رد سابق');
		await fixture.whenStable();
		const messages = el().querySelector('.tc-messages') as HTMLElement;
		Object.defineProperty(messages, 'scrollHeight', { configurable: true, value: 1600 });
		Object.defineProperty(messages, 'clientHeight', { configurable: true, value: 500 });
		expect(messages.getAttribute('tabindex')).toBe('0');
		messages.scrollTop = 0;
		messages.dispatchEvent(new Event('scroll'));
		fixture.detectChanges();
		store.messages.update(list => [...list, { role: 'assistant', text: 'تكملة الرد', streaming: true }]);
		store.errorMessage.set('خطأ اتصال');
		fixture.detectChanges();await fixture.whenStable();
		expect(messages.scrollTop).toBe(0);
		const jump = el().querySelector('.tc-jump-latest') as HTMLButtonElement;
		expect(jump).toBeTruthy();
		jump.click();fixture.detectChanges();
		expect(messages.scrollTop).toBe(1600);
		expect(el().querySelector('.tc-jump-latest')).toBeNull();
		messages.scrollTop = 1060;messages.dispatchEvent(new Event('scroll'));
		store.messages.update(list => [...list, { role: 'assistant', text: 'رسالة جديدة' }]);
		fixture.detectChanges();await fixture.whenStable();
		expect(messages.scrollTop).toBe(1600);
		messages.scrollTop = 0;messages.dispatchEvent(new Event('scroll'));
		fixture.componentInstance.promptText.set('سؤال جديد');
		fixture.componentInstance.sendPrompt();
		fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
		expect(messages.scrollTop).toBe(1600);
		expect(el().querySelector('.tc-jump-latest')).toBeNull();
	});

	it('follows the selected conversation after reading the start of a different conversation', async () => {
		const first = answer('الأولى', 'الرد الأول');
		store.newConversation();
		answer('الثانية', 'الرد الثاني');
		await fixture.whenStable();
		const messages = el().querySelector('.tc-messages') as HTMLElement;
		Object.defineProperty(messages, 'scrollHeight', { configurable: true, value: 1600 });
		Object.defineProperty(messages, 'clientHeight', { configurable: true, value: 500 });
		messages.scrollTop = 0;messages.dispatchEvent(new Event('scroll'));
		fixture.componentInstance.selectConversation(first);
		fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
		expect(messages.scrollTop).toBe(1600);
		expect(el().querySelector('.tc-jump-latest')).toBeNull();
	});

	// ── R1: Unified Desktop Sidebar Rail & Collapsible Navigation ──────────────
	it('R1: renders single aside.tc-sidebar without duplicate .page-rail and collapses to 56px', () => {
		const sidebar = el().querySelector('aside.tc-sidebar');
		expect(sidebar).toBeTruthy();
		expect(el().querySelector('.page-rail')).toBeNull();

		const component = fixture.componentInstance;
		expect(component.desktopCollapsed()).toBe(false);
		expect(sidebar?.classList.contains('is-desktop-collapsed')).toBe(false);

		// Toggle collapse to true
		component.toggleDesktopCollapse();
		fixture.detectChanges();

		expect(component.desktopCollapsed()).toBe(true);
		expect(sidebar?.classList.contains('is-desktop-collapsed')).toBe(true);
	});

	it('R1: has logo hover toggle element (.tc-brand-toggle) and tooltips with kbd shortcuts', () => {
		const brandToggle = el().querySelector('.tc-brand-entry .tc-brand-toggle');
		expect(brandToggle).toBeTruthy();

		const tooltips = Array.from(el().querySelectorAll('.tc-rail-tooltip'));
		expect(tooltips.length).toBeGreaterThanOrEqual(3);

		const tooltipsText = tooltips.map(t => t.textContent);
		expect(tooltipsText.some(t => t?.includes('Ctrl+Shift+S'))).toBe(true);
		expect(tooltipsText.some(t => t?.includes('Ctrl+Shift+O'))).toBe(true);
		expect(tooltipsText.some(t => t?.includes('Ctrl+K'))).toBe(true);
	});

	it('R1: renders floating popover for pinned and recent sessions with switching', () => {
		const component = fixture.componentInstance;
		const id1 = answer('الموضوع الأول', 'رد 1');
		store.pinConversation(id1);
		store.newConversation();
		const id2 = answer('الموضوع الثاني', 'رد 2');
		fixture.detectChanges();

		component.desktopCollapsed.set(true);
		fixture.detectChanges();

		// Open pinned popover
		component.openRailPopover('pinned', el().querySelector('.tc-brand-entry button'), false, true);
		fixture.detectChanges();

		const popover = el().querySelector('.tc-rail-session-popover');
		expect(popover).toBeTruthy();
		expect(popover?.querySelector('.tc-rail-popover-caption')?.textContent).toContain('المثبتة');
		expect(popover?.textContent).toContain('الموضوع الأول');
		expect(popover?.textContent).not.toContain('الموضوع الثاني');

		// Open recent popover
		component.openRailPopover('recent', el().querySelector('.tc-brand-entry button'), false, true);
		fixture.detectChanges();

		const recentPopover = el().querySelector('.tc-rail-session-popover');
		expect(recentPopover?.querySelector('.tc-rail-popover-caption')?.textContent).toContain('الأخيرة');
		expect(recentPopover?.textContent).toContain('الموضوع الأول');
		expect(recentPopover?.textContent).toContain('الموضوع الثاني');

		// Select session from popover
		component.selectConversation(id1);
		component.closeRailPopover();
		fixture.detectChanges();

		expect(store.activeConversationId()).toBe(id1);
		expect(el().querySelector('.tc-rail-session-popover')).toBeNull();
	});

	// ── R2: Topbar & Header Simplification ────────────────────────────────────
	it('R2: renders topbar with single tab «المحادثة · نديم» and share button', async () => {
		const topbar = el().querySelector('.tc-topbar');
		expect(topbar).toBeTruthy();

		const tabs = topbar?.querySelectorAll('.tc-workspace-tabs button, .tc-workspace-tabs span');
		expect(tabs?.length).toBe(1);
		expect(tabs?.[0].textContent).toContain('المحادثة · نديم');

		const shareButton = topbar?.querySelector('.tc-share-button') as HTMLButtonElement;
		expect(shareButton).toBeTruthy();

		// With no messages, share button is disabled
		expect(shareButton.disabled).toBe(true);

		// Add message and test share button
		answer('سؤال وسيط', 'رد وسيط');
		fixture.detectChanges();
		expect(shareButton.disabled).toBe(false);

		const writeTextMock = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal('navigator', { clipboard: { writeText: writeTextMock } });

		shareButton.click();
		fixture.detectChanges();
		expect(writeTextMock).toHaveBeenCalled();
	});

	// ── R3: Centered Welcome Screen with 3 Waseet suggestions ─────────────────
	it('R3: renders centered welcome heading and exactly 3 Waseet suggestion cards when empty', () => {
		const component = fixture.componentInstance;
		expect(component.isEmpty()).toBe(true);
		expect(el().querySelector('.tc-chat-column')?.classList.contains('is-empty')).toBe(true);

		const welcomeH1 = el().querySelector('#assistant-welcome');
		expect(welcomeH1?.textContent).toContain('أهلًا بك، كيف يمكنني مساعدتك؟');

		const suggestionButtons = Array.from(el().querySelectorAll('.tc-welcome-suggestions button'));
		expect(suggestionButtons).toHaveLength(3);

		const texts = suggestionButtons.map(b => b.textContent?.trim());
		expect(texts[0]).toContain('ما الفرق بين العربون وحساب الضمان في منصة وسيط؟');
		expect(texts[1]).toContain('ساعدني أكتب طلب خدمة واضح لمقدمي الخدمات في وسيط');
		expect(texts[2]).toContain('ما خطوات توثيق الحساب وضمان حقوق الطرفين في المنصة؟');

		// Clicking suggestion card submits prompt and transitions out of empty state
		(suggestionButtons[0] as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(store.messages()[0]?.text).toBe('ما الفرق بين العربون وحساب الضمان في منصة وسيط؟');
	});

	// ── R4: ChatGPT-like 3-Column Grid Composer Dock ─────────────────────────
	it('R4: renders 3-column composer grid, tools menu with only 2 items, and smart send button', () => {
		const composer = el().querySelector('.tc-composer');
		expect(composer).toBeTruthy();
		expect(composer?.querySelector('.tc-composer-tools')).toBeTruthy();
		expect(composer?.querySelector('textarea#user-input')).toBeTruthy();
		expect(composer?.querySelector('.tc-composer-actions')).toBeTruthy();

		const component = fixture.componentInstance;

		// Tools menu: open and verify exactly 2 items
		component.toolsOpen.set(true);
		fixture.detectChanges();

		const toolButtons = Array.from(el().querySelectorAll('.tc-tools-menu button'));
		expect(toolButtons).toHaveLength(2);
		expect(toolButtons[0].textContent).toContain('إرفاق ملف');
		expect(toolButtons[1].textContent).toContain('بحث مباشر في الإنترنت');

		component.toolsOpen.set(false);
		fixture.detectChanges();

		// Send button: disabled when promptText is empty
		const sendButton = el().querySelector('.tc-send-button') as HTMLButtonElement;
		expect(sendButton).toBeTruthy();
		expect(sendButton.disabled).toBe(true);

		// Enter text: send button enabled
		component.promptText.set('استفسار عن الخدمة');
		fixture.detectChanges();
		const activeSendButton = el().querySelector('.tc-send-button') as HTMLButtonElement;
		expect(activeSendButton.disabled).toBe(false);

		// Auto-expanding textarea
		const textarea = el().querySelector('textarea#user-input') as HTMLTextAreaElement;
		expect(textarea.placeholder).toContain('اسأل نديم عن خدمات وسيط');

		// Disclaimer caption
		const caption = el().querySelector('.tc-composer-caption');
		expect(caption?.textContent).toContain('قد يخطئ المساعد. راجع المعلومات قبل اتخاذ القرار.');
	});

	// ── R5: Assistant Settings Modal ──────────────────────────────────────────
	it('R5: opens and closes assistant settings modal via signals', () => {
		const component = fixture.componentInstance;
		expect(el().querySelector('app-assistant-settings')).toBeNull();

		component.settingsOpen.set(true);
		fixture.detectChanges();

		expect(el().querySelector('app-assistant-settings')).toBeTruthy();

		component.closeAllDialogs();
		fixture.detectChanges();

		expect(el().querySelector('app-assistant-settings')).toBeNull();
	});

	// ── R6 & Shortcuts Verification ───────────────────────────────────────────
	it('R7: handles global keyboard shortcuts (Ctrl+Shift+S, Ctrl+Shift+O, Escape)', () => {
		const component = fixture.componentInstance;

		// Ctrl+Shift+S toggles collapse
		expect(component.desktopCollapsed()).toBe(false);
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true }));
		fixture.detectChanges();
		expect(component.desktopCollapsed()).toBe(true);

		// Escape closes dialogs and popovers
		component.settingsOpen.set(true);
		fixture.detectChanges();
		expect(component.settingsOpen()).toBe(true);

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		fixture.detectChanges();
		expect(component.settingsOpen()).toBe(false);
	});

	it('preserves history management: renames, pins, deletes, and switches conversations', () => {
		const first = answer('العربون', 'رد عن العربون');
		store.newConversation();
		const second = answer('الضمان', 'رد عن الضمان');

		expect(el().querySelectorAll('.history-title')).toHaveLength(2);

		const component = fixture.componentInstance;
		component.startRename(first, 'العربون');
		component.renameDraft = 'العربون المحدث';
		component.saveRename(first);
		store.pinConversation(first);
		fixture.detectChanges();

		expect(el().querySelector('.history-title')?.textContent).toContain('العربون المحدث');
		expect(store.conversations().find(c => c.id === first)?.pinned).toBe(true);

		// Delete flow
		component.confirmDelete(first);
		fixture.detectChanges();
		expect(el().querySelector('.modal')).toBeTruthy();
		component.executeDelete();
		fixture.detectChanges();

		expect(store.conversations().find(c => c.id === first)).toBeUndefined();
	});

	it('renders and toggles top-right three-dots menu (.tc-model-menu)', () => {
		const component = fixture.componentInstance;
		expect(el().querySelector('.tc-model-menu')).toBeNull();

		// Click the three dots button
		const dotsButton = el().querySelector('.tc-header-menu .tc-icon-button') as HTMLButtonElement;
		expect(dotsButton).toBeTruthy();
		dotsButton.click();
		fixture.detectChanges();

		expect(component.topbarMenuOpen()).toBe(true);
		const menu = el().querySelector('.tc-model-menu');
		expect(menu).toBeTruthy();

		// Menu items include print, save txt, share, and settings
		const menuButtons = Array.from(menu?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]') ?? []);
		expect(menuButtons.length).toBe(4);
		const menuLabels = menuButtons.map(b => b.textContent?.trim());
		expect(menuLabels.some(l => l?.includes('طباعة المحادثة'))).toBe(true);
		expect(menuLabels.some(l => l?.includes('حفظ TXT'))).toBe(true);
		expect(menuLabels.some(l => l?.includes('مشاركة المحادثة'))).toBe(true);
		expect(menuLabels.some(l => l?.includes('إعدادات المحادثة'))).toBe(true);

		// Clicking settings from the menu opens settings modal and closes menu
		const settingsBtn = menuButtons.find(b => b.textContent?.includes('إعدادات المحادثة'));
		settingsBtn?.click();
		fixture.detectChanges();

		expect(component.topbarMenuOpen()).toBe(false);
		expect(component.settingsOpen()).toBe(true);
	});

	it('renders error turn with retry button when store has error message', () => {
		answer('سؤال', 'إجابة سابقة');
		store.errorMessage.set('تعذر الحصول على رد من المساعد الذكي حالياً.');
		fixture.detectChanges();

		const errorTurn = el().querySelector('.tc-error-turn');
		expect(errorTurn).toBeTruthy();
		expect(errorTurn?.textContent).toContain('تعذر الحصول على رد من المساعد الذكي حالياً.');

		const retrySpy = vi.spyOn(store, 'retry');
		const retryBtn = errorTurn?.querySelector('.tc-error-actions button') as HTMLButtonElement;
		expect(retryBtn).toBeTruthy();
		expect(retryBtn.textContent).toContain('إعادة المحاولة');

		retryBtn.click();
		fixture.detectChanges();
		expect(retrySpy).toHaveBeenCalled();
	});
});

