import { TestBed } from '@angular/core/testing';
import { Router, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { clientOnboardingGuard } from '../../core/guards/client-onboarding.guard';
import { ClientOnboardingStateService } from '../../core/services/client-onboarding-state.service';
import { UiNotificationService } from '../../core/services/ui-notification.service';
import { isOnboardingAllowedPath } from '../../core/guards/profile-complete.guard';
import { isMarketerOnboardingAllowedPath } from '../../pages/dashboard/marketer-overview/profile/profile-setup/marketer-setup-state';

describe('Standalone payment-method access during onboarding', () => {
  it('keeps provider method management reachable before assessment/approval without opening the wallet', () => {
    for (const stage of ['SETUP_INCOMPLETE', 'ASSESSMENT_REQUIRED', 'PENDING_REVIEW', 'REJECTED']) {
      expect(isOnboardingAllowedPath('/provider-overview/finance/payment-methods', stage)).toBe(true);
      expect(isOnboardingAllowedPath('/provider-overview/finance/wallet', stage)).toBe(false);
    }
  });
  it('lets marketers manage methods without unlocking unrelated commissions or withdrawal pages', () => {
    expect(isMarketerOnboardingAllowedPath('/marketer-overview/finance/payment-methods?from=setup')).toBe(true);
    expect(isMarketerOnboardingAllowedPath('/marketer-overview/withdraw')).toBe(false);
    expect(isMarketerOnboardingAllowedPath('/marketer-overview/commissions')).toBe(false);
  });
  for (const reviewing of [false, true]) it(`keeps client method management open with reviewing=${reviewing}, while the wallet remains gated`, async () => {
    TestBed.configureTestingModule({ providers: [
      { provide: ClientOnboardingStateService, useValue: { applies: () => true, reviewing: () => reviewing, open: () => false, load: () => of(null) } },
      { provide: Router, useValue: { parseUrl: (path: string) => ({ redirectedTo: path }) } },
      { provide: UiNotificationService, useValue: { info: () => undefined } },
    ] });
    const run = (url: string) => TestBed.runInInjectionContext(() => clientOnboardingGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));
    expect(await firstValueFrom(run('/client-overview/finance/payment-methods') as any)).toBe(true);
    expect(await firstValueFrom(run('/client-overview/finance/wallet') as any)).toEqual({ redirectedTo: reviewing ? '/client-overview/review-wait' : '/client-overview/profile-setup' });
  });
});
