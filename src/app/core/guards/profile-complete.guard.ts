import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateChildFn, Router } from '@angular/router';
import { AccountType } from '../models/auth.model';
import { PROVIDER_ACCESS_STATUS_URL, ProviderAccessService } from '../services/provider-access.service';
import { filter, map, switchMap, take, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthStore } from '../store/auth.store';
import { ProviderApiService } from '../services/provider-api.service';

/**
 * Full navigation-level lock for an incomplete provider profile — mirrors
 * getProviderNavItems()'s disabling logic in
 * sheards/dashboard/sidebar/sidebar.ts, which only greys out sidebar links
 * (pointer-events-none + routerLink=null). That leaves every other route
 * reachable via a typed URL, bookmark, old link, or router.navigate() call
 * elsewhere in the app — this guard closes that gap by checking on every
 * child navigation under /provider-overview.
 *
 * Applied as canActivateChild on the single 'provider-overview' parent
 * route in app.routes.ts, so it runs for every child route without editing
 * each entry in provider.routes.ts individually. The dashboard home ('')
 * and 'profile/setup' routes opt out via route.data.allowIncompleteProfile
 * — the same two routes the sidebar itself always leaves enabled.
 */

/**
 * INDIVIDUAL providers: every page under /provider-overview (the dashboard home included) opens only when the backend says the account is APPROVED
 * (GET /provider/access-state -> canAccessDashboard). These paths (relative to /provider-overview) stay open meanwhile because they are how
 * onboarding gets finished or how the provider gets help; everything else goes to the status page.
 */
export const ONBOARDING_ALLOWED_PATHS: readonly string[] = [
  'accreditation-status',
  'profile/setup',
  'profile/data',
  'profile/specialties',
  'business-models/accreditation',
  'business-models/center/accreditation-details',
  'help',
  'notifications',
  'settings/account',
];

/** Path under /provider-overview (no query/hash/leading slash) -> may a not-yet-approved individual provider open it? */
export function isOnboardingAllowedPath(url: string): boolean {
  const path = (url || '').split(/[?#]/)[0].replace(/^\/?provider-overview\/?/, '').replace(/^\/+|\/+$/g, '');
  return ONBOARDING_ALLOWED_PATHS.some(p => path === p || path.startsWith(p + '/'));
}

export const providerProfileCompleteGuard: CanActivateChildFn = (childRoute, state) => {
  const authStore = inject(AuthStore);
  const providerApiService = inject(ProviderApiService);
  const providerAccess = inject(ProviderAccessService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  return authStore.isInitialized$.pipe(
    filter(isInit => isInit),
    take(1),
    switchMap(() => {
      if (!isPlatformBrowser(platformId)) return of(true);

      // Any non-company provider (individual): the backend decides, every navigation (a typed URL and a refresh included). Unknown/failed = closed.
      if (authStore.currentUser()?.accountType !== AccountType.PROVIDER_COMPANY) {
        const url = state?.url ?? '';
        // onboarding pages never need the answer to open (the status page reads it itself and shows an honest error with retry)
        if (isOnboardingAllowedPath(url)) return of(true);
        const toStatus = () => router.parseUrl(PROVIDER_ACCESS_STATUS_URL);
        return providerAccess.load().pipe(
          map(a => {
            if (a.canAccessDashboard === true && (a.state === 'APPROVED' || a.state === 'NOT_APPLICABLE')) return true;
            return toStatus();
          }),
          catchError(() => of(toStatus()))
        );
      }

      // Company accounts: unchanged behaviour (profile-completeness nudge only).
      if (childRoute.data?.['allowIncompleteProfile']) return of(true);
      return providerApiService.getOverviewStats().pipe(
        map(res => {
          // Same reading as the sidebar: only an explicit `false` locks the
          // app — a failed/empty response (no data) never blocks navigation,
          // since this is a UX nudge toward setup, not a security boundary
          // (the backend independently enforces its own access rules).
          const completed = res?.success ? res.data?.summary?.profileSetupCompleted : true;
          if (completed !== false) return true;
          return router.parseUrl('/provider-overview/profile/setup');
        }),
        catchError(() => of(true))
      );
    })
  );
};
