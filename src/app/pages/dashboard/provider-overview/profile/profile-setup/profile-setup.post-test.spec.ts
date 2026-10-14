import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService } from '../../../../../core/services/setup-test.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ProviderAccessService } from '../../../../../core/services/provider-access.service';

describe('setup wizard: after the step-7 test', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('finishing the test goes to the status page (never the dashboard) and forgets the last access answer', () => {
		const invalidate = vi.fn();
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [
				provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
				{ provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data: {} }), saveProviderProfileSetup: vi.fn(() => of({ success: true })) } },
				{ provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: [] }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
				{ provide: SetupTestService, useValue: { warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), disconnect: vi.fn(), startTest: vi.fn() } },
				{ provide: ProviderAccessService, useValue: { invalidate } },
			],
		});
		const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		const f = TestBed.createComponent(ProfileSetupDashboard);
		f.detectChanges();
		f.componentInstance.finishTestProcess();
		expect(nav).toHaveBeenCalledWith('/provider-overview/accreditation-status');
		expect(navigate).not.toHaveBeenCalledWith(['/provider-overview']);
		expect(invalidate).toHaveBeenCalled();
	});
});
