import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateChildFn, Router } from '@angular/router';
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
export const providerProfileCompleteGuard: CanActivateChildFn = (childRoute) => {
  if (childRoute.data?.['allowIncompleteProfile']) return true;

  const authStore = inject(AuthStore);
  const providerApiService = inject(ProviderApiService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  return authStore.isInitialized$.pipe(
    filter(isInit => isInit),
    take(1),
    switchMap(() => {
      if (!isPlatformBrowser(platformId)) return of(true);
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
