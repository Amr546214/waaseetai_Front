import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { provideRouter, Router, RouterOutlet, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { serverActiveRoleGuard } from './server-active-role.guard';
import { AuthStore } from '../store/auth.store';
import { UserRole } from '../models/auth.model';
import { environment } from '../../../environments/environment';
import { UiNotificationService } from '../services/ui-notification.service';
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
  const ui = { error: vi.fn() };
  const url = `${environment.url_api}/user/available-account-types`;
  const routes: Routes = [
    { path: 'before', component: Previous },
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
    user.set({ id: 'u1', activeRole: UserRole.AFFILIATE }); token.set('token'); ui.error.mockClear();
    TestBed.configureTestingModule({ providers: [
      provideRouter(routes), provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthStore, useValue: {
        currentUser: user, token, isInitialized$: new BehaviorSubject(true),
        updateUser: (patch: any) => user.update(u => ({ ...u, ...patch }))
      } },
      { provide: UiNotificationService, useValue: ui }
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

  for (const failure of ['server', 'malformed', 'session-change'] as const) {
    it(`does not activate the page on ${failure}`, async () => {
      const next = h.navigateByUrl('/marketer-overview/withdraw');
      const req = await pendingRequest();
      if (failure === 'session-change') token.set('another-session');
      if (failure === 'server') req.flush({}, { status: 500, statusText: 'Error' });
      else req.flush({ success: true, data: { activeRole: failure === 'malformed' ? 'UNKNOWN' : UserRole.CLIENT } });
      await next;
      expect(withdrawCreated).toBe(0);
      expect(TestBed.inject(Router).url).toBe('/before');
      expect(user().activeRole).toBe(UserRole.AFFILIATE);
    });
  }
});
