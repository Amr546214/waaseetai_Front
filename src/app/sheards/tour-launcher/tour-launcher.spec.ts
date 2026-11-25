import { AssistantExamState } from '../../core/store/assistant-exam-state.service';
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

	const box = (f: any) => f.nativeElement.querySelector('[data-testid=tour-suggestion]') as HTMLElement | null;

	it('there is no standing tour button anywhere, page tours included', () => {
		const f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
		for (const p of ['/about', '/contact', '/marketplace', '/', '/client-overview']) { go(f, p); expect(chip(f), p).toBeNull(); }
	});
	it('exam mode hides the first-time box and blocks a queued start', () => {
		url = '/provider-overview'; authed.set(true); role.set(UserRole.PROVIDER);
		const f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
		const entry = f.componentInstance.entry()!; expect(box(f)).not.toBeNull();
		const exam = TestBed.inject(AssistantExamState); exam.setExamActive(true); f.detectChanges();
		expect(box(f)).toBeNull();
		f.componentInstance.start(entry); expect(TestBed.inject(TourService).active()).toBe(false);
	});

	describe('the signed-in user\'s first-time dashboard box', () => {
		beforeEach(() => { authed.set(true); role.set(UserRole.CLIENT); });
		it('shows once on first entry in the middle of the screen and closes by itself after 5 seconds, for good', () => {
			url = '/client-overview';
			let f = TestBed.createComponent(TourLauncherComponent); f.detectChanges(); TestBed.flushEffects?.();
			expect(box(f)).not.toBeNull(); expect(chip(f)).toBeNull();
			vi.advanceTimersByTime(5100); f.detectChanges();
			expect(box(f)).toBeNull();
			f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
			expect(box(f)).toBeNull();
		});
		it('«لاحقًا» hides it for good; «ابدأ الجولة» starts the client tour', () => {
			url = '/client-overview';
			let f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
			(box(f)!.querySelector('[data-testid=tour-suggestion-no]') as HTMLButtonElement).click(); f.detectChanges();
			expect(box(f)).toBeNull();
			localStorage.removeItem('ws.tour.suggested.v1');
			f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
			(box(f)!.querySelector('[data-testid=tour-suggestion-yes]') as HTMLButtonElement).click();
			expect(TestBed.inject(TourService).tour()?.id).toBe('client-v1');
		});
		it('a visitor never sees the box', () => {
			authed.set(false); role.set(null); url = '/client-overview';
			const f = TestBed.createComponent(TourLauncherComponent); f.detectChanges();
			expect(box(f)).toBeNull();
		});
	});
});
