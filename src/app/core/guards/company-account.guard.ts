import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs/operators';
import { AuthStore } from '../store/auth.store';
import { AccountType } from '../models/auth.model';

/**
 * Company-only screens inside /provider-overview (e.g. marketing/approvals).
 * Same shape as the role guards in auth.guards.ts (wait for auth init, pass
 * on the server, redirect otherwise), but checks the STRICT accountType —
 * mirroring the backend's `requireCompanyAccount`, since a
 * PROVIDER_INDIVIDUAL shares the PROVIDER role with company accounts.
 *
 * Non-company users are redirected to `route.data.companyFallback`
 * (default: the provider dashboard). This is defense-in-depth only — the
 * backend endpoints behind these screens reject non-company accounts (403).
 */
export const companyAccountGuard: CanActivateFn = (route) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  return authStore.isInitialized$.pipe(
    filter(isInit => isInit),
    take(1),
    map(() => {
      if (!isPlatformBrowser(platformId)) return true;
      if (authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY) return true;
      const fallback: string = route.data?.['companyFallback'] ?? '/provider-overview';
      return router.parseUrl(fallback);
    })
  );
};
