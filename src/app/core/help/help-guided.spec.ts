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
import { CLIENT_HELP_ROUTES, MARKETER_HELP_ROUTES, PROVIDER_HELP_ROUTES, guidedCatalog, guidedSupport, helpRoleOfUrl, type HelpRole } from './help-guided';

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

	it('only each role\'s help section is guided; every other page keeps the normal chat', () => {
		expect(helpRoleOfUrl('/provider-overview/help')).toBe('provider');
		expect(helpRoleOfUrl('/provider-overview/help/ai-assistant')).toBe('provider');
		expect(helpRoleOfUrl('/client-overview/help')).toBe('client');
		expect(helpRoleOfUrl('/client-overview/help/tickets/new')).toBe('client');
		expect(helpRoleOfUrl('/client-overview/help/live-support')).toBe('client');
		expect(helpRoleOfUrl('/marketer-overview/help')).toBe('marketer');
		expect(helpRoleOfUrl('/marketer-overview/help?ticket=1')).toBe('marketer');
		for (const u of ['/provider-overview', '/provider-overview/helpdesk', '/client-overview', '/client-overview/finance/wallet', '/marketer-overview', '/marketer-overview/withdraw', '/marketer-overview/profile/data', '/marketplace', '/supper-admin-overview/help', '/provider-overview/finance/wallet']) expect(helpRoleOfUrl(u), u).toBeNull();
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
			dispute: [PROVIDER_HELP_ROUTES.disputes], tickets: [PROVIDER_HELP_ROUTES.tickets], other: [],
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

	it('the human-support button appears ONCE (not repeated inside an answer), also after choosing "مشكلة أخرى"', async () => {
		await goto('/provider-overview/help');
		(el().querySelector('[data-testid="guided-chips"] [data-id="other"]') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(el().querySelectorAll('[data-testid="guided-support-link"]').length).toBe(1);
		expect(el().querySelectorAll('[data-testid="guided-ticket-link"]').length).toBe(1);
		expect(el().querySelectorAll('[data-testid="guided-link"]').length).toBe(0);
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

	it('other dashboard pages of every role keep the normal chat (input, mic, send)', async () => {
		for (const u of ['/client-overview', '/client-overview/finance/wallet', '/marketer-overview', '/marketer-overview/withdraw', '/provider-overview']) {
			await goto(u); expect(store.guided(), u).toBe(false); expect(el().querySelector('textarea'), u).toBeTruthy(); expect(el().querySelector('.ac__mic'), u).toBeTruthy();
		}
	});

	const ROLE_CASES: { role: HelpRole; url: string; chips: string[]; links: Record<string, string[]>; support: string | null; ticket: string }[] = [
		{ role: 'client', url: '/client-overview/help', chips: ['إنشاء طلب', 'اختيار عرض', 'الضمان المالي', 'متابعة المشروع', 'النزاعات', 'التذاكر والدعم', 'مشكلة أخرى / التواصل مع الدعم البشري'],
			links: { create: [CLIENT_HELP_ROUTES.createRequest], offer: [CLIENT_HELP_ROUTES.myRequests], guarantee: [], project: [CLIENT_HELP_ROUTES.activeProjects], dispute: [CLIENT_HELP_ROUTES.disputes], tickets: [CLIENT_HELP_ROUTES.tickets], other: [] },
			support: CLIENT_HELP_ROUTES.liveSupport, ticket: CLIENT_HELP_ROUTES.newTicket },
		{ role: 'marketer', url: '/marketer-overview/help', chips: ['رابط الإحالة', 'العمولات', 'السحب', 'حالة الإحالات', 'التذاكر والدعم', 'مشكلة أخرى / التواصل مع الدعم البشري'],
			links: { link: [MARKETER_HELP_ROUTES.refLinks], commission: [MARKETER_HELP_ROUTES.commissions], withdraw: [MARKETER_HELP_ROUTES.withdraw], referrals: [MARKETER_HELP_ROUTES.referrals], tickets: [], other: [] },
			support: null, ticket: MARKETER_HELP_ROUTES.help + '?ticket=1' },
	];

	for (const c of ROLE_CASES) {
		it(`${c.role} help: guided only (no input / send / mic), the role's choices, each with its answer and the right page`, async () => {
			await goto(c.url);
			expect(store.guided()).toBe(true);
			expect(store.guidedRole()).toBe(c.role);
			expect(el().querySelector('textarea')).toBeNull();
			expect(el().querySelector('.ac__mic')).toBeNull();
			expect(el().querySelector('.ac__btn')).toBeNull();
			expect(el().querySelector('input')).toBeNull();
			expect(Array.from(el().querySelectorAll('[data-testid="guided-chips"] button')).map((b) => b.textContent!.trim())).toEqual(c.chips);
			for (const q of guidedCatalog(c.role)) {
				(el().querySelector(`[data-testid="guided-chips"] [data-id="${q.id}"]`) as HTMLButtonElement).click();
				fixture.detectChanges();
				expect(el().querySelector('[data-testid="guided-answer"]')!.textContent!.trim(), q.id).toBe(q.answer);
				expect(Array.from(el().querySelectorAll('[data-testid="guided-link"]')).map((a) => a.getAttribute('href')), q.id).toEqual(c.links[q.id]);
			}
			// the human support: once; marketer has only the ticket form (no live-support page)
			expect(el().querySelectorAll('[data-testid="guided-ticket-link"]').length).toBe(1);
			expect(el().querySelector('[data-testid="guided-ticket-link"]')!.getAttribute('href')).toBe(c.ticket);
			expect(el().querySelectorAll('[data-testid="guided-support-link"]').length).toBe(c.support ? 1 : 0);
			if (c.support) expect(el().querySelector('[data-testid="guided-support-link"]')!.getAttribute('href')).toBe(c.support);
			expect(store.ask('سؤال حر')).toBe(false);
			expect(socket.ask).not.toHaveBeenCalled();
		});
	}

	it('the catalogue answers contain no human-support button of their own (links never duplicate the support exits)', () => {
		for (const role of ['provider', 'client', 'marketer'] as HelpRole[]) {
			const s = guidedSupport(role);
			const exits = new Set([s.support?.route, s.ticket.route].filter(Boolean));
			for (const q of guidedCatalog(role)) for (const l of q.links ?? []) expect(exits.has(l.route), `${role}/${q.id}`).toBe(false);
		}
	});
});

describe('guided routes exist and each help page wires the choices', () => {
	const APP = join(__dirname, '../..');
	const D = 'pages/dashboard/';
	it('every route in the catalogues is a real route of its role', () => {
		const sets: [string, string, Record<string, string>][] = [
			['provider-overview/provider.routes.ts', '/provider-overview/', PROVIDER_HELP_ROUTES], ['clients-overview/client.routes.ts', '/client-overview/', CLIENT_HELP_ROUTES], ['marketer-overview/marketer.routes.ts', '/marketer-overview/', MARKETER_HELP_ROUTES],
		];
		for (const [file, prefix, routes] of sets) {
			const src = readFileSync(join(APP, D + file), 'utf8');
			for (const r of Object.values(routes)) expect(src, r).toContain(`path: '${r.replace(prefix, '')}'`);
		}
	});
	it.each(['provider-overview', 'clients-overview', 'marketer-overview'])('%s help page: no free input in the hero, "اسأل المساعد" opens Bebo, the choices come from the catalogue', (dir) => {
		const html = readFileSync(join(APP, D + dir + '/help/help.html'), 'utf8');
		const hero = html.slice(html.indexOf('data-testid="help-guided-hero"') - 120, html.indexOf('data-testid="help-chips"') + 700);
		expect(hero).toContain('data-testid="ask-assistant-btn"');
		expect(hero).toContain('(click)="openAssistant()"');
		expect(hero).toContain('askGuided(c.id)');
		const heroOnly = html.slice(html.indexOf('data-testid="help-guided-hero"') - 120, html.indexOf('data-testid="help-chips"') + 600);
		expect(heroOnly).toContain('<input');
		expect(readFileSync(join(APP, D + dir + '/help/help.ts'), 'utf8')).not.toMatch(/askAI|fillQ|openAndAsk/);
	});
});
