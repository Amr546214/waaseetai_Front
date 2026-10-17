import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SocialAuthService } from '@abacritt/angularx-social-login';

import { Register } from './register';
import { AuthStore } from '../../../core/store/auth.store';

const NOTE = 'تسجيل الدخول عبر Apple غير متاح حاليًا';

@Component({ selector: 'app-test-blank', template: '' })
class BlankTestComponent {}

function setup() {
	const postSpy = vi.fn<(...args: any[]) => any>(() => of({ success: true, data: {} }));
	const authState = new Subject<any>();
	const signIn = vi.fn();
	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
	TestBed.configureTestingModule({
		imports: [Register],
		providers: [
			provideRouter([{ path: '**', component: BlankTestComponent }]),
			{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
			{ provide: HttpClient, useValue: { post: (...a: any[]) => postSpy(...a), get: () => of({ success: true, data: { active: false } }) } },
			{ provide: AuthStore, useValue: { currentUser: signal<any>(null), pendingUserId: signal<any>(null), authenticate: vi.fn(), setPendingVerification: vi.fn() } },
			{ provide: SocialAuthService, useValue: { authState, initState: of(undefined), signIn } },
		],
	});
	const fixture = TestBed.createComponent(Register);
	const router = TestBed.inject(Router);
	const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
	const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
	fixture.detectChanges();
	postSpy.mockClear(); // ignore the page's own init calls (referral-cookie clear)
	fixture.nativeElement.querySelectorAll('.roles-grid .role-card')[1].querySelector('button.role-cta').click();
	fixture.detectChanges();
	return { fixture, el: fixture.nativeElement as HTMLElement, postSpy, authState, signIn, nav, navigate };
}

describe('Register social buttons (DOM, step 2)', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('Apple is disabled + aria-disabled with the note; a forced click calls no provider / http / navigation', () => {
		const { fixture, el, postSpy, signIn, nav, navigate } = setup();
		expect(fixture.componentInstance.currentStep).toBe(2);
		const apple = el.querySelector<HTMLButtonElement>('#btn-apple')!;
		expect(apple.tagName).toBe('BUTTON');
		expect(apple.disabled).toBe(true);
		expect(apple.getAttribute('aria-disabled')).toBe('true');
		expect(apple.title).toBe(NOTE);
		expect(el.querySelector('#apple-unavailable-note')!.textContent!.trim()).toBe(NOTE);
		apple.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		apple.click();
		expect(signIn).not.toHaveBeenCalled();
		expect(postSpy).not.toHaveBeenCalled();
		expect(nav).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
	});

	it('Google stays enabled and its credential reaches the existing /auth/google register path', () => {
		const { el, postSpy, authState } = setup();
		const google = el.querySelector<HTMLButtonElement>('#btn-google')!;
		expect(google.disabled).toBe(false);
		expect(google.hasAttribute('aria-disabled')).toBe(false);
		expect(el.querySelector('.google-btn-wrapper asl-google-signin-button')).not.toBeNull();
		authState.next({ idToken: 'tok', provider: 'GOOGLE' });
		expect(postSpy).toHaveBeenCalledTimes(1);
		expect(String(postSpy.mock.calls[0][0])).toContain('/google');
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

describe('Register Google sign-up 429', () => {
	afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
	it('gates only the Google button with the ticking label and the sentence; nothing is retried at zero; Apple and the form are untouched', async () => {
		vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
		const { fixture, el, postSpy, authState } = setup();
		postSpy.mockReturnValue(throwError(() => ({ status: 429, headers: { get: (k: string) => (k === 'Retry-After' ? '35' : null) }, error: { message: 'x' } })));
		authState.next({ idToken: 'tok', provider: 'GOOGLE' });
		await vi.advanceTimersByTimeAsync(0); fixture.detectChanges();
		expect(postSpy).toHaveBeenCalledTimes(1);
		expect((el.querySelector('#btn-google') as HTMLButtonElement).disabled).toBe(true);
		expect(el.querySelector('#google-wait')!.textContent).toContain('بعد 0:35');
		expect(el.querySelector('.google-btn-wrapper asl-google-signin-button')).toBeNull();
		expect(el.querySelector('[data-testid="rate-limit-msg"]')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد 0:35');
		authState.next({ idToken: 'tok2', provider: 'GOOGLE' });
		expect(postSpy).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(36_000); fixture.detectChanges();
		expect((el.querySelector('#btn-google') as HTMLButtonElement).disabled).toBe(false);
		expect(postSpy).toHaveBeenCalledTimes(1);
	});
});
