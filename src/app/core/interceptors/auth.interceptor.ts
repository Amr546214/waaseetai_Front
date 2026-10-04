import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../store/auth.store';

function getCookieSync(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
}

/** Auth endpoints whose 401 is part of the flow (login, register, Google, OTP, password reset). */
export const AUTH_ATTEMPT_URLS = [
  '/auth/login', '/auth/register', '/auth/google', '/auth/verify-otp', '/auth/resend-otp',
  '/auth/forgot-password', '/auth/verify-reset-code', '/auth/reset-password',
];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  // Retrieve access token prioritizing AuthStore reactive signal, Cookies, then localStorage keys
  let token: string | null = authStore.token();

  if (!token && isBrowser) {
    token = getCookieSync('waseet_token') ||
            localStorage.getItem('waseet_token') ||
            localStorage.getItem('access_token') ||
            localStorage.getItem('token');
  }

  // Do not perform protected API calls during SSR without a request-scoped
  // session. Throw the error so callers enter their normal error paths.
  if (!isBrowser && !token && req.url.includes('/api/')) {
    return throwError(() => new HttpErrorResponse({
      status: 401,
      statusText: 'SSR Bypassed - Unauthenticated',
      url: req.url,
      error: { success: false, message: 'SSR execution bypassed for authenticated route' }
    }));
  }

  // Clone outgoing requests and attach Authorization Bearer token & withCredentials
  let headers = req.headers;
  if (token && !req.headers.has('Authorization')) {
    headers = req.headers.set('Authorization', `Bearer ${token}`);
  }

  const authReq = req.clone({
    headers,
    withCredentials: true
  });
  const requestHadAuth = Boolean(token || req.headers.has('Authorization'));

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Intercept 401 errors globally in browser environment only
      // A guest can legitimately receive 401 from a private endpoint (for
      // example, if an old component calls favorites). Do not destroy the
      // guest session or redirect from a public page in that case.
      if (error.status === 401 && isBrowser && requestHadAuth) {
        // A 401 from these calls means wrong credentials / bad code for THIS attempt, not an expired session:
        // the page shows the error itself, so the stored session is left untouched and nobody is redirected.
        const isAuthRoute = AUTH_ATTEMPT_URLS.some(u => req.url.includes(u));
        if (!isAuthRoute) {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem('waseet_token');
            localStorage.removeItem('access_token');
            localStorage.removeItem('token');
            localStorage.removeItem('waseet_user');
          }
          authStore.logout('/auth/login');
        }
      }

      // Handle 403 Forbidden for pending account verification
      if (error.status === 403 && error.error?.message && 
          (error.error.message.includes('تفعيل حسابك') || error.error.message.includes('OTP'))) {
        const user = authStore.currentUser();
        if (user) {
          authStore.setPendingVerification(user.id);
          router.navigate(['/auth/verify-otp']);
        }
      }

      return throwError(() => error);
    })
  );
};
