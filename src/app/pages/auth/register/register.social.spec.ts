import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Component, signal } from '@angular/core';
import { Subject, of } from 'rxjs';
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
});
