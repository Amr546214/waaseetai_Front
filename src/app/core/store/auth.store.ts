import { computed, inject, Injectable, signal, PLATFORM_ID, Optional } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AccountType, User, UserRole, UserStatus } from '../models/auth.model';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { redirectTargetAfterRoleChange } from '../routing/role-routes';

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

  /** The role the user is ACTING as right now: the saved activeRole, else the side of the account type. */
  readonly actingRole = computed<UserRole | null>(() => {
    const u = this._currentUser();
    if (!u) return null;
    if (u.activeRole) return u.activeRole;
    if (u.accountType === AccountType.CLIENT_INDIVIDUAL || u.accountType === AccountType.CLIENT_COMPANY) return UserRole.CLIENT;
    if (u.accountType === AccountType.PROVIDER_INDIVIDUAL || u.accountType === AccountType.PROVIDER_COMPANY) return UserRole.PROVIDER;
    return null;
  });
  /** Buying from the marketplace (cart, order, payment, the client wallet) is a CLIENT-acting flow. A guest still sees the buy buttons (they lead to login). */
  readonly canPurchase = computed(() => !this.isAuthenticated() || this.actingRole() === UserRole.CLIENT);
  /** Whether the account can act as a client at all (so "switch to client" is possible); otherwise it needs a client account first. */
  readonly hasClientRole = computed(() => {
    const u = this._currentUser();
    return !!u && ((u.roles ?? []).includes(UserRole.CLIENT) || u.accountType === AccountType.CLIENT_INDIVIDUAL || u.accountType === AccountType.CLIENT_COMPANY);
  });
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

      // Another tab of this browser switched role / logged in again: follow it (storage events fire only in the OTHER tabs, so this can never loop).
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('storage', (e: StorageEvent) => this.onStorageEvent(e));
      }
    } else {
      // On server, we assume unauthenticated but mark as initialized to resolve SSR
      this.isInitialized$.next(true);
    }
  }

  private onStorageEvent(e: StorageEvent): void {
    if (e.key !== 'waseet_user' && e.key !== 'waseet_token') return;
    const token = localStorage.getItem('waseet_token');
    const raw = localStorage.getItem('waseet_user');
    if (!token || !raw) return; // a logout elsewhere is left to the next 401; never half-clear here
    let user: User;
    try { user = JSON.parse(raw) as User; } catch { return; }
    if (token !== this._token()) this._token.set(token);
    const before = this._currentUser();
    if (JSON.stringify(before) === raw) return;
    const roleBefore = this.actingRole();
    this._currentUser.set(user);
    if (this.actingRole() !== roleBefore) this.followRoleChange();
  }

  /** Moves off a role area the (new) acting role does not own — only then; never from a public page, and never to the area it is already in. */
  private followRoleChange(): void {
    const role = this.actingRole();
    if (!role) return;
    const target = redirectTargetAfterRoleChange(this.router.url, role);
    if (!target || this.followingTo === target) return; // the same redirect is already on its way (parallel 403s): do not repeat it
    this.followingTo = target;
    const done = () => { if (this.followingTo === target) this.followingTo = null; };
    this.router.navigateByUrl(target).then(done, done);
  }

  private followingTo: string | null = null;

  /**
   * The server told us (ROLE_MISMATCH 403) which role it accepts for this account. Adopt it in the session (signal + cookie + localStorage, so the menu and
   * the guards follow) and leave a page that belongs to the other role. Returns true only when the local role CHANGED (so the caller tells the user once);
   * when the role was already adopted earlier but the tab is still inside the other role's area (the earlier redirect was superseded by a click), the tab is
   * still moved out - that is a no-op whenever the URL is already in the right area, so it can never loop. No session: nothing happens.
   */
  public reconcileActiveRole(serverRole: UserRole): boolean {
    if (!this._currentUser()) return false;
    const changed = this.actingRole() !== serverRole;
    if (changed) this.updateUser({ activeRole: serverRole });
    this.followRoleChange();
    return changed;
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
