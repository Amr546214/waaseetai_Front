import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { Subject } from 'rxjs';
import { describe, it, expect, vi } from 'vitest';
import { SaRiskCenter } from './sa-risk-center';
import { AdminSecurityApiService } from '../../../../core/services/admin-security-api.service';

// Implementation Batch 7 — this page used to be entirely fictional: hardcoded
// "risk scores" (89/76/62) attributed to invented fraud accusations on
// real-sounding names, a fake "fraud patterns" list, a fake live "3
// accounts on the same device" alert, and a client-side-only "blocked IPs"
// list. These tests lock in that it now shows only real suspended accounts
// and their real open-dispute counts — no fabricated score, pattern, or IP.
describe('SaRiskCenter', () => {
	function setup(accounts: any[], allowed = false, confirmed = true, result: any = of({success:true,data:{id:"u1",status:"ACTIVE"}})) {
		const apiStub: Partial<AdminSecurityApiService> = {
			getFlaggedAccounts: () => of({ success: true, data: accounts }), reactivateAccount: vi.fn(() => result),
		};
		TestBed.configureTestingModule({
			imports: [SaRiskCenter],
			providers: [provideRouter([]), { provide: AdminSecurityApiService, useValue: apiStub }, {provide:AdminAccessService,useValue:{can:()=>allowed}}, {provide:ConfirmModalService,useValue:{confirm:vi.fn(async()=>confirmed)}}],
		});
		const fixture = TestBed.createComponent(SaRiskCenter);
		fixture.detectChanges();
		(fixture as any).api = apiStub; return fixture;
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

	it('shows an error state (not the empty state) when the request fails', () => {
		TestBed.configureTestingModule({
			imports: [SaRiskCenter],
			providers: [provideRouter([]), { provide: AdminSecurityApiService, useValue: { getFlaggedAccounts: () => throwError(() => new Error('x')) } }, {provide:AdminAccessService,useValue:{can:()=>false}}],
		});
		const fixture = TestBed.createComponent(SaRiskCenter);
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).toContain('تعذر تحميل');
		expect(text).not.toContain('لا توجد حسابات موقوفة حالياً');
	});
  const account = { userId:'u1',name:'حساب اختبار',accountType:'CLIENT_INDIVIDUAL',status:'SUSPENDED',openDisputesAgainst:1,openDisputesOpened:0 };
  it('hides reactivation without users.suspend', () => {
    const f=setup([account]); expect(f.nativeElement.querySelector('[data-testid="rc-reactivate"]')).toBeNull();
  });
  it('does not call the API when confirmation is cancelled', async () => {
    const f=setup([account],true,false); await f.componentInstance.reactivate(account);
    expect((f as any).api.reactivateAccount).not.toHaveBeenCalled(); expect(f.componentInstance.flaggedAccounts()).toHaveLength(1);
  });
  it('reactivates through the API once and removes the row only after server confirmation', async () => {
    const result = new Subject<any>(); const f=setup([account],true,true,result);
    const one=f.componentInstance.reactivate(account); const two=f.componentInstance.reactivate(account); await Promise.all([one,two]);
    expect((f as any).api.reactivateAccount).toHaveBeenCalledTimes(1);
    expect(f.componentInstance.flaggedAccounts()).toHaveLength(1);
    result.next({success:true,data:{id:'u1',status:'ACTIVE'}}); result.complete(); f.detectChanges();
    expect(f.componentInstance.kpis().suspendedCount).toBe(0); expect(f.nativeElement.textContent).toContain('أُعيد تفعيل');
  });
  it('keeps the suspended row and explains a refused action', async () => {
    const f=setup([account],true,true,throwError(()=>({status:403}))); await f.componentInstance.reactivate(account); f.detectChanges();
    expect(f.componentInstance.flaggedAccounts()).toHaveLength(1); expect(f.nativeElement.textContent).toContain('ليست لديك صلاحية');
    expect(f.componentInstance.busyUserId()).toBeNull();
  });

});
