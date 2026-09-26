import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { SaRiskCenter } from './sa-risk-center';
import { AdminSecurityApiService } from '../../../../core/services/admin-security-api.service';

// Implementation Batch 7 — this page used to be entirely fictional: hardcoded
// "risk scores" (89/76/62) attributed to invented fraud accusations on
// real-sounding names, a fake "fraud patterns" list, a fake live "3
// accounts on the same device" alert, and a client-side-only "blocked IPs"
// list. These tests lock in that it now shows only real suspended accounts
// and their real open-dispute counts — no fabricated score, pattern, or IP.
describe('SaRiskCenter', () => {
	function setup(accounts: any[]) {
		const apiStub: Partial<AdminSecurityApiService> = {
			getFlaggedAccounts: () => of({ success: true, data: accounts }),
		};
		TestBed.configureTestingModule({
			imports: [SaRiskCenter],
			providers: [{ provide: AdminSecurityApiService, useValue: apiStub }],
		});
		const fixture = TestBed.createComponent(SaRiskCenter);
		fixture.detectChanges();
		return fixture;
	}

	it('has no fabricated risk score, fraud pattern, or blocked-IP state on the component', () => {
		const fixture = setup([]);
		const component: any = fixture.componentInstance;
		expect(component.fraudPatterns).toBeUndefined();
		expect(component.blockedIps).toBeUndefined();
		expect(component.riskAccounts).toBeUndefined();
	});

	it('never renders the old fabricated names, scores, or fraud patterns', () => {
		const fixture = setup([]);
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('عبدالرحمن الدوسري');
		expect(text).not.toContain('احتيال مالي');
		expect(text).not.toContain('شبكة حسابات متعددة');
		expect(text).not.toContain('IP Blacklist');
	});

	it('renders a real suspended account with its real open-dispute counts', () => {
		const fixture = setup([
			{ userId: 'u1', name: 'خالد العتيبي', accountType: 'PROVIDER_INDIVIDUAL', status: 'SUSPENDED', openDisputesAgainst: 2, openDisputesOpened: 0 },
		]);
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('خالد العتيبي');
		expect(text).toContain('2 نزاع مفتوح ضده');
	});

	it('shows an honest empty state, not fabricated accounts, when no one is suspended', () => {
		const fixture = setup([]);
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('لا توجد حسابات موقوفة حالياً');
	});
});
