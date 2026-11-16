import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AccountLogsService } from '../../../../core/services/account-logs.service';
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

describe('client profile page — interests tab', () => {
	it('shows the saved interests on the الاهتمامات tab', () => {
		const f = mount({ interests: ['تصميم', 'برمجة'] });
		(f.componentInstance as any).switchTab('interests');
		f.detectChanges();
		const tags = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.skill-tag')).map(t => t.textContent?.trim());
		expect(tags).toEqual(['تصميم', 'برمجة']);
	});

	it('an empty skills list in the payload never hides the saved interests', () => {
		const f = mount({ skills: [], interests: ['تصميم'] });
		(f.componentInstance as any).switchTab('interests');
		f.detectChanges();
		expect(Array.from((f.nativeElement as HTMLElement).querySelectorAll('.skill-tag')).map(t => t.textContent?.trim())).toEqual(['تصميم']);
	});
});

describe('client profile page — activity tab (real audit log)', () => {
	function mountWithLogs(getUserLogs: () => any) {
		TestBed.configureTestingModule({
			imports: [Profile],
			providers: [
				provideRouter([]),
				{ provide: ProfileApiService, useValue: { getMyProfile: () => of({ success: true, data: { currentProfileData: { firstName: 'نورة', lastName: 'ق' } } }) } },
				{ provide: AccountLogsService, useValue: { getUserLogs } },
				{ provide: AuthStore, useValue: { currentUser: () => ({ firstName: 'نورة', lastName: 'ق', accountType: 'CLIENT_INDIVIDUAL' }), token: () => 't', authenticate: () => {} } },
			],
		});
		const f = TestBed.createComponent(Profile);
		f.detectChanges();
		return f;
	}
	const open = (f: any) => { f.componentInstance.switchTab('activity'); f.detectChanges(); };

	it('opening the tab loads the latest log entries and lists them with a link to the full log', () => {
		const getUserLogs = vi.fn(() => of({ success: true, data: { items: [{ id: 'l1', title: 'تغيير كلمة المرور', summary: 'تم طلب تغيير كلمة المرور', statusText: 'مكتمل', createdAt: '2026-11-15T10:30:00Z' }, { id: 'l2', title: 'تحديث الملف', createdAt: '2026-11-14T08:00:00Z' }] } }));
		const f = mountWithLogs(getUserLogs);
		expect(getUserLogs).not.toHaveBeenCalled();
		open(f);
		expect(getUserLogs).toHaveBeenCalledWith({ limit: 8 });
		const rows = (f.nativeElement as HTMLElement).querySelectorAll('[data-testid="activity-row"]');
		expect(rows.length).toBe(2);
		expect(rows[0].textContent).toContain('تم طلب تغيير كلمة المرور');
		expect(rows[0].textContent).toContain('مكتمل');
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="activity-all"]')?.getAttribute('href')).toBe('/client-overview/profile/logs');
	});

	it('no entries: the honest empty line; a failure: an error with retry (never a fake empty)', () => {
		let f = mountWithLogs(() => of({ success: true, data: { items: [] } }));
		open(f);
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="activity-empty"]')).toBeTruthy();
		TestBed.resetTestingModule();
		f = mountWithLogs(() => throwError(() => new Error('x')));
		open(f);
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="activity-error"]')).toBeTruthy();
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="activity-empty"]')).toBeNull();
	});

	it('the log is read once per visit, not on every tab click', () => {
		const getUserLogs = vi.fn(() => of({ success: true, data: { items: [{ id: 'l1', title: 'حدث', createdAt: '2026-11-15T10:30:00Z' }] } }));
		const f = mountWithLogs(getUserLogs);
		open(f); open(f);
		expect(getUserLogs).toHaveBeenCalledTimes(1);
	});
});
