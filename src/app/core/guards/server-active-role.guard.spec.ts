import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { provideRouter, Router, RouterOutlet, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { SERVER_ROLE_CHECK_TIMEOUT_MS, serverActiveRoleGuard } from './server-active-role.guard';
import { AuthStore } from '../store/auth.store';
import { UserRole } from '../models/auth.model';
import { environment } from '../../../environments/environment';
import { routes as appRoutes } from '../../app.routes';

let withdrawCreated = 0;
@Component({ standalone: true, imports: [RouterOutlet], template: '<router-outlet />' }) class Shell {}
@Component({ standalone: true, template: 'previous page' }) class Previous {}
@Component({ standalone: true, template: 'withdraw loading body' }) class Withdraw {
  constructor() { withdrawCreated++; }
}

describe('server role is checked before a role page can render', () => {
  const user = signal<any>({ id: 'u1', activeRole: UserRole.AFFILIATE });
  const token = signal('token');
  const url = `${environment.url_api}/user/available-account-types`;
  const routes: Routes = [
    { path: 'before', component: Previous },
    { path: 'auth/login', component: Previous },
    ...['marketer-overview', 'client-overview', 'provider-overview'].map(path => ({
      path, component: Shell, canActivate: [serverActiveRoleGuard],
      runGuardsAndResolvers: 'always' as const,
      children: [{ path: '', component: Previous }, { path: 'summary', component: Previous }, { path: 'withdraw', component: Withdraw }]
    }))
  ];
  let ctl: HttpTestingController;
  let h: RouterTestingHarness;

  beforeEach(async () => {
    withdrawCreated = 0;
    user.set({ id: 'u1', activeRole: UserRole.AFFILIATE }); token.set('token');
    TestBed.configureTestingModule({ providers: [
      provideRouter(routes), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthStore, useValue: {
        currentUser: user, token, isInitialized$: new BehaviorSubject(true),
        updateUser: (patch: any) => user.update(u => ({ ...u, ...patch }))
      } },
      { provide: SERVER_ROLE_CHECK_TIMEOUT_MS, useValue: 60 }
    ] });
    ctl = TestBed.inject(HttpTestingController);
    h = await RouterTestingHarness.create('/before');
  });
  afterEach(() => ctl.verify());
  const pendingRequest = async () => {
    let req!: TestRequest;
    await vi.waitFor(() => { req = ctl.expectOne(url); });
    return req;
  };

  it('is installed before the provider gate and on both other role areas', () => {
    for (const path of ['marketer-overview', 'client-overview', 'provider-overview']) {
      expect(appRoutes.find(r => r.path === path)?.canActivate?.[2]).toBe(serverActiveRoleGuard);
    }
  });

  it('stale summary -> withdraw: never constructs the withdraw component before or after the server redirects to CLIENT', async () => {
    const initial = h.navigateByUrl('/marketer-overview/summary');
    (await pendingRequest()).flush({ success: true, data: { activeRole: UserRole.AFFILIATE } });
    await initial;
    const next = h.navigateByUrl('/marketer-overview/withdraw');
    const req = await pendingRequest();
    expect(withdrawCreated).toBe(0);
    req.flush({ success: true, data: { activeRole: UserRole.CLIENT } });
    (await pendingRequest()).flush({ success: true, data: { activeRole: UserRole.CLIENT } });
    await next;
    expect(TestBed.inject(Router).url).toBe('/client-overview');
    expect(user().activeRole).toBe(UserRole.CLIENT);
    expect(withdrawCreated).toBe(0);
  });

  for (const [area, role] of [['marketer-overview', UserRole.AFFILIATE], ['client-overview', UserRole.CLIENT], ['provider-overview', UserRole.PROVIDER]] as const) {
    it(`opens ${area} only after the matching server answer`, async () => {
      user.set({ id: 'u1', activeRole: role });
      const next = h.navigateByUrl(`/${area}/withdraw`);
      const req = await pendingRequest();
      expect(withdrawCreated).toBe(0);
      req.flush({ success: true, data: { activeRole: role } });
      await next;
      expect(withdrawCreated).toBe(1);
      expect(TestBed.inject(Router).url).toBe(`/${area}/withdraw`);
    });
  }

  it('a session that changed while the read was in flight is ignored: the navigation is cancelled and nothing opens', async () => {
    const next = h.navigateByUrl('/marketer-overview/withdraw');
    const req = await pendingRequest();
    token.set('another-session');
    req.flush({ success: true, data: { activeRole: UserRole.CLIENT } });
    await next;
    expect(withdrawCreated).toBe(0);
    expect(TestBed.inject(Router).url).toBe('/before');
    expect(user().activeRole).toBe(UserRole.AFFILIATE);
  });

  // N3: a failing READ must never lock the user out (fail open = the navigation proceeds as it did before the guard).
  for (const [name, status] of [['500', 500], ['503', 503], ['429', 429], ['403', 403], ['network error', 0], ['404', 404]] as const) {
    it(`fails open on ${name}: the page opens, the local role is untouched`, async () => {
      const next = h.navigateByUrl('/marketer-overview/withdraw');
      (await pendingRequest()).flush({ success: false }, { status, statusText: 'x' });
      await next;
      expect(withdrawCreated).toBe(1);
      expect(TestBed.inject(Router).url).toBe('/marketer-overview/withdraw');
      expect(user().activeRole).toBe(UserRole.AFFILIATE);
    });
  }

  it('fails open on a malformed answer (unknown role / success:false / no data)', async () => {
    for (const body of [{ success: true, data: { activeRole: 'UNKNOWN' } }, { success: false, data: { activeRole: UserRole.CLIENT } }, { success: true }]) {
      withdrawCreated = 0;
      await h.navigateByUrl('/before');
      const next = h.navigateByUrl('/marketer-overview/withdraw');
      (await pendingRequest()).flush(body);
      await next;
      expect(withdrawCreated).toBe(1);
      expect(user().activeRole).toBe(UserRole.AFFILIATE);
    }
  });

  it('fails open on a timeout (no answer within the limit)', async () => {
    const next = h.navigateByUrl('/marketer-overview/withdraw');
    const req = await pendingRequest();
    await next;
    expect(withdrawCreated).toBe(1);
    expect(TestBed.inject(Router).url).toBe('/marketer-overview/withdraw');
    expect(req.cancelled).toBe(true);
  });

  it('401 (the session is invalid) goes to the login page, never opens the page', async () => {
    const next = h.navigateByUrl('/marketer-overview/withdraw');
    (await pendingRequest()).flush({ success: false }, { status: 401, statusText: 'Unauthorized' });
    await next;
    expect(withdrawCreated).toBe(0);
    expect(TestBed.inject(Router).url).toBe('/auth/login');
  });

  it('initial load (no previous page) is never blank: a failing read still opens the page', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [
      provideRouter(routes), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthStore, useValue: { currentUser: user, token, isInitialized$: new BehaviorSubject(true), updateUser: () => {} } },
      { provide: SERVER_ROLE_CHECK_TIMEOUT_MS, useValue: 60 }
    ] });
    const c = TestBed.inject(HttpTestingController);
    const hh = await RouterTestingHarness.create();
    const nav = hh.navigateByUrl('/marketer-overview/withdraw');
    await vi.waitFor(() => c.expectOne(url).flush({}, { status: 500, statusText: 'x' }));
    await nav;
    expect(TestBed.inject(Router).url).toBe('/marketer-overview/withdraw');
    expect(withdrawCreated).toBe(1);
    c.verify();
  });

  it('no loop: a role mismatch costs two reads at most (the area it lands in confirms it)', async () => {
    let reads = 0;
    const next = h.navigateByUrl('/marketer-overview/withdraw');
    for (let i = 0; i < 2; i++) { (await pendingRequest()).flush({ success: true, data: { activeRole: UserRole.CLIENT } }); reads++; }
    await next;
    expect(reads).toBe(2);
    expect(TestBed.inject(Router).url).toBe('/client-overview');
  });
});
