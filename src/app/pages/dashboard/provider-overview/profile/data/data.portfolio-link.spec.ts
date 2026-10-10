import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Data } from './data';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// The "معرض الأعمال" completion item (+10%) is fixed by ONE field on the profile tab: «رابط معرض الأعمال» (websiteUrl). The item opens and focuses it,
// and saving a link removes the item from the missing list.
const BASE = {
	headline: 'مصمم', mainSpecialty: 'تصميم', bio: 'x'.repeat(60), country: 'السعودية', city: 'الرياض', location: '', hourlyRate: null, yearsOfExperience: null,
	user: { firstName: 'أحمد', lastName: 'علي', email: 'a@b.co', phoneNumber: '+966501234567', alternativePhone: '', idDocumentUrl: null },
	certUrls: [], skills: [{ name: 'Figma' }], portfolioItems: [], languages: [], paypalPayoutEmail: 'me@paypal.example',
};
const MISSING = { ...BASE, websiteUrl: null, completionPercentage: 80, missingItems: [{ key: 'portfolio', label: 'معرض الأعمال', points: 10, status: 'missing', tab: 'profile', hint: 'أضف رابط معرض أعمالك (Behance أو GitHub أو موقعك الشخصي) في قسم «الروابط الشخصية»' }] };
const DONE = { ...BASE, websiteUrl: 'https://www.behance.net/ahmad', completionPercentage: 90, missingItems: [] };

describe('provider data page: portfolio link completion item', () => {
	let fixture: ComponentFixture<Data>;
	let component: Data;
	let profile: any;
	let updateBasicInfo: ReturnType<typeof vi.fn>;
	const el = () => fixture.nativeElement as HTMLElement;
	const q = (s: string) => el().querySelector(s) as HTMLElement | null;
	const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };

	beforeEach(() => {
		profile = MISSING;
		updateBasicInfo = vi.fn(() => { profile = DONE; return of({}); });
		TestBed.configureTestingModule({
			imports: [Data],
			providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => null } },
				{ provide: ProviderProfileService, useValue: {
					getProfile: () => of(profile), getActiveSessions: vi.fn(() => of({ data: [] })), getChangeRequests: vi.fn(() => of([])), updateBasicInfo,
					requestPaypalEmailChange: vi.fn(), confirmPaypalEmailChange: vi.fn(),
				} }],
		});
		fixture = TestBed.createComponent(Data); component = fixture.componentInstance;
		document.body.appendChild(el());
		fixture.detectChanges(); render();
	});
	afterEach(() => { el().remove(); fixture?.destroy(); TestBed.resetTestingModule(); });

	it('the profile tab has a clear field «رابط معرض الأعمال» for Behance / GitHub / a personal site', () => {
		const label = q('label[for="portfolio-url"]')!;
		expect(label.textContent).toContain('رابط معرض الأعمال');
		expect(q('[data-testid="portfolio-url-hint"]')!.textContent).toContain('Behance');
		expect(q('[data-testid="portfolio-url-hint"]')!.textContent).toContain('GitHub');
		expect(q('#portfolio-url')!.getAttribute('type')).toBe('url');
		expect(q('.form-card-sub')!.parentElement!.textContent).toBeTruthy();
		expect(el().textContent).toContain('إضافة رابط معرض الأعمال تكمل 10% من اكتمال الملف');
	});

	it('the completion item names where to add it and clicking it opens the profile tab and focuses the portfolio field', () => {
		const item = q('.miss-item[data-key="portfolio"]')!;
		expect(item.textContent).toContain('معرض الأعمال');
		expect(item.textContent).toContain('«الروابط الشخصية»');
		expect(item.textContent).toContain('+10%');
		component.setTab('contact'); render();
		vi.useFakeTimers();
		(item.querySelector('.miss-link') as HTMLButtonElement).click();
		vi.advanceTimersByTime(60); vi.useRealTimers();
		expect(component.currentTab()).toBe('profile');
		expect(document.activeElement?.id).toBe('portfolio-url');
	});

	it('saving a valid link sends websiteUrl and the item disappears (80% -> 90%, nothing missing)', () => {
		component.profileForm.patchValue({ websiteUrl: 'https://www.behance.net/ahmad' });
		component.saveProfile(); render();
		expect(updateBasicInfo).toHaveBeenCalledTimes(1);
		expect((updateBasicInfo.mock.calls[0] as any[])[0].websiteUrl).toBe('https://www.behance.net/ahmad');
		expect(q('.miss-item[data-key="portfolio"]')).toBeNull();
		expect(q('#prog-pct')!.textContent).toContain('90%');
	});

	it('a link that is not http(s) is refused inline and nothing is sent', () => {
		component.profileForm.patchValue({ websiteUrl: 'behance' });
		component.saveProfile(); render();
		expect(updateBasicInfo).not.toHaveBeenCalled();
		expect(component.profileForm.get('websiteUrl')!.invalid).toBe(true);
	});
});
