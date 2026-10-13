import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { Profile } from './profile';
import { ProfileApiService } from '../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../core/store/auth.store';

// The profile header used to show a fixed 4-star row, a fallback "4.8 (32 تقييم)", a "verified" tick for everybody, "last activity: today",
// a fixed GMT+3, a fixed country and always-empty links. Everything now comes from the saved profile or says there is nothing yet.
function mount(data: any) {
	TestBed.configureTestingModule({
		imports: [Profile],
		providers: [
			provideRouter([]),
			{ provide: ProfileApiService, useValue: { getMyProfile: () => of({ success: true, data: { currentProfileData: { firstName: 'نورة', lastName: 'ق', ...data } } }) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ firstName: 'نورة', lastName: 'ق', accountType: 'CLIENT_INDIVIDUAL' }), token: () => 't', authenticate: () => {} } },
		],
	});
	const fixture = TestBed.createComponent(Profile);
	fixture.detectChanges();
	return fixture;
}
const text = (f: any) => (f.nativeElement as HTMLElement).textContent || '';

describe('client profile page — real data only', () => {
	it('no reviews yet: no stars, no 4.8, no 32 — an honest empty line; the stat cell shows a dash', () => {
		const f = mount({ humanRating: null, reviewsCount: 0 });
		const el = f.nativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="profile-rating"]')).toBeNull();
		expect(el.querySelector('[data-testid="profile-rating-empty"]')?.textContent).toContain('لا توجد تقييمات من مقدمي الخدمة بعد');
		expect(text(f)).not.toContain('4.8');
		expect(text(f)).not.toContain('32 تقييم');
	});

	it('with reviews: the real average and count, and as many filled stars as the rounded average', () => {
		const f = mount({ humanRating: 4.3, reviewsCount: 7, totalRequests: 5, completedProjects: 2 });
		const el = f.nativeElement as HTMLElement;
		const box = el.querySelector('[data-testid="profile-rating"]')!;
		expect(box.textContent).toContain('4.3');
		expect(box.textContent).toContain('(7 تقييم)');
		expect(box.querySelectorAll('svg.txt-kahr').length).toBe(4);
		const nums = Array.from(el.querySelectorAll('.stats-grid .stat-num')).map(n => n.textContent?.trim());
		expect(nums).toEqual(['5', '2', '4.3', '7']);
	});

	it('"verified" only for an approved identity review; no "last activity: today"; no fixed country or timezone', () => {
		let f = mount({ kycStatus: 'UNVERIFIED', city: 'جدة', timezone: null, country: null });
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="profile-verified"]')).toBeNull();
		expect(text(f)).not.toContain('آخر نشاط: اليوم');
		expect(text(f)).not.toContain('المملكة العربية السعودية');
		expect(text(f)).not.toContain('GMT+3');
		TestBed.resetTestingModule();
		f = mount({ kycStatus: 'VERIFIED', city: 'جدة', country: 'السعودية', timezone: '(GMT+4) توقيت دبي' });
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="profile-verified"]')?.textContent).toContain('هوية موثّقة');
		expect(text(f)).toContain('جدة، السعودية');
		expect(text(f)).toContain('(GMT+4) توقيت دبي');
	});

	it('the saved personal links are shown (website, LinkedIn, portfolio) instead of a permanent "not added"', () => {
		const f = mount({ linkedinUrl: 'https://linkedin.com/in/nora', portfolioUrl: 'https://p.example.com', personalWebsiteUrl: 'https://nora.example.com' });
		f.componentInstance.switchTab('links');
		f.detectChanges();
		const hrefs = Array.from((f.nativeElement as HTMLElement).querySelectorAll('a.link')).map(a => a.getAttribute('href'));
		expect(hrefs).toEqual(['https://nora.example.com', 'https://linkedin.com/in/nora', 'https://p.example.com']);
		expect(text(f)).not.toContain('GitHub');
	});
});
