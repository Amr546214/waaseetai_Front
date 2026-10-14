import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { SocialAuthService } from '@abacritt/angularx-social-login';

import { Login } from './login/login';
import { AuthStore } from '../../core/store/auth.store';

const NOTE = 'تسجيل الدخول عبر Apple غير متاح حاليًا';
const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

const pages = [
	{ name: 'login', html: read('login/login.html'), css: read('login/login.css'), ts: read('login/login.ts'), scope: 'app-login ' },
	{ name: 'register', html: read('register/register.html'), css: read('register/register.css'), ts: read('register/register.ts'), scope: 'app-register .rg-s2 ' },
];

describe('Apple social button (static guard, login + register)', () => {
	for (const p of pages) {
		describe(p.name, () => {
			const buttons = p.html.match(/<button[^>]*btn-apple[^>]*>/g) ?? [];
			it('every Apple button is really disabled, aria-disabled, has no click handler and carries the note', () => {
				expect(buttons.length).toBe(1);
				for (const b of buttons) {
					expect(b).toMatch(/\sdisabled(\s|>)/);
					expect(b).toContain('aria-disabled="true"');
					expect(b).not.toMatch(/\(click\)/);
					expect(b).toContain(`title="${NOTE}"`);
					expect(b).toContain('aria-describedby="apple-unavailable-note"');
				}
				expect(p.html).toContain(`id="apple-unavailable-note">${NOTE}</div>`);
			});
			it('no Apple sign-in handler or [disabled]="false" survives in the component or template', () => {
				expect(p.ts).not.toMatch(/appleSignIn|appleNotice/);
				expect(p.html).not.toMatch(/appleSignIn|\[disabled\]="false"/);
			});
			it('stylesheet: disabled look, no hover on disabled, google hover + focus-visible + active use a constant border colour', () => {
				expect(p.css).toContain(`${p.scope}.btn-social:disabled,${p.scope}.btn-apple:disabled{opacity:.5;cursor:not-allowed;pointer-events:none`);
				expect(p.css).toContain(`${p.scope}.btn-social:hover:not(:disabled)`);
				expect(p.css).toContain(`${p.scope}.google-btn-wrapper:hover .btn-google`);
				expect(p.css).toMatch(/\.google-btn-wrapper:focus-within \.btn-google[^{]*\.btn-google:focus-visible\{border-color:var\(--teal\);box-shadow:0 0 0 3px/);
				expect(p.css).toContain(`${p.scope}.google-btn-wrapper:active .btn-google`);
				// the Google control is a cross-origin iframe overlay: state is mirrored by GoogleBtnStateDirective as classes
				expect(p.css).toContain(`${p.scope}.google-btn-wrapper.is-hover .btn-google`);
				expect(p.css).toContain(`${p.scope}.google-btn-wrapper.is-focus .btn-google`);
				expect(p.ts).toContain('GoogleBtnStateDirective');
				// base border is 1.5px and never changes width
				expect(p.css).toMatch(/\.btn-social\{[^}]*border:1\.5px solid/);
				expect(p.css).not.toMatch(/\.btn-(google|social)[^{]*:(hover|focus-visible|active)[^{]*\{[^}]*border-width/);
			});
		});
	}
});

describe('Login social buttons (DOM)', () => {
	function setup() {
		const postSpy = vi.fn<(...args: any[]) => any>(() => of({}));
		const authState = new Subject<any>();
		TestBed.configureTestingModule({
			imports: [Login],
			providers: [
				provideRouter([{ path: '**', component: BlankTestComponent }]),
				{ provide: HttpClient, useValue: { post: (...a: any[]) => postSpy(...a), get: (...a: any[]) => postSpy(...a) } },
				{ provide: AuthStore, useValue: { currentUser: signal<any>(null), authenticate: vi.fn(), setPendingVerification: vi.fn() } },
				{ provide: SocialAuthService, useValue: { authState, initState: of(undefined), signIn: vi.fn() } },
			],
		});
		const fixture = TestBed.createComponent(Login);
		const router = TestBed.inject(Router);
		const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
		const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
		fixture.detectChanges();
		return { fixture, el: fixture.nativeElement as HTMLElement, postSpy, nav, navigate, social: TestBed.inject(SocialAuthService) as any };
	}

	it('Apple is disabled + aria-disabled, shows the note, and a forced click triggers no provider / http / navigation', () => {
		const { el, postSpy, nav, navigate, social } = setup();
		const apple = el.querySelector<HTMLButtonElement>('#btn-apple')!;
		expect(apple.tagName).toBe('BUTTON');
		expect(apple.disabled).toBe(true);
		expect(apple.getAttribute('aria-disabled')).toBe('true');
		expect(apple.title).toBe(NOTE);
		expect(el.querySelector('#apple-unavailable-note')!.textContent!.trim()).toBe(NOTE);
		apple.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		apple.click();
		expect(social.signIn).not.toHaveBeenCalled();
		expect(postSpy).not.toHaveBeenCalled();
		expect(nav).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
	});

	it('Google stays enabled and its existing flow still runs on a Google credential', () => {
		const { el, postSpy } = setup();
		const google = el.querySelector<HTMLButtonElement>('#btn-google')!;
		expect(google.disabled).toBe(false);
		expect(google.hasAttribute('aria-disabled')).toBe(false);
		expect(el.querySelector('.google-btn-wrapper asl-google-signin-button')).not.toBeNull();
		const auth = TestBed.inject(SocialAuthService) as any;
		auth.authState.next({ idToken: 'tok', provider: 'GOOGLE' });
		expect(postSpy).toHaveBeenCalled();
		expect(JSON.stringify(postSpy.mock.calls[0])).toContain('google');
	});

	it('Google overlay state: is-hover follows pointer geometry (padded rect), is-focus follows document.activeElement, listeners removed on destroy', () => {
		const { fixture, el } = setup();
		const wrap = el.querySelector<HTMLElement>('.google-btn-wrapper')!;
		wrap.getBoundingClientRect = () => ({ left: 100, top: 100, right: 300, bottom: 150, width: 200, height: 50, x: 100, y: 100, toJSON: () => ({}) }) as DOMRect;
		const move = (x: number, y: number) => document.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y }));
		move(200, 120);
		expect(wrap.classList.contains('is-hover')).toBe(true);
		move(96, 120); // inside the 6px pad: last parent event before entering the iframe still counts
		expect(wrap.classList.contains('is-hover')).toBe(true);
		window.dispatchEvent(new Event('blur')); // click into the iframe must not clear hover
		expect(wrap.classList.contains('is-hover')).toBe(true);
		move(10, 10);
		expect(wrap.classList.contains('is-hover')).toBe(false);
		move(200, 120);
		document.documentElement.dispatchEvent(new MouseEvent('mouseleave'));
		expect(wrap.classList.contains('is-hover')).toBe(false);

		const iframe = document.createElement('iframe');
		wrap.appendChild(iframe);
		const active = vi.spyOn(document, 'activeElement', 'get');
		active.mockReturnValue(iframe);
		window.dispatchEvent(new Event('blur'));
		expect(wrap.classList.contains('is-focus')).toBe(true);
		active.mockReturnValue(document.body);
		document.dispatchEvent(new Event('focusin'));
		expect(wrap.classList.contains('is-focus')).toBe(false);
		active.mockReturnValue(iframe);
		window.dispatchEvent(new Event('blur'));
		expect(wrap.classList.contains('is-focus')).toBe(true);
		active.mockRestore();

		fixture.destroy();
		wrap.classList.remove('is-hover');
		move(200, 120);
		expect(wrap.classList.contains('is-hover')).toBe(false);
	});
});
