import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateChildFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, filter, map, switchMap, take } from 'rxjs/operators';
import { AuthStore } from '../store/auth.store';
import { MarketerProfileService } from '../services/marketer-profile.service';
import {
  MARKETER_SETUP_PAGE,
  isMarketerOnboardingAllowedPath,
  isMarketerOnboardingComplete,
} from '../../pages/dashboard/marketer-overview/profile/profile-setup/marketer-setup-state';

/**
 * Full navigation-level gate under /marketer-overview:
 * prevents marketers from opening the dashboard or any protected marketer route
 * until required profile setup items (avatar, bio, and one marketing channel)
 * are finished. Onboarding, help, notifications, and assistant routes stay open.
 */
export const marketerProfileCompleteGuard: CanActivateChildFn = (_childRoute, state) => {
  const authStore = inject(AuthStore);
  const profileService = inject(MarketerProfileService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  return authStore.isInitialized$.pipe(
    filter(isInit => isInit),
    take(1),
    switchMap(() => {
      if (!isPlatformBrowser(platformId)) return of(true);

      const url = state?.url ?? '';
      if (isMarketerOnboardingAllowedPath(url)) return of(true);

      const readSnap = () => typeof profileService.profileSnapshot === 'function' ? profileService.profileSnapshot() : null;
      return profileService.getProfile().pipe(
        map(res => {
          if (res?.success && res.data) {
            return isMarketerOnboardingComplete(res.data)
              ? true
              : router.parseUrl(MARKETER_SETUP_PAGE);
          }
          const snap = readSnap();
          if (snap && !isMarketerOnboardingComplete(snap)) {
            return router.parseUrl(MARKETER_SETUP_PAGE);
          }
          return true;
        }),
        catchError(() => {
          const snap = readSnap();
          if (snap && !isMarketerOnboardingComplete(snap)) {
            return of(router.parseUrl(MARKETER_SETUP_PAGE));
          }
          return of(true);
        })
      );
    })
  );
};
