import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProviderOverview } from './provider-overview';
import { ProviderApiService } from '../../../../core/services/provider-api.service';
import { AuthStore } from '../../../../core/store/auth.store';

// Individual provider dashboard: the completion banner / chip / progress bar follow the real state.
function mount(summary: any) {
	const data = {
		summary: { firstName: 'م', lastName: 'خ', hasApprovedSpecialties: true, pendingOffersCount: 0, currentLevel: 'مستكشف', currentPoints: 5, ...summary },
		topSteps: {}, latestProjects: [], latestProposals: [], aiMatchingProjects: [],
	};
	TestBed.configureTestingModule({
		imports: [ProviderOverview],
		providers: [
			provideRouter([]),
			{ provide: ProviderApiService, useValue: { getOverviewStats: () => of({ success: true, data }) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
		],
	});
	const f = TestBed.createComponent(ProviderOverview);
	f.detectChanges();
	return f.nativeElement as HTMLElement;
}
const setupLinks = (el: HTMLElement) => Array.from(el.querySelectorAll('a[href="/provider-overview/profile/setup"]'));

describe('provider dashboard: completion UI', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('100% + setup done + test done: no banner, no "استكمال البيانات" button/chip, no completion bar', () => {
		const el = mount({ profileCompletionPercent: 100, profileSetupCompleted: true, setupTestCompleted: true });
		expect(el.querySelector('#profile-banner')).toBeNull();
		expect(setupLinks(el).length).toBe(0);
		expect(el.querySelector('[data-testid="level-completion"]')).toBeNull();
		expect(el.textContent).not.toContain('استكمال البيانات');
		expect(el.textContent).not.toContain('اكتمال الملف');
	});

	it('below 100% (60) and setup not finished: banner with the percentage, setup link, and the completion bar', () => {
		const el = mount({ profileCompletionPercent: 60, profileSetupCompleted: false, setupTestCompleted: false });
		expect(el.querySelector('#profile-banner')).not.toBeNull();
		expect(el.textContent).toContain('60%');
		expect(setupLinks(el).length).toBeGreaterThan(0);
		expect(el.querySelector('[data-testid="level-completion"]')).not.toBeNull();
	});

	it('100% completion but the classification test is not done: the banner (and its link) stays, because there is still a step to do', () => {
		const el = mount({ profileCompletionPercent: 100, profileSetupCompleted: true, setupTestCompleted: false });
		expect(el.querySelector('#profile-banner')).not.toBeNull();
		expect(setupLinks(el).length).toBeGreaterThan(0);
		expect(el.querySelector('[data-testid="level-completion"]')).toBeNull();   // the percentage bar itself is hidden at 100
	});

	it('85% with setup + test done: no banner (nothing left in the wizard), the completion bar is shown', () => {
		const el = mount({ profileCompletionPercent: 85, profileSetupCompleted: true, setupTestCompleted: true });
		expect(el.querySelector('#profile-banner')).toBeNull();
		expect(el.querySelector('[data-testid="level-completion"]')).not.toBeNull();
	});
});
