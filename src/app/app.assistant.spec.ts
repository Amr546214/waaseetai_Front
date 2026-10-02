import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Component, signal } from '@angular/core';
import { ComponentFixture, DeferBlockState, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { AuthStore } from './core/store/auth.store';
import { AssistantTtsService } from './core/services/assistant-tts.service';
import { HelpAssistantSocketService, HelpStreamEvent } from './core/services/help-assistant-socket.service';
import { SECURE_CONTEXT, SPEECH_RECOGNITION } from './core/services/speech-recognition';

// App-level behaviour of the ONE floating assistant (Bebo): where it appears for a visitor,
// on auth/error pages, and for a signed-in user. Transport and storage are faked.

@Component({ standalone: true, template: '<p>page</p>' })
class Page {}

class FakeRecognition {
	lang = ''; continuous = true; interimResults = false; maxAlternatives = 0;
	onstart: any = null; onresult: any = null; onerror: any = null; onend: any = null;
	start() {} stop() { this.onend?.(); } abort() {}
}

function stubBrowserApis(): void {
	vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
	class FakeObserver { observe() {} unobserve() {} disconnect() {} }
	vi.stubGlobal('IntersectionObserver', FakeObserver);
	vi.stubGlobal('ResizeObserver', FakeObserver);
	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
}

describe('App-level assistant (single floating Bebo)', () => {
	let fixture: ComponentFixture<App>;
	let router: Router;
	const token = signal<string | null>(null);
	const events = new Subject<HelpStreamEvent>();
	const socket = { events$: events.asObservable(), ask: vi.fn(() => 'a-1'), cancel: vi.fn(), disconnect: vi.fn() };
	const tts = { synthesize: vi.fn(() => new Subject<Blob>().asObservable()) };
	const authStub = { token: token.asReadonly(), currentUser: signal({ id: 'u1', activeRole: 'CLIENT' }), isInitialized$: of(true) };

	beforeEach(async () => {
		token.set(null);
		socket.ask.mockClear();
		tts.synthesize.mockClear();
		stubBrowserApis();
		if (!customElements.get('cute-robot')) new Function(readFileSync('public/bebo/robot.js', 'utf8'))();
		await TestBed.configureTestingModule({
			imports: [App],
			providers: [
				provideRouter([
					{ path: '', component: Page },
					{ path: 'marketplace', component: Page },
					{ path: 'auth', component: Page, data: { hideAssistant: true }, children: [{ path: 'login', component: Page }] },
					{ path: 'error/500', component: Page, data: { type: '500', hideAssistant: true } },
					{ path: 'client-overview', component: Page },
					{ path: '**', component: Page, data: { hideAssistant: true } },
				]),
				{ provide: AuthStore, useValue: authStub },
				{ provide: HelpAssistantSocketService, useValue: socket },
				{ provide: AssistantTtsService, useValue: tts },
				{ provide: SPEECH_RECOGNITION, useValue: FakeRecognition },
				{ provide: SECURE_CONTEXT, useValue: () => true },
			],
		}).compileComponents();
		router = TestBed.inject(Router);
		fixture = TestBed.createComponent(App);
	});

	afterEach(() => vi.unstubAllGlobals());

	const el = () => fixture.nativeElement as HTMLElement;
	async function go(url: string): Promise<void> {
		await router.navigateByUrl(url);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	}
	async function mountWidget(): Promise<void> {
		const blocks = await fixture.getDeferBlocks();
		expect(blocks.length).toBe(1);
		await blocks[0].render(DeferBlockState.Complete);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	}
	const robot = () => el().querySelector('app-assistant-widget cute-robot') as HTMLElement;
	const clickRobot = () => { robot().dispatchEvent(new MouseEvent('click', { bubbles: true })); fixture.detectChanges(); };

	describe('visitor on a public page', () => {
		it('shows exactly one robot; clicking it opens the login prompt (no chat, no input, no network)', async () => {
			await go('/marketplace');
			await mountWidget();
			expect(el().querySelectorAll('app-assistant-widget').length).toBe(1);
			expect(el().querySelectorAll('cute-robot').length).toBe(1);
			clickRobot();
			const prompt = el().querySelector('[data-testid="assistant-guest-prompt"]') as HTMLElement;
			expect(prompt.textContent).toContain('سجّل الدخول لتتحدث مع بيبو');
			expect((el().querySelector('.aw__login') as HTMLAnchorElement).getAttribute('href')).toBe('/auth/login');
			expect(el().querySelector('app-assistant-chat')).toBeNull();
			expect(el().querySelector('textarea, input')).toBeNull();
			expect(socket.ask).not.toHaveBeenCalled();
			expect(tts.synthesize).not.toHaveBeenCalled();
		});
	});

	describe('auth and error pages', () => {
		for (const url of ['/auth/login', '/error/500', '/no/such/page']) {
			it(`${url}: no assistant is mounted at all`, async () => {
				await go(url);
				expect((await fixture.getDeferBlocks()).length).toBe(0);
				expect(el().querySelector('app-assistant-widget')).toBeNull();
				expect(el().querySelector('cute-robot')).toBeNull();
			});
		}

		it('navigating from a public page into auth removes it, and back brings exactly one back', async () => {
			await go('/');
			await mountWidget();
			expect(el().querySelectorAll('app-assistant-widget').length).toBe(1);
			await go('/auth/login');
			expect(el().querySelector('app-assistant-widget')).toBeNull();
			await go('/marketplace');
			await mountWidget();
			expect(el().querySelectorAll('app-assistant-widget').length).toBe(1);
		});
	});

	describe('signed-in user', () => {
		beforeEach(() => token.set('session-token'));

		for (const url of ['/', '/marketplace', '/client-overview']) {
			it(`${url}: one robot and the real assistant chat opens on click (unchanged behaviour)`, async () => {
				await go(url);
				await mountWidget();
				expect(el().querySelectorAll('app-assistant-widget').length).toBe(1);
				clickRobot();
				expect(el().querySelector('.aw__panel app-assistant-chat')).toBeTruthy();
				expect(el().querySelector('[data-testid="assistant-guest-prompt"]')).toBeNull();
			});
		}
	});
});

describe('single-instance guard (static)', () => {
	const walk = (dir: string): string[] =>
		readdirSync(dir).flatMap((n) => {
			const p = join(dir, n);
			return statSync(p).isDirectory() ? walk(p) : [p];
		});

	it('<app-assistant-widget> is mounted only in the app root template', () => {
		const files = walk(join(process.cwd(), 'src/app')).filter((f) => /\.(ts|html)$/.test(f) && !f.endsWith('.spec.ts'));
		const mounts = files.filter((f) => readFileSync(f, 'utf8').includes('<app-assistant-widget')).map((f) => f.slice(f.indexOf('src/app/') + 8));
		expect(mounts).toEqual(['app.ts']);
	});

	it('index.html does not install a second Bebo (no <cute-robot>/<bebo-chat>, no bebo-chat.js shipped)', () => {
		const index = readFileSync(join(process.cwd(), 'src/index.html'), 'utf8');
		expect(index).not.toContain('<cute-robot');
		expect(index).not.toContain('<bebo-chat');
		expect(index).not.toContain('bebo-chat.js');
		expect(existsSync(join(process.cwd(), 'public/bebo/bebo-chat.js'))).toBe(false);
	});
});
