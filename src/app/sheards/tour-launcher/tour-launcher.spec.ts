import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { vi } from 'vitest';
import { TourLauncherComponent } from './tour-launcher';
import { TourService } from '../../core/tour/tour.service';

describe('TourLauncherComponent', () => {
	let events: Subject<any>; let url: string;
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		vi.stubGlobal('Audio', class { onplaying: any; onended: any; onerror: any; play() { return Promise.resolve(); } pause() {} });
		events = new Subject(); url = '/about';
		TestBed.configureTestingModule({ imports: [TourLauncherComponent], providers: [{ provide: Router, useValue: { get url() { return url; }, events, navigateByUrl: () => Promise.resolve(true) } }] });
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
});
