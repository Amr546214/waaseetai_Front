import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';

const FULL = { idNumber: '2000000001', dob: '1990-01-01T00:00:00.000Z', country: 'السعودية', city: 'الرياض', industry: 'مهندس', address: 'شارع 1', paypalPayoutEmail: 'p@x.co', accurateAgreed: false, termsAgreed: false, privacyAgreed: false, completionPercentage: 70 };

// Final submit vs. step completion: a required field that is missing must show up as an incomplete step, send the user back to it with the
// field's own message, and never be hidden behind a "مكتمل" badge or a generic message.
describe('client setup: final submit and step completion agree', () => {
	let fixture: ComponentFixture<ProfileSetupDashboard>;
	let c: ProfileSetupDashboard;
	let saveFinal: ReturnType<typeof vi.fn>;
	let saveStep: ReturnType<typeof vi.fn>;

	function mount(data: any) {
		saveFinal = vi.fn(() => of({ success: true }));
		saveStep = vi.fn(() => of({ success: true, data: {} }));
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [
				provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }), token: () => 't', authenticate: vi.fn() } },
				{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data }), saveClientProfileSetup: saveFinal, saveClientSetupStep: saveStep } },
			],
		});
		fixture = TestBed.createComponent(ProfileSetupDashboard);
		c = fixture.componentInstance;
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}
	const agree = () => c.setupForm.get('agreements')!.patchValue({ accurate: true, terms: true, privacy: true });
	afterEach(() => TestBed.resetTestingModule());

	it('final submit with the country missing sends nothing, goes back to step 1 and names the field (its own message, not only a toast)', () => {
		const el = mount(FULL);
		c.setupForm.get('details.country')!.setValue('');
		agree();
		c.currentStep.set(5); fixture.detectChanges();
		c.submitForm(); fixture.detectChanges();
		expect(saveFinal).not.toHaveBeenCalled();
		expect(c.currentStep()).toBe(1);
		expect(c.missing().some(m => m.path === 'details.country' && m.label === 'الدولة' && !!m.message)).toBe(true);
		const summary = el.querySelector('[data-testid=form-summary]');
		expect(summary?.textContent).toContain('الدولة');
		expect(el.querySelector('[formcontrolname=country] ~ [data-testid=field-error], [data-testid=field-error]')?.textContent?.length).toBeGreaterThan(0);
		expect(c.setupForm.get('details.country')!.touched).toBe(true);
	});

	it('date of birth is REQUIRED (the identity data is checked against it); city, occupation and address stay optional', () => {
		mount({ ...FULL, dob: null, city: '', industry: '', address: '' });
		agree();
		c.currentStep.set(5); fixture.detectChanges();
		expect(c.stepIsIncomplete(1)).toBe(true);
		c.submitForm();
		expect(saveFinal).not.toHaveBeenCalled();
		expect(c.missing().some(m => m.path === 'details.dob')).toBe(true);
	});

	it('with the date of birth filled, city, occupation and address can stay empty', () => {
		mount({ ...FULL, city: '', industry: '', address: '' });
		agree();
		c.currentStep.set(5); fixture.detectChanges();
		expect(c.stepIsIncomplete(1)).toBe(false);
		c.submitForm();
		expect(saveFinal).toHaveBeenCalledTimes(1);
		const d = saveFinal.mock.calls[0][0].details;
		expect(d.dob).toBeTruthy(); expect(d.city).toBe(''); expect(d.occupation).toBe(''); expect(d.address).toBe('');
	});

	it('final submit succeeds when every required field is present', () => {
		mount(FULL);
		agree();
		c.currentStep.set(5); fixture.detectChanges();
		c.submitForm();
		expect(saveFinal).toHaveBeenCalledTimes(1);
		expect(saveFinal.mock.calls[0][0].details.address).toBe('شارع 1');
		expect(saveFinal.mock.calls[0][0].agreements).toEqual({ accurate: true, terms: true, privacy: true });
	});

	it('after a refresh, an account whose country is missing opens on step 1, not on the review', () => {
		mount({ ...FULL, country: '', completionPercentage: 50 });
		expect(c.currentStep()).toBe(1);
	});

	it('the old generic "الرجاء التأكد من تعبئة جميع الحقول المطلوبة" message is not in the wizard any more', async () => {
		const { readFileSync } = await import('node:fs');
		const { join } = await import('node:path');
		const src = readFileSync(join(__dirname, 'profile-setup.ts'), 'utf8') + readFileSync(join(__dirname, 'profile-setup.html'), 'utf8');
		expect(src).not.toContain('الرجاء التأكد من تعبئة جميع الحقول المطلوبة');
	});
});
