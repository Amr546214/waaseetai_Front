import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { AuthStore } from './core/store/auth.store';

// The screen must not be blank while a lazy area chunk loads (cold start after sign-in, wrong-area redirect): the full loader stays up until the first
// navigation has ended, and later navigations show a slim progress bar.

@Component({ standalone: true, template: '<p>page</p>' })
class Page {}

describe('App navigation loader', () => {
	let fixture: ComponentFixture<App>;
	let router: Router;
	const pending: Array<() => void> = [];
	const lazy = () => new Promise<typeof Page>(resolve => pending.push(() => resolve(Page)));
	const loaderVisible = () => {
		const el = fixture.nativeElement.querySelector('.global-app-loader') as HTMLElement | null;
		return !!el && !el.classList.contains('fade-out');
	};

	beforeEach(async () => {
		pending.length = 0;
		vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
		await TestBed.configureTestingModule({
			imports: [App],
			providers: [
				provideRouter([
					{ path: 'home', component: Page },
					{ path: 'area', loadComponent: lazy },
					{ path: 'other-area', loadComponent: lazy },
					{ path: 'moved', redirectTo: 'home' },
				]),
				{ provide: AuthStore, useValue: { token: signal<string | null>(null).asReadonly(), currentUser: signal(null), isInitialized$: of(true) } },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(App);
		router = TestBed.inject(Router);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('keeps the full loader up while the first route\'s lazy chunk is loading, then lets it fade out', async () => {
		const nav = router.navigateByUrl('/area');
		fixture.detectChanges();
		await vi.waitFor(() => expect(pending.length).toBe(1));
		expect(fixture.componentInstance.firstRouteDone()).toBe(false);
		expect(loaderVisible()).toBe(true);
		pending[0]();
		await nav;
		fixture.detectChanges();
		expect(fixture.componentInstance.firstRouteDone()).toBe(true);
		expect(loaderVisible()).toBe(false);
	});

	it('a later navigation shows the slim progress bar until its chunk arrives', async () => {
		await router.navigateByUrl('/home');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.nav-progress')).toBeNull();
		const nav = router.navigateByUrl('/other-area');
		fixture.detectChanges();
		await vi.waitFor(() => expect(pending.length).toBe(1));
		fixture.detectChanges();
		const bar = fixture.nativeElement.querySelector('.nav-progress') as HTMLElement;
		expect(bar).toBeTruthy();
		expect(bar.getAttribute('role')).toBe('progressbar');
		pending[0]();
		await nav;
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.nav-progress')).toBeNull();
	});

	it('a cancelled first navigation (guard said no) does not leave the loader up forever', async () => {
		router.resetConfig([{ path: 'no', component: Page, canActivate: [() => false] }, { path: 'home', component: Page }]);
		await router.navigateByUrl('/no');
		fixture.detectChanges();
		expect(fixture.componentInstance.firstRouteDone()).toBe(true);
		expect(loaderVisible()).toBe(false);
	});
});
