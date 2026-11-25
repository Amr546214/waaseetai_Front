import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { TourLauncherComponent } from './tour-launcher';
import { AuthStore } from '../../core/store/auth.store';
import { ClientOnboardingStateService } from '../../core/services/client-onboarding-state.service';
import { UserRole } from '../../core/models/auth.model';

// «جولة في لوحتك» and the first-time suggestion exist only once the client dashboard is open (not while the identity review is pending).
describe('tour launcher + closed client dashboard', () => {
	afterEach(() => TestBed.resetTestingModule());
	async function mount(closed: boolean) {
		TestBed.configureTestingModule({
			imports: [TourLauncherComponent],
			providers: [provideRouter([{ path: '**', children: [] }]), { provide: AuthStore, useValue: { isAuthenticated: () => true, actingRole: () => UserRole.CLIENT, currentUser: () => ({ id: 'u1' }) } }, { provide: ClientOnboardingStateService, useValue: { closed: signal(closed) } }],
		});
		await TestBed.inject(Router).navigateByUrl('/client-overview/review-wait');
		const f = TestBed.createComponent(TourLauncherComponent); f.detectChanges(); await f.whenStable(); f.detectChanges();
		return f.nativeElement as HTMLElement;
	}
	it('closed: no chip and no suggestion', async () => {
		const el = await mount(true);
		expect(el.querySelector('[data-testid="tour-launcher"]')).toBeNull(); expect(el.querySelector('[data-testid="tour-suggestion"]')).toBeNull();
	});
	it('open: no standing chip; the one-time box shows and closes by itself after 5 seconds', async () => {
		vi.useFakeTimers();
		try {
			const el = await mount(false);
			expect(el.querySelector('[data-testid="tour-launcher"]')).toBeNull(); expect(el.querySelector('[data-testid="tour-suggestion"]')).toBeTruthy();
		} finally { vi.useRealTimers(); }
	});
});
