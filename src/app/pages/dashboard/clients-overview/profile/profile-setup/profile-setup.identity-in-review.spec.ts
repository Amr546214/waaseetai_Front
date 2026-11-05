import { ChangeDetectorRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { IdentityCheckService } from '../../../../../core/services/identity-check.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Neutral owner state of the automatic ID check (test double of the backend contract; proves wiring only).
describe('client profile-setup: «الهوية قيد الفحص»', () => {
	let fixture: ComponentFixture<ProfileSetupDashboard>;
	const setup = (data: any, mine: any) => {
		const getMyState = vi.fn(() => mine);
		TestBed.configureTestingModule({ imports: [ProfileSetupDashboard], providers: [
			provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
			{ provide: AuthStore, useValue: { currentUser: () => null } },
			{ provide: IdentityCheckService, useValue: { getMyState } },
			{ provide: ProfileApiService, useValue: { getClientProfileSetup: () => of({ data }), saveClientProfileSetup: vi.fn(), saveClientSetupStep: vi.fn(() => of({ success: true, data: {} })) } },
		] });
		fixture = TestBed.createComponent(ProfileSetupDashboard);
		fixture.detectChanges(); fixture.componentInstance.currentStep.set(2);
		fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges();
		return getMyState;
	};
	const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('pending identity + IN_REVIEW: the pending note says «الهوية قيد الفحص» for the CLIENT party and shows no field result', () => {
		const g = setup({ kycStatus: 'PENDING' }, of('IN_REVIEW'));
		expect(g).toHaveBeenCalledWith('CLIENT');
		expect(q('identity-in-review')?.textContent).toContain('الهوية قيد الفحص');
		expect(q('kyc-pending-note')?.textContent).not.toMatch(/MATCH|مطابق/);
	});
	it('NONE or an old backend (error): the existing pending note stays, silently', () => {
		setup({ kycStatus: 'PENDING' }, of('NONE')); expect(q('identity-in-review')).toBeNull(); expect(q('kyc-pending-note')).not.toBeNull();
		fixture.destroy(); TestBed.resetTestingModule();
		setup({ kycStatus: 'PENDING' }, throwError(() => ({ status: 404 }))); expect(q('identity-in-review')).toBeNull(); expect(q('kyc-pending-note')).not.toBeNull();
	});
	it('no pending identity: the endpoint is not even called', () => {
		const g = setup({ kycStatus: 'UNVERIFIED' }, of('IN_REVIEW')); expect(g).not.toHaveBeenCalled(); expect(q('identity-in-review')).toBeNull();
	});
});
