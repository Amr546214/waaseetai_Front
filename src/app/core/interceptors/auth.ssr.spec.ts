import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, REQUEST } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from '../store/auth.store';
import { UiNotificationService } from '../services/ui-notification.service';

describe('anonymous SSR API requests', () => {
  let http: HttpClient;
  let ctl: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: PLATFORM_ID, useValue: 'server' },
      { provide: AuthStore, useValue: { token: () => null } },
      { provide: UiNotificationService, useValue: {} }
    ] });
    http = TestBed.inject(HttpClient); ctl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { ctl.verify(); TestBed.resetTestingModule(); });
  it.each(['/api/public/settings', '/api/levels', '/api/specialties/public', '/api/marketplace/models/123?lang=ar', 'https://dev.waseetai.com/api/marketplace/categories'])('allows the public GET %s to reach the backend', url => {
    let result: unknown;
    http.get(url).subscribe(value => result = value);
    const request = ctl.expectOne(url);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ success: true }); expect(result).toEqual({ success: true });
  });
  it.each(['/api/marketplace/favorites', '/api/marketplace/models/123/my-purchase', '/api/client/company/dashboard', '/api/skills/provider-mine', '/api/public/settings/private'])('continues blocking the protected GET %s without a session', url => {
    let status: number | undefined;
    http.get(url).subscribe({ error: error => status = error.status });
    ctl.expectNone(url); expect(status).toBe(401);
  });
  it('does not allow writes by matching a public read path', () => {
    let status: number | undefined;
    http.post('/api/public/settings', {}).subscribe({ error: error => status = error.status });
    ctl.expectNone('/api/public/settings'); expect(status).toBe(401);
  });
  it('resolves a production relative public URL against the current SSR request', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: PLATFORM_ID, useValue: 'server' },
      { provide: REQUEST, useValue: { url: 'https://waseetai.com/marketplace' } },
      { provide: AuthStore, useValue: { token: () => null } },
      { provide: UiNotificationService, useValue: {} }
    ] });
    http = TestBed.inject(HttpClient); ctl = TestBed.inject(HttpTestingController);
    http.get('/api/marketplace/models?page=2').subscribe();
    ctl.expectOne('https://waseetai.com/api/marketplace/models?page=2').flush({ items: [] });
  });
});
