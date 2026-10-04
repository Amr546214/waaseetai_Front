import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../store/auth.store';
import { UserStatus, AccountType, UserRole } from '../models/auth.model';
import { filter, map, take } from 'rxjs/operators';

/**
 * Protects Dashboard routes - only Authenticated users allowed
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // Helper to safely check fallback token in localStorage or cookies
  const hasFallbackToken = () => {
    if (!isPlatformBrowser(platformId)) return false;
    
    // Check localStorage first
    if (localStorage.getItem('waseet_token') || localStorage.getItem('token')) return true;
    
    // Check cookies as fallback
    const ca = document.cookie.split(';');
    return ca.some(c => c.trim().startsWith('waseet_token='));
  };

  return authStore.isInitialized$.pipe(
    filter(isInit => isInit),
    take(1),
    map(() => {
      // 1. Fix race condition: check state OR synchronous storage
      if (authStore.isAuthenticated() || hasFallbackToken()) {
        return true;
      }

      // On server, we avoid redirecting to login to prevent login flashing during hydration
      if (!isPlatformBrowser(platformId)) {
        return true; 
      }

      // 3. Route Memory Preservation
      // Save target URL in localStorage so login page can redirect back after success
      localStorage.setItem('returnUrl', state.url);

      // Not authenticated, redirect to login
      return router.createUrlTree(['/auth/login'], {
        queryParams: { returnUrl: state.url }
      });
    })
  );
};

/**
 * Protects Auth routes (Login/Register) - redirects Authenticated users to dashboard
 */
export const guestGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  return authStore.isInitialized$.pipe(
    filter(isInit => isInit),
    take(1),
    map(() => {
      if (authStore.isAuthenticated()) {
        // Already logged in — redirect to THEIR actual dashboard (never a
        // hard-coded '/client-overview'), so a Provider/Marketer/Admin who
        // lands here (e.g. via a stale "Change Password" link pointing at
        // this logged-out-only route) doesn't get bounced into a dashboard
        // they don't belong to.
        const user = authStore.currentUser();
        if (!user) {
          // A token with no user is a stale/partial session: it cannot be sent to any dashboard (every role
          // guard would bounce it back here). Drop it and show the guest page.
          authStore.clearSession();
          return true;
        }
        return router.createUrlTree([getDefaultDashboard(user.accountType, user.activeRole)]);
      }

      // Pending OTP verification only auto-resumes the OTP step when the user
      // is already on /auth/register (see Register.ngOnInit). It must never
      // redirect visits to /auth/login or /auth/forget-password here: the
      // pendingUserId marker survives (7-day cookie, and indefinitely in
      // localStorage) even after someone abandons a signup mid-OTP, which
      // would otherwise permanently trap them out of the login page on that
      // browser — including when they're trying to log into an unrelated,
      // already-verified account.
      return true;
    })
  );
};

/**
 * Protects Verification route - blocks active users, allows only pending users
 */
export const verificationGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  return authStore.isInitialized$.pipe(
    filter(isInit => isInit),
    take(1),
    map(() => {
      if (authStore.isPendingVerification()) {
        return true;
      }

      if (authStore.isAuthenticated()) {
        return router.createUrlTree(['/client-overview']);
      }

      // Not pending anything, shouldn't be here
      return router.createUrlTree(['/auth/register']);
    })
  );
};

/**
 * Helper to determine the default dashboard based on the user's active role or account type.
 * Exported so login/register (and anywhere else that redirects post-auth) can
 * reuse this single source of truth instead of duplicating their own
 * accountType-only chains.
 */
export const getDefaultDashboard = (accountType?: AccountType, activeRole?: UserRole): string => {
  if (activeRole === UserRole.SUPER_ADMIN) return '/supper-admin-overview';
  if (activeRole === UserRole.PROVIDER) return '/provider-overview';
  if (activeRole === UserRole.AFFILIATE) return '/marketer-overview';
  if (activeRole === UserRole.CLIENT) return '/client-overview';

  switch (accountType) {
    case AccountType.SUPER_ADMIN:
      return '/supper-admin-overview';
    case AccountType.PROVIDER_INDIVIDUAL:
    case AccountType.PROVIDER_COMPANY:
      return '/provider-overview';
    case AccountType.MARKETING_BROKER:
      return '/marketer-overview';
    case AccountType.CLIENT_INDIVIDUAL:
    case AccountType.CLIENT_COMPANY:
    default:
      return '/client-overview';
  }
};

/**
 * Maps an accountType to the `role` query param key expected by the
 * "مرحبا بك" welcome screen (/auth/welcome, design P-CM-001). Returns
 * undefined for account types the design doesn't define a welcome-card
 * variant for (e.g. SUPER_ADMIN) — the welcome screen falls back to its
 * error state in that case.
 */
export const getWelcomeRoleKey = (accountType?: AccountType): string | undefined => {
  switch (accountType) {
    case AccountType.CLIENT_INDIVIDUAL:
      return 'client-individual';
    case AccountType.CLIENT_COMPANY:
      return 'client-company';
    case AccountType.PROVIDER_INDIVIDUAL:
      return 'provider-individual';
    case AccountType.PROVIDER_COMPANY:
      return 'provider-company';
    case AccountType.MARKETING_BROKER:
      return 'broker';
    default:
      return undefined;
  }
};

/**
 * Where to send a user who may not enter a role area. It must never be the SAME area: that redirects to itself
 * forever and freezes the tab. That happens when there is a token but no usable user (stale/partial session), or a
 * user whose role has no dashboard of its own. In both cases the session is not usable, so it is dropped and the
 * user lands on the login page.
 */
function roleAreaFallback(authStore: AuthStore, router: Router, user: { accountType?: AccountType; activeRole?: UserRole } | null | undefined, ownArea: string, target: string) {
  if (!user || target === ownArea) {
    authStore.clearSession();
    return router.createUrlTree(['/auth/login']);
  }
  return router.createUrlTree([target]);
}

/**
 * Protects Client routes - only Client users allowed
 */
export const clientGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  return authStore.isInitialized$.pipe(
    filter(isInit => isInit),
    take(1),
    map(() => {
      if (!isPlatformBrowser(platformId)) return true;

      const user = authStore.currentUser();
      if (user && (user.activeRole === UserRole.CLIENT || user.accountType === AccountType.CLIENT_INDIVIDUAL || user.accountType === AccountType.CLIENT_COMPANY)) {
        return true;
      }
      
      // Fallback: their own dashboard, unless that is this very area (would loop) - see roleAreaFallback.
      return roleAreaFallback(authStore, router, user, '/client-overview', getDefaultDashboard(user?.accountType, user?.activeRole));
    })
  );
};

/**
 * Protects Provider routes - only Provider users allowed
 */
export const providerGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  return authStore.isInitialized$.pipe(
    filter(isInit => isInit),
    take(1),
    map(() => {
      if (!isPlatformBrowser(platformId)) return true;

      const user = authStore.currentUser();
      if (user && (user.activeRole === UserRole.PROVIDER || user.accountType === AccountType.PROVIDER_INDIVIDUAL || user.accountType === AccountType.PROVIDER_COMPANY)) {
        return true;
      }

      // Fallback: their own dashboard, unless that is this very area (would loop) - see roleAreaFallback.
      return roleAreaFallback(authStore, router, user, '/provider-overview', getDefaultDashboard(user?.accountType, user?.activeRole));
    })
  );
};

/**
 * Protects Marketer routes - only Marketing Broker / Affiliate users allowed
 */
export const marketerGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  return authStore.isInitialized$.pipe(
    filter(isInit => isInit),
    take(1),
    map(() => {
      if (!isPlatformBrowser(platformId)) return true;

      const user = authStore.currentUser();
      if (user && (user.activeRole === UserRole.AFFILIATE || user.accountType === AccountType.MARKETING_BROKER)) {
        return true;
      }

      // Fallback: their own dashboard, unless that is this very area (would loop) - see roleAreaFallback.
      return roleAreaFallback(authStore, router, user, '/marketer-overview', getDefaultDashboard(user?.accountType, user?.activeRole));
    })
  );
};

/**
 * Protects Super Admin routes - only Super Admin users allowed
 */
export const superAdminGuard: CanActivateFn = (route, state) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  return authStore.isInitialized$.pipe(
    filter(isInit => isInit),
    take(1),
    map(() => {
      if (!isPlatformBrowser(platformId)) return true;

      const user = authStore.currentUser();
      if (user && user.accountType === AccountType.SUPER_ADMIN) {
        return true;
      }

      // Fallback: their own dashboard, unless that is this very area (would loop) - see roleAreaFallback.
      return roleAreaFallback(authStore, router, user, '/supper-admin-overview', getDefaultDashboard(user?.accountType));
    })
  );
};
