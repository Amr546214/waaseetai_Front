import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { IdentityGateService, IdentityGateStatus } from '../../../../../core/services/identity-gate.service';
import { FakeIdentityGate } from '../../../../../core/services/identity-gate.testing';

// Identity gate (replaces the old pending-note spec): the identity step shows the owner's review state in place, «الوثيقة قيد المراجعة» while under review.
describe('client profile-setup: identity gate status in the identity step', () => {
	let fixture: ComponentFixture<ProfileSetupDashboard>;
	const setup = (status: IdentityGateStatus, reason: string | null = null) => {
		FakeIdentityGate.reset(status); FakeIdentityGate.reason = reason;
		TestBed.configureTestingModule({ imports: [ProfileSetupDashboard], providers: [
			provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
			{ provide: AuthStore, useValue: { currentUser: () => null } },
			{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data: {} }), saveClientProfileSetup: vi.fn(), saveClientSetupStep: vi.fn(() => of({ success: true, data: {} })) } },
		] });
		TestBed.overrideComponent(ProfileSetupDashboard, { set: { providers: [{ provide: IdentityGateService, useClass: FakeIdentityGate }] } });
		fixture = TestBed.createComponent(ProfileSetupDashboard);
		fixture.detectChanges(); fixture.componentInstance.currentStep.set(2);
		fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); fixture.detectChanges();
	};
	const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
	const next = () => (fixture.nativeElement as HTMLElement).querySelector('[data-testid="setup-submit"]') as HTMLButtonElement; // the identity page is the last one: its button is the final send
	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('UNDER_REVIEW: «الوثيقة قيد المراجعة» in place, the document is on file so the send is open, nothing about field matching', () => {
		setup('UNDER_REVIEW');
		expect(q('identity-gate-under-review')?.textContent).toContain('الوثيقة قيد المراجعة');
		expect(q('identity-gate-under-review')?.textContent).not.toMatch(/MATCH|مطابق/);
		expect(next().disabled).toBe(false);
		expect(fixture.componentInstance.currentStep()).toBe(2);
	});
	it('a full CURRENT field match shows the matched note while KYC stays under review', () => {
		setup('UNDER_REVIEW'); FakeIdentityGate.automaticCheck = 'MATCHED';
		fixture.componentInstance.gate.load().subscribe(); fixture.detectChanges();
		expect(q('identity-gate-matched')?.textContent).toContain('إرسال للمراجعة');
		expect(fixture.componentInstance.gate.status()).toBe('UNDER_REVIEW');
		expect(next().disabled).toBe(false);
	});

	it('REJECTED: the reason shows beside the upload and the data is still in the form', () => {
		setup('REJECTED', 'الصورة غير واضحة');
		fixture.componentInstance.setupForm.get('details.idNumber')!.setValue('A123456');
		fixture.detectChanges();
		expect(q('identity-gate-reason')?.textContent).toContain('الصورة غير واضحة');
		expect(fixture.componentInstance.setupForm.get('details.idNumber')!.value).toBe('A123456');
		expect(next().disabled).toBe(true);
	});
	it('NOT_SUBMITTED: asks for the document and the send stays closed; APPROVED: the send is open', () => {
		setup('NOT_SUBMITTED');
		expect(q('identity-gate-not-submitted')).not.toBeNull(); expect(next().disabled).toBe(true);
		fixture.destroy(); TestBed.resetTestingModule();
		setup('APPROVED');
		expect(q('identity-gate-approved')).not.toBeNull(); expect(next().disabled).toBe(false);
	});
});
