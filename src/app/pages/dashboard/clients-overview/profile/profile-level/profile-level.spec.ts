import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileLevel } from './profile-level';
import { GamificationService } from '../../../../../core/services/gamification.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Batch 7 regression: this page used to call the PROVIDER-only
// /provider/gamification/level-details endpoint from a CLIENT dashboard
// page. Every client request 403'd, and the component silently rendered a
// fully hardcoded demo roadmap/points/aiRecommendation as if it were the
// user's real progression. These tests lock in the fix: on any non-success
// response or error, the component must show an honest "unavailable" state
// and never fabricate progression data.
describe('ProfileLevel (client)', () => {
	let isInitialized$: BehaviorSubject<boolean>;

	function setup(gamificationServiceStub: Partial<GamificationService>) {
		isInitialized$ = new BehaviorSubject<boolean>(false);
		TestBed.configureTestingModule({
			imports: [ProfileLevel],
			providers: [
				{ provide: GamificationService, useValue: gamificationServiceStub },
				{ provide: AuthStore, useValue: { isInitialized$ } },
				{ provide: PLATFORM_ID, useValue: 'browser' }
			]
		});
		const fixture = TestBed.createComponent(ProfileLevel);
		return fixture;
	}

	it('renders the real backend data on success', () => {
		const fakeData = {
			currentStats: { points: 10, completedProjects: 1, avgRating: 5, commissionRate: 15 },
			currentLevel: { index: 1, title: 'زائر' },
			nextLevelProgress: { title: 'مستكشف', pointsGap: 41, projectsGap: 1, ratingGap: 0, pointsPercent: 20, projectsPercent: 50, ratingPercent: 100, nextCommission: 14 },
			aiRecommendation: '',
			roadmap: [],
			pointRules: { gainRules: [], lossRules: [] }
		};
		const fixture = setup({ getLevelDetails: () => of({ success: true, data: fakeData }) });
		fixture.detectChanges();
		isInitialized$.next(true);

		const component = fixture.componentInstance;
		expect(component.levelData()).toEqual(fakeData);
		expect(component.loadError()).toBe(false);
		expect(component.isLoading()).toBe(false);
	});

	it('never fabricates demo progression data on a 403/failed response — shows honest unavailable state instead', () => {
		const fixture = setup({ getLevelDetails: () => of({ success: false, data: undefined as any }) });
		fixture.detectChanges();
		isInitialized$.next(true);

		const component = fixture.componentInstance;
		expect(component.levelData()).toBeNull();
		expect(component.loadError()).toBe(true);
		expect(component.isLoading()).toBe(false);
	});

	it('never fabricates demo progression data on an HTTP error — shows honest unavailable state instead', () => {
		const fixture = setup({ getLevelDetails: () => throwError(() => ({ status: 403 })) });
		fixture.detectChanges();
		isInitialized$.next(true);

		const component = fixture.componentInstance;
		expect(component.levelData()).toBeNull();
		expect(component.loadError()).toBe(true);
		expect(component.isLoading()).toBe(false);
	});

	it('the rendered template shows an honest unavailable message, not a fabricated roadmap, after a failure', () => {
		const fixture = setup({ getLevelDetails: () => throwError(() => ({ status: 403 })) });
		fixture.detectChanges();
		isInitialized$.next(true);
		fixture.detectChanges();

		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('غير متاح لحسابات العملاء');
		expect(text).not.toContain('توصية الذكاء');
		expect(text).not.toContain('302');
	});
});
