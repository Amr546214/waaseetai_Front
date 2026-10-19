import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { inject, InjectionToken, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, filter, map, switchMap, take, timeout } from 'rxjs/operators';
import { of } from 'rxjs';
import { UserRole } from '../models/auth.model';
import { roleAreaOfUrl, roleHome } from '../routing/role-routes';
import { AccountService } from '../services/account.service';
import { AuthStore } from '../store/auth.store';

/** How long the pre-activation read may take before the navigation proceeds as it always did (overridable in tests). */
export const SERVER_ROLE_CHECK_TIMEOUT_MS = new InjectionToken<number>('SERVER_ROLE_CHECK_TIMEOUT_MS', { factory: () => 4000 });

/**
 * Check the server BEFORE activating a role-area page: waiting for the page's first 403 would render the wrong role's page for a few frames.
 *
 * Failure policy (decided on evidence, see docs/reviews/role-preactivation-20261019.md):
 *  - 401 -> the session is invalid: go to the login page.
 *  - a clear answer -> the same role opens the page; another role goes to that role's dashboard (the local role is adopted; the switch API is never called).
 *  - anything else (network, timeout, 429, 5xx, 403, malformed body) -> FAIL OPEN: the navigation proceeds exactly as it did before this guard. This is only a
 *    read to avoid a flash; the backend authorization, the ROLE_MISMATCH reconcile and the redirect status note still protect the user, and a
 *    failing read must never lock anybody out of their own dashboard (and never leave an initial load without a page).
 *  - the session / local role changed while the read was in flight -> the answer is stale: it is ignored and this navigation is cancelled (the change
 *    that caused it starts its own navigation).
 */
export const serverActiveRoleGuard: CanActivateFn = (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  const auth = inject(AuthStore);
  const accounts = inject(AccountService);
  const router = inject(Router);
  const timeoutMs = inject(SERVER_ROLE_CHECK_TIMEOUT_MS);
  if (!isPlatformBrowser(platformId)) return true;
  const requiredRole = roleAreaOfUrl(state.url);
  if (!requiredRole) return true;

  return auth.isInitialized$.pipe(
    filter(Boolean), take(1),
    switchMap(() => {
      const userId = auth.currentUser()?.id;
      const token = auth.token();
      const localRole = auth.currentUser()?.activeRole;
      if (!userId || !token) return of(router.createUrlTree(['/auth/login']));
      return accounts.getAvailableAccountTypes().pipe(
        timeout(timeoutMs),
        map(response => {
          // A response for an earlier login or role switch cannot overwrite the new session.
          if (auth.currentUser()?.id !== userId || auth.token() !== token || auth.currentUser()?.activeRole !== localRole) return false;
          const role = response?.data?.activeRole;
          if (response?.success !== true || !(Object.values(UserRole) as unknown[]).includes(role)) return true; // unreadable answer: fail open
          if (role !== localRole) auth.updateUser({ activeRole: role });
          // Return a UrlTree rather than starting a parallel navigation from the guard.
          return role === requiredRole ? true : router.createUrlTree([roleHome(role)]);
        }),
        catchError((err: unknown) => of(err instanceof HttpErrorResponse && err.status === 401 ? router.createUrlTree(['/auth/login']) : true))
      );
    })
  );
};
