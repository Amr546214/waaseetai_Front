import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, filter, map, switchMap, take, timeout } from 'rxjs/operators';
import { of } from 'rxjs';
import { UserRole } from '../models/auth.model';
import { roleAreaOfUrl, roleHome } from '../routing/role-routes';
import { AccountService } from '../services/account.service';
import { UiNotificationService } from '../services/ui-notification.service';
import { AuthStore } from '../store/auth.store';

/** Check the server BEFORE activating a role-area child; waiting for its first 403 renders the wrong page for a frame. */
export const serverActiveRoleGuard: CanActivateFn = (_route, state) => {
  const platformId = inject(PLATFORM_ID);
  const auth = inject(AuthStore);
  const accounts = inject(AccountService);
  const router = inject(Router);
  const ui = inject(UiNotificationService);
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
        timeout(8000),
        map(response => {
          // A response for an earlier login or role switch cannot overwrite the new session.
          if (auth.currentUser()?.id !== userId || auth.token() !== token || auth.currentUser()?.activeRole !== localRole) return false;
          const role = response?.data?.activeRole;
          if (response?.success !== true || !(Object.values(UserRole) as unknown[]).includes(role)) {
            ui.error('تعذر التحقق من دور الحساب. أعد المحاولة.');
            return false;
          }
          if (role !== localRole) auth.updateUser({ activeRole: role });
          // Return a UrlTree rather than starting a parallel navigation from the guard.
          return role === requiredRole ? true : router.createUrlTree([roleHome(role)]);
        }),
        catchError(() => {
          ui.error('تعذر التحقق من دور الحساب. أعد المحاولة.');
          return of(false);
        })
      );
    })
  );
};
