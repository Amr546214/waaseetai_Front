import { computed, inject, Injectable, signal, PLATFORM_ID, Optional } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { User, UserStatus } from '../models/auth.model';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SocialAuthService } from '@abacritt/angularx-social-login';

// Helper functions to read cookies synchronously before signals initialize
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

function getInitialUserSync(): User | null {
  const userJson = getCookieSync('waseet_user');
  if (userJson) {
    try {
      return JSON.parse(userJson) as User;
    } catch {
      return null;
    }
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    const lsUser = localStorage.getItem('waseet_user');
    if (lsUser) {
      try {
        return JSON.parse(lsUser) as User;
      } catch {
        return null;
      }
    }
  }
  return null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthStore {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private socialAuthService = inject(SocialAuthService, { optional: true });

  // Core Signals
  private readonly _currentUser = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);
  private readonly _pendingUserId = signal<string | null>(null);

  // Initialization State
  public isInitialized$ = new BehaviorSubject<boolean>(false);

  // Computed Selectors
  readonly currentUser = this._currentUser.asReadonly();
  readonly token = this._token.asReadonly();
  readonly pendingUserId = this._pendingUserId.asReadonly();

  readonly isAuthenticated = computed(() => !!this._token());
  readonly isPendingVerification = computed(() => !!this._pendingUserId());

  constructor() {
    this.initAuth();
  }

  private initAuth() {
    if (isPlatformBrowser(this.platformId)) {
      // In browser, read from cookies securely, with localStorage fallback
      const token = getCookieSync('waseet_token') || localStorage.getItem('waseet_token') || localStorage.getItem('access_token') || localStorage.getItem('token');
      const user = getInitialUserSync();
      const pending = getCookieSync('waseet_pending_user_id') || localStorage.getItem('waseet_pending_user_id');

      if (token) this._token.set(token);
      if (user) this._currentUser.set(user);
      if (pending) this._pendingUserId.set(pending);

      this.isInitialized$.next(true);
    } else {
      // On server, we assume unauthenticated but mark as initialized to resolve SSR
      this.isInitialized$.next(true);
    }
  }

  // --- Cookie Utility Methods ---

  private setCookie(name: string, value: string, days = 7) {
    if (typeof document === 'undefined') return;
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = 'expires=' + date.toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + ';' + expires + ';path=/';
  }

  private eraseCookie(name: string) {
    if (typeof document === 'undefined') return;
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }

  // --- Auth Actions ---

  /**
   * Set user and token after successful login, verification, or role switch
   */
  public authenticate(token: string, user: User): void {
    this._token.set(token);
    this._currentUser.set(user);
    this._pendingUserId.set(null);

    // Persist securely to Cookies
    this.setCookie('waseet_token', token);
    this.setCookie('waseet_user', JSON.stringify(user));
    this.eraseCookie('waseet_pending_user_id');

    // Synchronize to localStorage for HTTP Interceptor
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('waseet_token', token);
      localStorage.setItem('access_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('waseet_user', JSON.stringify(user));
      localStorage.removeItem('waseet_pending_user_id');
    }
  }

  /**
   * Mark user as pending verification to unlock OTP screen
   */
  public setPendingVerification(userId: string): void {
    this._pendingUserId.set(userId);
    this.setCookie('waseet_pending_user_id', userId);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('waseet_pending_user_id', userId);
    }
  }

  /**
   * Drops the local session (signals, cookies, localStorage) WITHOUT calling the backend or navigating.
   * Used for a corrupt/stale session (e.g. a token with no user) where a redirect must lead somewhere safe.
   */
  public clearSession(): void {
    this._token.set(null);
    this._currentUser.set(null);
    this._pendingUserId.set(null);

    this.eraseCookie('waseet_token');
    this.eraseCookie('waseet_user');
    this.eraseCookie('waseet_pending_user_id');

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('waseet_token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      localStorage.removeItem('waseet_user');
      localStorage.removeItem('waseet_pending_user_id');
    }
  }

  /**
   * Fully clear authentication state, cookies, and local storage, and revoke database session
   */
  public logout(redirectUrl: string = '/auth/login'): void {
    const token = this._token();
    if (token) {
      this.http.post(`${environment.url_api}/auth/logout`, {}).subscribe({
        error: () => {}
      });
    }

    try {
      this.socialAuthService?.signOut().catch(() => {});
    } catch {}

    this.clearSession();

    this.router.navigate([redirectUrl]);
  }

  /**
   * Update user status dynamically (e.g. after profile setup)
   */
  public updateUserStatus(status: UserStatus): void {
    const user = this._currentUser();
    if (user) {
      const updatedUser = { ...user, status };
      this._currentUser.set(updatedUser);
      this.setCookie('waseet_user', JSON.stringify(updatedUser));
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('waseet_user', JSON.stringify(updatedUser));
      }
    }
  }

  /**
   * Update the user object fully or partially
   */
  public updateUser(user: Partial<User>): void {
    const current = this._currentUser();
    if (current) {
      const updatedUser = { ...current, ...user } as User;
      this._currentUser.set(updatedUser);
      this.setCookie('waseet_user', JSON.stringify(updatedUser));
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('waseet_user', JSON.stringify(updatedUser));
      }
    }
  }
}
