import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaMonitoring } from './sa-monitoring';

const isHealth = (request: { url: string; method: string }) =>
  request.method === 'GET' && request.url.endsWith('/admin/system-settings/health');
const health = (dbStatus: 'ok' | 'down' = 'ok') => ({
  success: true,
  data: {
    checkedAt: '2026-11-08T09:00:00Z',
    items: [
      { key: 'database', label: 'قاعدة البيانات', status: dbStatus, detail: dbStatus === 'ok' ? 'استجابة 4 ms' : 'لا تستجيب' },
      { key: 'mail', label: 'البريد الإلكتروني', status: 'configured', detail: 'تهيئة فقط' },
      { key: 'backup', label: 'النسخ الاحتياطي', status: 'unavailable', detail: 'لا يوجد مصدر مراقبة' },
    ],
  },
});
function mount() {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(SaMonitoring);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http, el: fixture.nativeElement as HTMLElement };
}

describe('platform monitoring', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });

  it('shows measured results separately from configured or unmonitored integrations', () => {
    const { fixture, http, el } = mount();
    expect(el.textContent).toContain('جاري فحص');
    http.expectOne(isHealth).flush(health());
    fixture.detectChanges();
    const probes = el.querySelector('[aria-label="نتائج الفحص المباشر"]');
    const integrations = el.querySelector('[aria-label="حالة الإعداد والتكاملات"]');
    expect(probes?.textContent).toContain('استجابة 4 ms');
    expect(probes?.textContent).not.toContain('البريد');
    expect(integrations?.textContent).toContain('مُهيّأ');
    expect(integrations?.textContent).toContain('غير مراقَب');
    expect(el.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-08T09:00:00Z');
    http.verify();
  });

  it('keeps the last result visibly stale after an HTTP failure and distinguishes real DB failure after retry', () => {
    const { fixture, http, el } = mount();
    http.expectOne(isHealth).flush(health());
    fixture.componentInstance.refreshNow();
    fixture.componentInstance.refreshNow();
    http.expectOne(isHealth).flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('آخر فحص ناجح');
    expect(el.textContent).toContain('استجابة 4 ms');
    expect(el.textContent).not.toContain('قاعدة البيانات لم تستجب');
    fixture.componentInstance.refreshNow();
    http.expectOne(isHealth).flush(health('down'));
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.textContent).toContain('قاعدة البيانات لم تستجب');
    http.verify();
  });

  it('does not auto-poll unless enabled, stops on toggle-off and aborts when the page is destroyed', () => {
    vi.useFakeTimers();
    const { fixture, http } = mount();
    http.expectOne(isHealth).flush(health());
    vi.advanceTimersByTime(60_000);
    http.expectNone(isHealth);
    fixture.componentInstance.toggleAutomatic();
    vi.advanceTimersByTime(60_000);
    http.expectOne(isHealth).flush(health());
    fixture.componentInstance.toggleAutomatic();
    vi.advanceTimersByTime(60_000);
    http.expectNone(isHealth);
    fixture.componentInstance.toggleAutomatic();
    vi.advanceTimersByTime(60_000);
    const pending = http.expectOne(isHealth);
    fixture.destroy();
    expect(pending.cancelled).toBe(true);
    vi.advanceTimersByTime(60_000);
    http.expectNone(isHealth);
    http.verify();
  });
});
