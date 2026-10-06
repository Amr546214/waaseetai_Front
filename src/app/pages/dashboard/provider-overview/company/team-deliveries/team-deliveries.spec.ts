import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { TeamDeliveries } from './team-deliveries';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';

// Batch 7 regression: this page was 100% hardcoded fiction — 7 fabricated
// deliveries attributed to 3 made-up team members with fake "AI match"
// percentages (94/97/91/99/96/97/94), zero HttpClient anywhere in the file.
// These tests lock in that it now fetches real data via
// ProviderApiService.getCompanyDeliveries() and never renders a fabricated
// team-member roster or AI match score.
describe('TeamDeliveries', () => {
	function setup(apiResponse: any) {
		const providerApiStub: Partial<ProviderApiService> = {
			getCompanyDeliveries: () => of(apiResponse),
		};
		TestBed.configureTestingModule({
			imports: [TeamDeliveries],
			providers: [
				provideRouter([]),
				{ provide: ProviderApiService, useValue: providerApiStub },
			],
		});
		const fixture = TestBed.createComponent(TeamDeliveries);
		fixture.detectChanges();
		return fixture;
	}

	it('has no hardcoded team-member roster and no fabricated aiMatchPct field anywhere on the component', () => {
		const fixture = setup({ success: true, data: [] });
		const component: any = fixture.componentInstance;
		expect(component.members).toBeUndefined();
		expect(component.deliveries().every((d: any) => d.aiMatchPct === undefined)).toBe(true);
	});

	it('renders real backend delivery data with no fabricated team-member names or AI match percentages', () => {
		const fixture = setup({
			success: true,
			data: [
				{
					id: 'd1',
					projectTitle: 'متجر إلكتروني',
					phaseLabel: 'الواجهة الأمامية · المرحلة 2 من 4',
					status: 'SUBMITTED',
					statusLabel: 'بانتظار رد العميل',
					submittedAt: new Date().toISOString(),
					contractRef: 'CT-ABCDEF',
					amountLabel: '3,000 دولار',
					files: ['final.zip'],
					note: 'تم التسليم بالكامل.',
				},
			],
		});
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('متجر إلكتروني');
		expect(text).not.toContain('فهد العتيبي');
		expect(text).not.toContain('ريم الدوسري');
		expect(text).not.toContain('سارة الزهراني');
		expect(text).not.toContain('تطابق AI');
		expect(text).not.toMatch(/\d+٪/);

		// The contract reference only appears in the detail panel, opened by
		// clicking a row's action button — same collapsed-by-default layout
		// the original (pre-Batch-7) table used.
		fixture.componentInstance.openDetail(fixture.componentInstance.deliveries()[0]);
		fixture.detectChanges();
		const detailText = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(detailText).toContain('CT-ABCDEF');
	});

	it('never shows fabricated data when the API call fails — shows an empty list, not fake deliveries', () => {
		const fixture = setup({ success: false, data: [] });
		const component: any = fixture.componentInstance;
		expect(component.deliveries()).toEqual([]);
	});
});
