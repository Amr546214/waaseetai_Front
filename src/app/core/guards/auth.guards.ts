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
        // Already logged in, force redirect to their dashboard
        return router.createUrlTree(['/client-overview']);
      }

      if (authStore.isPendingVerification()) {
        // They started registration but didn't verify OTP, guide them to verification
        if (state.url.includes('/auth/register')) {
          return true;
        }
        return router.createUrlTree(['/auth/register']);
      }

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
 */
const getDefaultDashboard = (accountType?: AccountType, activeRole?: UserRole): string => {
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
      
      // Fallback redirect to their proper dashboard
      return router.createUrlTree([getDefaultDashboard(user?.accountType, user?.activeRole)]);
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

      // Fallback redirect to their proper dashboard
      return router.createUrlTree([getDefaultDashboard(user?.accountType, user?.activeRole)]);
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

      // Fallback redirect to their proper dashboard
      return router.createUrlTree([getDefaultDashboard(user?.accountType, user?.activeRole)]);
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

      // Fallback redirect to their proper dashboard
      return router.createUrlTree([getDefaultDashboard(user?.accountType)]);
    })
  );
};
