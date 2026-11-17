import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { AuthStore } from '../../../core/store/auth.store';
import { About } from './about';
import { HowItWorks } from '../how-it-works/how-it-works';

// «سجّل حساباً مجاناً» is for visitors only: a signed-in user sees «تواصل معنا» alone (about) / no registration band (how it works).
describe('registration calls to action hide for a signed-in user', () => {
	beforeAll(() => { if (!window.matchMedia) (window as any).matchMedia = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); });
	function render<T>(cmp: new () => T, authenticated: boolean) {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ imports: [cmp as never], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AuthStore, useValue: { isAuthenticated: signal(authenticated), currentUser: () => (authenticated ? { id: 'u1' } : null) } }] });
		const f = TestBed.createComponent(cmp); f.detectChanges(); return f.nativeElement as HTMLElement;
	}
	it('about: visitor sees both buttons; signed-in sees only «تواصل معنا»', () => {
		const visitor = render(About, false);
		expect(visitor.querySelector('[data-testid="about-register-cta"]')).toBeTruthy(); expect(visitor.textContent).toContain('تواصل معنا');
		const user = render(About, true);
		expect(user.querySelector('[data-testid="about-register-cta"]')).toBeNull(); expect(user.querySelector('a[href="/auth/register"]')).toBeNull(); expect(user.textContent).toContain('تواصل معنا');
	});
	it('how it works: the closing registration band shows for a visitor only', () => {
		expect(render(HowItWorks, false).querySelector('.cta-band a[href="/auth/register"]')).toBeTruthy();
		expect(render(HowItWorks, true).querySelector('.cta-band')).toBeNull();
	});
});
