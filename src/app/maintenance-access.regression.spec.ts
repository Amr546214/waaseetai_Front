import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, it, afterEach, expect, vi } from 'vitest';
import { App } from './app';
import { PlatformInfoService } from './core/services/platform-info.service';
import { PlatformStateService } from './core/services/platform-state.service';
import { AuthStore } from './core/store/auth.store';
import { AssistantExamState } from './core/store/assistant-exam-state.service';
import { FormA11ySyncService } from './shared/forms/form-a11y-sync.service';
import { OperationsPanelService } from './core/services/operations-panel.service';
vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: vi.fn(), disconnect: vi.fn() })) }));
afterEach(() => TestBed.resetTestingModule());
function setup() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return {
    http: TestBed.inject(HttpTestingController),
    info: TestBed.inject(PlatformInfoService),
    state: TestBed.inject(PlatformStateService),
  };
}
describe('maintenance and access regressions', () => {
  it('allows the full login and recovery flow while every normal screen is blocked', () => {
    const events = new Subject();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: signal(null) } },
        { provide: AssistantExamState, useValue: { examActive: signal(false) } },
        { provide: FormA11ySyncService, useValue: { start: () => {}, stop: () => {} } },
        { provide: Router, useValue: { events, url: '/auth/verify-otp' } },
      ],
    });
    const app = TestBed.runInInjectionContext(() => new App());
    TestBed.inject(PlatformInfoService).applyMaintenance(true, 'maintenance');
    for (const url of [
      '/auth/verify-otp',
      '/auth/forget-password',
      '/auth/login',
      '/auth/google/callback',
    ]) {
      (app as any).url.set(url);
      expect(app.maintenanceBlocked()).toBe(false);
    }
    for (const url of ['/auth/register', '/dashboard', '/auth/login-other']) {
      (app as any).url.set(url);
      expect(app.maintenanceBlocked()).toBe(true);
    }
  });
  it('an old HTTP answer cannot undo a newer socket state; the next read refreshes every public setting', () => {
    const { http, info, state } = setup();
    info.load();
    const old = http.expectOne((r) => r.url.endsWith('/public/settings'));
    state.apply({ maintenance: { on: true, message: 'new maintenance' }, revision: 2 });
    old.flush({
      success: true,
      revision: 1,
      data: { maintenanceMode: false, platformName: 'old name' },
    });
    expect(info.maintenance()).toBe('new maintenance');
    expect(info.name()).not.toBe('old name');
    http
      .expectOne((r) => r.url.endsWith('/public/settings'))
      .flush({
        revision: 2,
        data: {
          maintenanceMode: true,
          maintenanceBannerText: 'new maintenance',
          platformName: 'new name',
          supportPhone: 'new phone',
          termsContent: 'new terms',
        },
      });
    expect(info.name()).toBe('new name');
    expect(info.supportPhoneSetting()).toBe('new phone');
    expect(info.termsContent()).toBe('new terms');
    state.apply({ maintenance: { on: false, message: '' }, revision: 1 });
    expect(info.maintenance()).toBe('new maintenance');
    http.verify();
  });
  it('unversioned reads and errors cannot clear a known maintenance revision', async () => {
    const { http, info } = setup();
    info.applyState(true, 'known', 7);
    const once = info.loadOnce();
    http
      .expectOne((r) => r.url.endsWith('/public/settings'))
      .flush({ data: { maintenanceMode: false } });
    await once;
    expect(info.maintenance()).toBe('known');
    info.setMaintenance('old', 6);
    expect(info.maintenance()).toBe('known');
  });
  it('access is cleared across users, late responses are ignored, and errors permit retry', () => {
    const user = signal<any>({ id: 'one', accountType: 'SUPER_ADMIN' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { currentUser: user } },
      ],
    });
    const http = TestBed.inject(HttpTestingController),
      panel = TestBed.inject(OperationsPanelService);
    panel.load();
    http
      .expectOne((r) => r.url.endsWith('/system-settings/access'))
      .flush({ data: { officialDeployment: true, isSuperAdmin: true, available: true } });
    expect(panel.available()).toBe(true);
    user.set({ id: 'two', accountType: 'ADMIN' });
    TestBed.tick();
    expect(panel.available()).toBe(false);
    http
      .expectOne((r) => r.url.endsWith('/system-settings/access'))
      .flush('fail', { status: 503, statusText: 'fail' });
    expect(panel.loaded()).toBe(false);
    expect(panel.error()).toBeTruthy();
    panel.load();
    http
      .expectOne((r) => r.url.endsWith('/system-settings/access'))
      .flush({ data: { officialDeployment: true, isSuperAdmin: false, available: false } });
    expect(panel.available()).toBe(false);
    user.set(null);
    TestBed.tick();
    expect(panel.state()?.available).toBe(false);
    http.verify();
  });
});
