import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadingInterceptor } from '../interceptors/loading.interceptor';
import { LoadingService } from './loading.service';
import { SystemSettingsApi } from './system-settings.store';
import { PlatformInfoService } from './platform-info.service';
import { PlatformStateService, PLATFORM_STATE_POLL_MS } from './platform-state.service';
import { PageLoader } from '../../sheards/page-loader/page-loader';
import { SiteIdentityService } from '../identity/site-identity.service';

const handlers: Record<string, (data?: any) => void> = {};
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: (event: string, fn: (data?: any) => void) => {
      handlers[event] = fn;
    },
    disconnect: vi.fn(),
  })),
}));
@Component({
  standalone: true,
  imports: [PageLoader],
  template:
    '<app-page-loader /><aside data-testid="sidebar">sidebar</aside><main><input data-testid="draft" /></main>',
})
class Shell {}
const state = (on = false, revision = 1) => ({
  success: true,
  data: { maintenance: { on, message: on ? 'maintenance' : '' }, revision },
});
const settings = (on = false, revision = 1) => ({
  success: true,
  revision,
  data: {
    maintenanceMode: on,
    maintenanceBannerText: on ? 'maintenance' : '',
    platformName: 'Waseet',
  },
});

describe('platform background traffic with the real global loader interceptor', () => {
  let http: HttpTestingController;
  let platform: PlatformStateService;
  let info: PlatformInfoService;
  let loading: LoadingService;
  let fixture: ReturnType<typeof TestBed.createComponent<Shell>>;
  const request = (ending: string) => http.expectOne((r) => r.url.endsWith(ending));
  const noOverlay = () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.page-loader')).toBeNull();
    expect(loading.isLoading()).toBe(false);
  };
  const open = () => {
    platform.start();
    request('/public/platform-state').flush(state());
    request('/public/settings').flush(settings());
    fixture.detectChanges();
  };
  beforeEach(() => {
    vi.useFakeTimers();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
        {
          provide: SiteIdentityService,
          useValue: { customUrl: () => null, reportBroken: vi.fn() },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    platform = TestBed.inject(PlatformStateService);
    info = TestBed.inject(PlatformInfoService);
    loading = TestBed.inject(LoadingService);
    fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
  });
  afterEach(() => {
    platform.stop();
    fixture.destroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('keeps the existing shell uncovered during three five-second polls', () => {
    open();
    const sidebar = fixture.nativeElement.querySelector('[data-testid="sidebar"]');
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'unsaved input';
    for (let n = 0; n < 3; n++) {
      vi.advanceTimersByTime(PLATFORM_STATE_POLL_MS);
      const poll = request('/public/platform-state');
      noOverlay();
      expect(fixture.nativeElement.querySelector('[data-testid="sidebar"]')).toBe(sidebar);
      expect(fixture.nativeElement.querySelector('input')).toBe(input);
      expect(input.value).toBe('unsaved input');
      poll.flush(state());
    }
    http.verify();
  });
  it('socket maintenance changes apply immediately, refresh settings silently and reject a late stale poll', () => {
    open();
    vi.advanceTimersByTime(PLATFORM_STATE_POLL_MS);
    const old = request('/public/platform-state');
    handlers['platform:state'](state(true, 2).data);
    expect(info.maintenance()).toBe('maintenance');
    const changed = request('/public/settings');
    noOverlay();
    changed.flush(settings(true, 2));
    old.flush(state(false, 1));
    expect(info.maintenance()).toBe('maintenance');
    handlers['platform:state'](state(false, 3).data);
    expect(info.maintenance()).toBeNull();
    noOverlay();
    request('/public/settings').flush(settings(false, 3));
    http.verify();
  });
  it('reconnect, tab visibility and online resynchronization do not show the page loader', () => {
    open();
    handlers['connect']();
    for (const trigger of [
      () => handlers['connect'](),
      () => document.dispatchEvent(new Event('visibilitychange')),
      () => window.dispatchEvent(new Event('online')),
    ]) {
      trigger();
      const r = request('/public/platform-state');
      noOverlay();
      r.flush(state());
    }
    http.verify();
  });
  it('one-shot settings and failed background reads leave the loader off and preserve known state', async () => {
    open();
    const once = info.loadOnce();
    const r = request('/public/settings');
    noOverlay();
    r.flush(settings());
    await once;
    platform.refresh();
    const failed = request('/public/platform-state');
    noOverlay();
    failed.flush('unavailable', { status: 503, statusText: 'Unavailable' });
    expect(info.brand()).toBe('Waseet');
    expect(info.maintenance()).toBeNull();
    noOverlay();
    http.verify();
  });
  it('monitoring health checks keep the global overlay off while the page owns its local progress', () => {
    open();
    TestBed.inject(SystemSettingsApi).health().subscribe();
    const check = request('/admin/system-settings/health');
    noOverlay();
    check.flush({ success: true, data: { checkedAt: new Date().toISOString(), items: [] } });
    noOverlay();
    http.verify();
  });

  it('ordinary requests still show their loader and background completion cannot clear it', () => {
    open();
    TestBed.inject(HttpClient).get('/api/admin/projects').subscribe();
    const foreground = request('/api/admin/projects');
    fixture.detectChanges();
    expect(loading.isLoading()).toBe(true);
    expect(fixture.nativeElement.querySelector('.page-loader')).not.toBeNull();
    info.load();
    request('/public/settings').flush('unavailable', { status: 500, statusText: 'Error' });
    expect(loading.isLoading()).toBe(true);
    foreground.flush({ data: [] });
    noOverlay();
    http.verify();
  });
});
