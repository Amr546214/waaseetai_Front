import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { expect, it } from 'vitest';
import { SaBroadcast } from './sa-broadcast';

it('counts the chosen audience, clears stale counts and copies a template into a plain-text draft without sending', () => {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(SaBroadcast);
  const c = fixture.componentInstance;
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  http.expectOne(r => r.url.endsWith('/admin/notification-templates') && r.method === 'GET').flush({
    data: { page: 1, hasNext: false, items: [{ id: 'qa', name: 'ترحيب', title: 'أهلًا', message: '<b>نص فقط</b>' }] },
  });
  const preview = () => http.expectOne(r => r.url.endsWith('/admin/broadcast-preview') && r.method === 'GET');
  c.setAudience('CLIENTS');
  c.countAudience();
  const clients = preview();
  expect(clients.request.params.get('audience')).toBe('CLIENTS');
  clients.flush({ data: { audience: 'CLIENTS', count: 3, checkedAt: '2026-11-08T12:00:00Z' } });
  expect(c.preview()?.count).toBe(3);
  c.setAudience('PROVIDERS');
  expect(c.preview()).toBeNull();
  c.countAudience();
  preview().flush({ data: { audience: 'PROVIDERS', count: 0, checkedAt: '2026-11-08T12:00:00Z' } });
  c.selectedTemplateId = 'qa';
  c.useTemplate();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  expect(el.textContent).toContain('الحسابات المؤهلة الآن: 0');
  const draft = el.querySelector('[aria-label="معاينة الرسالة"]')!;
  expect(draft.textContent).toContain('<b>نص فقط</b>');
  expect(draft.querySelector('b')).toBeNull();
  http.verify();
});
