/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AssistantChatComponent } from '../../sheards/assistant-chat/assistant-chat';
import { AssistantStore } from '../store/assistant.store';
import { AuthStore } from '../store/auth.store';
import { HelpAssistantSocketService } from '../services/help-assistant-socket.service';
import { AssistantTtsService } from '../services/assistant-tts.service';
import { SECURE_CONTEXT, SPEECH_RECOGNITION } from '../services/speech-recognition';
import { PROVIDER_HELP_ROUTES, guidedCatalog, helpRoleOfUrl } from './help-guided';

@Component({ standalone: true, template: '' })
class Blank {}

describe('help page assistant: guided only (provider help)', () => {
	let fixture: ComponentFixture<AssistantChatComponent>;
	let store: AssistantStore;
	let router: Router;
	const socket = { events$: new Subject<any>().asObservable(), ask: vi.fn(() => 'c-1'), cancel: vi.fn(), disconnect: vi.fn() };
	const token = signal<string | null>('jwt');
	const user = signal<any>({ id: 'p', accountType: 'PROVIDER_INDIVIDUAL' });

	beforeEach(async () => {
		socket.ask.mockClear();
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		await TestBed.configureTestingModule({
			imports: [AssistantChatComponent],
			providers: [
				provideRouter([{ path: '**', component: Blank }]),
				{ provide: HelpAssistantSocketService, useValue: socket },
				{ provide: AuthStore, useValue: { token, currentUser: user } },
				{ provide: AssistantTtsService, useValue: { synthesize: vi.fn() } },
				{ provide: SPEECH_RECOGNITION, useValue: class { start() {} stop() {} abort() {} } },
				{ provide: SECURE_CONTEXT, useValue: () => true },
			],
		}).compileComponents();
		router = TestBed.inject(Router);
		store = TestBed.inject(AssistantStore);
		fixture = TestBed.createComponent(AssistantChatComponent);
	});
	afterEach(() => vi.unstubAllGlobals());

	const el = () => fixture.nativeElement as HTMLElement;
	const goto = async (url: string) => { await router.navigateByUrl(url); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };

	it('only the provider help section is guided; every other page (incl. client / marketer help) keeps the normal chat', () => {
		expect(helpRoleOfUrl('/provider-overview/help')).toBe('provider');
		expect(helpRoleOfUrl('/provider-overview/help/ai-assistant')).toBe('provider');
		expect(helpRoleOfUrl('/provider-overview/help/tickets/new')).toBe('provider');
		for (const u of ['/provider-overview', '/provider-overview/helpdesk', '/client-overview/help', '/marketer-overview/help', '/marketplace', '/provider-overview/finance/wallet']) expect(helpRoleOfUrl(u), u).toBeNull();
	});

	it('on the provider help page there is no text input, no send button and no mic: only choices', async () => {
		await goto('/provider-overview/help');
		expect(store.guided()).toBe(true);
		expect(el().querySelector('[data-testid="assistant-guided"]')).toBeTruthy();
		expect(el().querySelector('textarea')).toBeNull();
		expect(el().querySelector('input[type="text"], input[type="search"], input:not([type])')).toBeNull();
		expect(el().querySelector('.ac__mic')).toBeNull();
		expect(el().querySelector('.ac__btn')).toBeNull();
		expect(el().querySelector('.ac__input')).toBeNull();
		const chips = Array.from(el().querySelectorAll('[data-testid="guided-chips"] button')).map((b) => b.textContent!.trim());
		expect(chips).toEqual(['الضمان المالي', 'تقديم عرض', 'سحب الأرباح', 'النزاعات', 'التذاكر والدعم', 'مشكلة أخرى / التواصل مع الدعم البشري']);
	});

	it('typing / speaking can never reach the model from the help page (ask and the mic are refused)', async () => {
		await goto('/provider-overview/help');
		expect(store.ask('كيف يعمل الضمان؟')).toBe(false);
		store.toggleListening();
		expect(socket.ask).not.toHaveBeenCalled();
		expect(store.micActive()).toBe(false);
	});

	it('each choice shows a ready answer; the links go to the right section / ticket / human support', async () => {
		await goto('/provider-overview/help');
		const expected: Record<string, string[]> = {
			guarantee: [], offer: [PROVIDER_HELP_ROUTES.explore], payout: [PROVIDER_HELP_ROUTES.wallet, PROVIDER_HELP_ROUTES.withdraw],
			dispute: [PROVIDER_HELP_ROUTES.disputes], tickets: [PROVIDER_HELP_ROUTES.newTicket, PROVIDER_HELP_ROUTES.tickets], other: [PROVIDER_HELP_ROUTES.newTicket, PROVIDER_HELP_ROUTES.liveSupport],
		};
		for (const c of guidedCatalog()) {
			(el().querySelector(`[data-testid="guided-chips"] [data-id="${c.id}"]`) as HTMLButtonElement).click();
			fixture.detectChanges();
			expect(el().querySelector('[data-testid="guided-question"]')!.textContent).toContain(c.question);
			expect(el().querySelector('[data-testid="guided-answer"]')!.textContent!.trim()).toBe(c.answer);
			const hrefs = Array.from(el().querySelectorAll('[data-testid="guided-link"]')).map((a) => a.getAttribute('href'));
			expect(hrefs, c.id).toEqual(expected[c.id]);
		}
		expect(socket.ask).not.toHaveBeenCalled();
	});

	it('the human-support exits are always there and point to the live support and the new-ticket page', async () => {
		await goto('/provider-overview/help');
		expect(el().querySelector('[data-testid="guided-support-link"]')!.getAttribute('href')).toBe(PROVIDER_HELP_ROUTES.liveSupport);
		expect(el().querySelector('[data-testid="guided-ticket-link"]')!.getAttribute('href')).toBe(PROVIDER_HELP_ROUTES.newTicket);
	});

	it('leaving the help page restores the normal chat (input, mic, send) and ask works again', async () => {
		await goto('/provider-overview/help');
		await goto('/provider-overview/finance/wallet');
		expect(store.guided()).toBe(false);
		expect(el().querySelector('textarea')).toBeTruthy();
		expect(el().querySelector('.ac__mic')).toBeTruthy();
		expect(store.ask('سؤال عادي')).toBe(true);
		expect(socket.ask).toHaveBeenCalled();
	});

	it('client and marketer help pages are untouched (normal chat there)', async () => {
		for (const u of ['/client-overview/help', '/marketer-overview/help']) { await goto(u); expect(store.guided(), u).toBe(false); expect(el().querySelector('textarea'), u).toBeTruthy(); }
	});
});

describe('guided routes exist and the provider help page wires the choices', () => {
	const APP = join(__dirname, '../..');
	it('every route in the catalogue is a real provider route', () => {
		const routes = readFileSync(join(APP, 'pages/dashboard/provider-overview/provider.routes.ts'), 'utf8');
		for (const r of Object.values(PROVIDER_HELP_ROUTES)) expect(routes, r).toContain(`path: '${r.replace('/provider-overview/', '')}'`);
	});
	it('the page has no free input: "اسأل المساعد" opens Bebo, the choices come from the same catalogue', () => {
		const html = readFileSync(join(APP, 'pages/dashboard/provider-overview/help/help.html'), 'utf8');
		const hero = html.slice(html.indexOf('aria-label="المساعد الذكي"'), html.indexOf('<!-- Topics -->'));
		expect(hero).toContain('data-testid="ask-assistant-btn"');
		expect(hero).toContain('(click)="openAssistant()"');
		expect(hero).toContain('askGuided(c.id)');
		expect(hero).not.toMatch(/<input|<textarea|ngSubmit|ngModel/);
	});
});
