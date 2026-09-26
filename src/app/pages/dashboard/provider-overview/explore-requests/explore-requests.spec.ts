import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { ExploreRequests } from './explore-requests';
import { ProviderApiService } from '../../../../core/services/provider-api.service';

// Batch 7 regression: this page previously showed a fully fictional
// "company mode" for PROVIDER_COMPANY accounts — a hardcoded team-member
// roster with fake per-member "AI match" percentages (companyTeamMembers:
// فهد العتيبي 94%, ريم الدوسري 78%, ...), fabricated tab counts
// (companyTabs: 47/34/9/4, unrelated to the real backend counts), and a
// static "47 طلب متاح — 91% متوسط تطابق الفريق" stats bar hardcoded
// directly in the template. There is no team-member/company-employee model
// anywhere in the backend, so none of it could ever be real. It has been
// removed entirely — company accounts now get the same real,
// fully-connected experience as individual providers.
describe('ExploreRequests', () => {
	function setup(responseData: any = { projects: [], counts: { all: 0, notApplied: 0, applied: 0, saved: 0 }, providerSpecialties: [] }) {
		const providerApiStub: Partial<ProviderApiService> = {
			getExploreRequests: () => of({ success: true, data: responseData }),
			toggleSaveRequest: () => of({ success: true, data: { isSaved: true, savedCount: 1 } }),
			analyzeProjectWithAi: () => of({ success: false }),
		};
		TestBed.configureTestingModule({
			imports: [ExploreRequests],
			providers: [
				provideRouter([]),
				{ provide: ProviderApiService, useValue: providerApiStub },
			],
		});
		const fixture = TestBed.createComponent(ExploreRequests);
		fixture.detectChanges();
		return fixture;
	}

	it('has no fabricated company team-member roster or AI match percentages', () => {
		const fixture = setup();
		const component: any = fixture.componentInstance;
		expect(component.companyTeamMembers).toBeUndefined();
		expect(component.companyTabs).toBeUndefined();
		expect(component.isCompanyMode).toBeUndefined();
	});

	it('never renders the removed fictional company stats bar or fake candidate chips', () => {
		const fixture = setup({
			projects: [{ id: 'p1', title: 'مشروع', description: 'وصف', category: 'ويب', durationDays: 5, proposalsCount: 2, createdAtFormatted: 'اليوم', clientType: 'فرد', aiMatchScore: 90, isSaved: false, hasApplied: false }],
			counts: { all: 1, notApplied: 1, applied: 0, saved: 0 },
			providerSpecialties: [],
		});
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('مرشحو AI');
		expect(text).not.toContain('فهد العتيبي');
		expect(text).not.toContain('متوسط تطابق الفريق');
		expect(text).not.toContain('إدارة الإسناد');
		expect(text).not.toContain('لم يُسند');
	});
});
