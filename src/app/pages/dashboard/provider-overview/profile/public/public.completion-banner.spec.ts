import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Public } from './public';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { SpecialtyService } from '../../../../../core/services/specialty.service';

// The "ملفي المهني مكتمل X%" banner (with its "استكمل" button) on the provider's own public page: only while the profile is incomplete.
const data = (completionPercentage: number | undefined) => ({
	header: { fullName: 'مزود', isVerified: false, levelInfo: { levelName: 'منجز', points: 60, completionPercentage, missingHint: 'أضف صورة' }, stats: {} },
	basicInfo: { headline: '', bio: '' }, specialties: [], services: [], skills: [], aiMetrics: { averageTestScore: 0, codeMatchingIndex: 0 },
});
async function render(pct: number | undefined, company = false) {
	await TestBed.configureTestingModule({
		imports: [Public],
		providers: [provideRouter([]),
			{ provide: AuthStore, useValue: { currentUser: () => (company ? { accountType: 'PROVIDER_COMPANY' } : { accountType: 'PROVIDER_INDIVIDUAL' }) } },
			{ provide: SpecialtyService, useValue: { getPublicSpecialties: () => of({ success: true, data: [] }) } },
			{ provide: ProviderProfileService, useValue: { getPublicProfile: () => of({ success: true, data: data(pct) }) } }],
	}).compileComponents();
	const f = TestBed.createComponent(Public);
	f.detectChanges();
	return (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
}

describe('provider public page: completion banner', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('below 100%: the banner shows the percentage and the hint', async () => {
		const t = await render(40);
		expect(t).toContain('ملفي المهني مكتمل 40%');
		expect(t).toContain('أضف صورة');
	});
	it('at 100%: no banner and no "مكتمل 100%" claim card', async () => {
		const t = await render(100);
		expect(t).not.toContain('ملفي المهني مكتمل');
	});
	it('an individual provider with an unknown value keeps the previous behaviour', async () => {
		expect(await render(undefined)).toContain('ملفي المهني مكتمل');
	});
});
