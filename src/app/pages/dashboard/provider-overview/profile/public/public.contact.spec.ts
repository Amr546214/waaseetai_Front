import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Public } from './public';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { SpecialtyService } from '../../../../../core/services/specialty.service';

// The owner's public-profile preview shows the contact details stored on the account (the same data as the profile data page): email and the phone merged with its code.
// A visitor never gets them, and the page says that on purpose instead of an unexplained dash.
const base = (o: any = {}) => ({
	header: { fullName: 'مزود اختبار', isVerified: false, levelInfo: { levelName: 'منجز', points: 60, completionPercentage: 40, missingHint: 'x' }, stats: { completedProjects: 0, publishedServices: 0, reviewsCount: 0, portfolioCount: 0, clientRating: 0 } },
	basicInfo: { headline: '', bio: '' }, specialties: [], services: [], skills: [], aiMetrics: { averageTestScore: 0, codeMatchingIndex: 0 }, ...o,
});
const OWNER = (c: any = {}) => base({ contactVisibility: 'OWNER_ONLY', contact: { email: 'sara@example.com', phone: { countryCode: '+20', nationalNumber: '1025073026', display: '+20 1025073026', consistent: true }, pendingChange: null, ...c } });

async function render(d: any) {
	await TestBed.configureTestingModule({
		imports: [Public],
		providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => null } },
			{ provide: SpecialtyService, useValue: { getPublicSpecialties: () => of({ success: true, data: [] }) } },
			{ provide: ProviderProfileService, useValue: { getPublicProfile: () => of({ success: true, data: d }) } }],
	}).compileComponents();
	const f = TestBed.createComponent(Public);
	f.detectChanges();
	return f;
}
const q = (f: any, s: string) => (f.nativeElement as HTMLElement).querySelector(s) as HTMLElement | null;

describe('provider public profile: contact details', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('owner view shows the stored email and the phone merged with its code (+20 1025073026), never "-"', async () => {
		const f = await render(OWNER());
		expect(q(f, '[data-testid="public-email"]')!.textContent!.trim()).toBe('sara@example.com');
		expect(q(f, '[data-testid="public-phone"]')!.textContent!.trim()).toBe('+20 1025073026');
		expect(q(f, '[data-testid="public-phone-pending"]')).toBeNull();
	});

	it('owner view: a saved Saudi number is shown as +966 501234567', async () => {
		const f = await render(OWNER({ phone: { countryCode: '+966', nationalNumber: '501234567', display: '+966 501234567', consistent: true } }));
		expect(q(f, '[data-testid="public-phone"]')!.textContent!.trim()).toBe('+966 501234567');
	});

	it('owner view with no phone saved says "لم يُضف بعد" (an explicit state), not a bare dash', async () => {
		const f = await render(OWNER({ phone: { countryCode: '+966', nationalNumber: '', display: '', consistent: true } }));
		expect(q(f, '[data-testid="public-phone"]')!.textContent!.trim()).toBe('لم يُضف بعد');
	});

	it('owner view: a phone change waiting for its code is stated, and the current value is still shown', async () => {
		const f = await render(OWNER({ pendingChange: { status: 'PENDING_OTP', requestedAt: '2026-10-11T08:00:00Z' } }));
		expect(q(f, '[data-testid="public-phone-pending"]')!.textContent).toContain('بانتظار تأكيد الرمز');
		expect(q(f, '[data-testid="public-phone"]')!.textContent!.trim()).toBe('+20 1025073026');
	});

	it('visitor view (contact = null, HIDDEN_FROM_VISITORS): the hiding is stated and no email or phone appears', async () => {
		const f = await render(base({ contact: null, contactVisibility: 'HIDDEN_FROM_VISITORS' }));
		expect(q(f, '[data-testid="public-email"]')!.textContent!.trim()).toBe('مخفي عن الزوار');
		expect(q(f, '[data-testid="public-phone"]')!.textContent!.trim()).toBe('مخفي عن الزوار');
		expect((f.nativeElement as HTMLElement).textContent).not.toContain('sara@example.com');
	});
});
