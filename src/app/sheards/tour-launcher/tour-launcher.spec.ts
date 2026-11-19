import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { vi } from 'vitest';
import { TourLauncherComponent } from './tour-launcher';
import { TourService } from '../../core/tour/tour.service';
import { AuthStore } from '../../core/store/auth.store';
import { signal } from '@angular/core';
import { UserRole } from '../../core/models/auth.model';

describe('TourLauncherComponent', () => {
	let events: Subject<any>; let url: string;
	let authed: ReturnType<typeof signal<boolean>>; let role: ReturnType<typeof signal<UserRole | null>>;
	beforeEach(() => {
		vi.useFakeTimers();
		const mem: Record<string, string> = {}; vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } });
		vi.stubGlobal('Audio', class { onplaying: any; onended: any; onerror: any; play() { return Promise.resolve(); } pause() {} });
		events = new Subject(); url = '/about'; authed = signal(false); role = signal<UserRole | null>(null);
		TestBed.configureTestingModule({ imports: [TourLauncherComponent], providers: [{ provide: Router, useValue: { get url() { return url; }, events, navigateByUrl: () => Promise.resolve(true) } }, { provide: AuthStore, useValue: { isAuthenticated: authed, actingRole: role, currentUser: signal({ id: 'u1' }) } }] });
	});
	afterEach(() => { TestBed.inject(TourService).close(); document.getElementById('email')?.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
	const go = (f: any, to: string) => { url = to; events.next(new NavigationEnd(1, to, to)); f.detectChanges(); };
	const chip = (f: any) => f.nativeElement.querySelector('[data-testid=tour-launcher]') as HTMLButtonElement | null;

	it('shows the chip only on a page that has a tour; clicking it starts THAT page\'s tour', () => {
		const f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
		expect(chip(f)).not.toBeNull();
		chip(f)!.click();
		expect(TestBed.inject(TourService).tour()?.id).toBe('page-about-v1');
		f.detectChanges(); expect(chip(f)).toBeNull(); // hidden while a tour runs
	});
	it('no chip on the home page, article pages or any dashboard; it follows navigation', () => {
		const f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
		for (const p of ['/', '/blog/an-article', '/client-overview', '/provider-overview/offers']) { go(f, p); expect(chip(f), p).toBeNull(); }
		go(f, '/contact'); expect(chip(f)).not.toBeNull();
	});
	it('the registration form tour is offered only once the form fields are on screen', () => {
		url = '/auth/register';
		const f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
		expect(chip(f)).toBeNull();
		const roles = document.createElement('div'); roles.className = 'roles-grid'; document.body.appendChild(roles);
		vi.advanceTimersByTime(800); f.detectChanges();
		chip(f)!.click(); expect(TestBed.inject(TourService).tour()?.id).toBe('page-register-roles-v1'); TestBed.inject(TourService).close(); roles.remove();
		const email = document.createElement('input'); email.id = 'email'; document.body.appendChild(email);
		vi.advanceTimersByTime(800); f.detectChanges();
		expect(chip(f)).not.toBeNull();
		chip(f)!.click(); expect(TestBed.inject(TourService).tour()?.id).toBe('page-register-form-v1'); TestBed.inject(TourService).close();
		email.remove(); vi.advanceTimersByTime(800); f.detectChanges();
		expect(chip(f)).toBeNull();
	});
	it('after a page tour was completed the chip offers to repeat it', () => {
		const f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
		const t = TestBed.inject(TourService);
		vi.spyOn(t, 'isDone').mockReturnValue(true);
		go(f, '/about');
		expect(chip(f)!.textContent).toContain('إعادة');
	});

	describe('the signed-in user\'s dashboard tour', () => {
		beforeEach(() => { authed.set(true); role.set(UserRole.CLIENT); });
		it('a client inside /client-overview is offered «جولة في لوحتك» (the role tour), not a page tour; outside the dashboard there is none', () => {
			url = '/client-overview/my-requests';
			const f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
			expect(chip(f)!.textContent).toContain('جولة في لوحتك');
			chip(f)!.click(); expect(TestBed.inject(TourService).tour()?.id).toBe('client-v1');
			TestBed.inject(TourService).close();
			go(f, '/provider-overview'); expect(chip(f)).toBeNull(); // a client does not get the provider area's tour (there is none)
		});
		it('the first visit shows a one-time «تحب جولة؟» card: «لاحقًا» hides it for good (per user); «ابدأ الجولة» starts the tour', () => {
			url = '/client-overview';
			let f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
			expect(f.nativeElement.querySelector('[data-testid=tour-suggestion]')).not.toBeNull();
			(f.nativeElement.querySelector('[data-testid=tour-suggestion-no]') as HTMLButtonElement).click(); f.detectChanges();
			expect(f.nativeElement.querySelector('[data-testid=tour-suggestion]')).toBeNull(); expect(chip(f)).not.toBeNull();
			f = TestBed.createComponent(TourLauncherComponent); f.detectChanges(); // a new page load: it does not come back
			expect(f.nativeElement.querySelector('[data-testid=tour-suggestion]')).toBeNull();
		});
		it('accepting the suggestion starts the client tour and the card is not shown again', () => {
			url = '/client-overview';
			const f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
			(f.nativeElement.querySelector('[data-testid=tour-suggestion-yes]') as HTMLButtonElement).click();
			expect(TestBed.inject(TourService).tour()?.id).toBe('client-v1');
		});
		it('a visitor never sees the suggestion', () => {
			authed.set(false); role.set(null); url = '/client-overview';
			const f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
			expect(f.nativeElement.querySelector('[data-testid=tour-suggestion]')).toBeNull();
		});
	});
});
