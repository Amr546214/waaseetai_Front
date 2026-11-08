import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaApis } from '../../it/sa-apis/sa-apis';
import { SaBackups } from '../../it/sa-backups/sa-backups';
import { SaCdn } from '../../it/sa-cdn/sa-cdn';
import { SaDatabase } from '../../it/sa-database/sa-database';

const isMetrics = (r: { url: string; method: string }) => r.method === 'GET' && r.url.endsWith('/admin/system-settings/technical-metrics');
const isProbe = (r: { url: string }) => r.url.endsWith('/health') && !r.url.includes('system-settings');
const ind = (key: string, group: string, over: Record<string, unknown> = {}) => ({ key, group, label: `L-${key}`, value: 12.5, unit: 'ms', status: 'measured', readAt: '2026-11-08T09:00:00Z', source: 'src', ...over });
const payload = (indicators: unknown[]) => ({ success: true, data: { generatedAt: '2026-11-08T09:00:00Z', cacheSeconds: 15, windowMinutes: 15, indicators } });
function mount<T>(cmp: new () => T) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(cmp);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http, el: fixture.nativeElement as HTMLElement };
}

describe('technical metrics pages', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });

  it('database: shows measured value with unit and last-read time, only its own group', () => {
    const { fixture, http, el } = mount(SaDatabase);
    http.expectOne(isMetrics).flush(payload([ind('db_latency', 'database', { value: 3.2 }), ind('api_p50', 'api')]));
    fixture.detectChanges();
    const card = el.querySelector('[data-key="db_latency"]')!;
    expect(card.textContent).toContain('3.2');
    expect(card.textContent).toContain('ms');
    expect(card.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-08T09:00:00Z');
    expect(card.textContent).toContain('آخر قراءة');
    expect(el.querySelector('[data-key="api_p50"]')).toBeNull();
    http.verify();
  });

  it('backups: unavailable shows «غير متاح» with the reason and never a number', () => {
    const { fixture, http, el } = mount(SaBackups);
    http.expectOne(isMetrics).flush(payload([ind('backup_last_success', 'backup', { value: null, status: 'unavailable', unit: 'تاريخ', reason: 'مهمة النسخ لا تنشر وقت آخر نجاح' })]));
    fixture.detectChanges();
    const card = el.querySelector('[data-key="backup_last_success"]')!;
    expect(card.textContent).toContain('غير متاح');
    expect(card.textContent).toContain('مهمة النسخ لا تنشر وقت آخر نجاح');
    expect(card.querySelector('.smp-val')).toBeNull();
    expect(card.textContent).not.toMatch(/\b0\b/);
    http.verify();
  });

  it('cdn: a provider error is shown as a failed reading, not as a value', () => {
    const { fixture, http, el } = mount(SaCdn);
    http.expectOne(isMetrics).flush(payload([ind('cdn_storage', 'cdn', { value: null, status: 'error', unit: 'MB', reason: 'تعذّر الاتصال بالمزوّد' })]));
    fixture.detectChanges();
    const card = el.querySelector('[data-key="cdn_storage"]')!;
    expect(card.textContent).toContain('تعذّرت القراءة');
    expect(card.textContent).toContain('تعذّر الاتصال بالمزوّد');
    http.verify();
  });

  it('request failure shows an error with retry that recovers; the previous reading stays marked as the last successful one', () => {
    const { fixture, http, el } = mount(SaDatabase);
    http.expectOne(isMetrics).flush({}, { status: 500, statusText: 'x' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('تعذّر قراءة المؤشرات');
    (el.querySelector('.smp-retry') as HTMLButtonElement).click();
    http.expectOne(isMetrics).flush(payload([ind('db_size', 'database', { value: 80, unit: 'MB' })]));
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelector('[data-key="db_size"]')?.textContent).toContain('80');
    (el.querySelector('.smp-actions button') as HTMLButtonElement).click();
    http.expectOne(isMetrics).flush({}, { status: 403, statusText: 'x' });
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('ليست لديك صلاحية');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('آخر قراءة ناجحة');
    expect(el.querySelector('[data-key="db_size"]')).not.toBeNull();
    http.verify();
  });

  it('automatic refresh is opt-in and never faster than 60 seconds', () => {
    vi.useFakeTimers();
    const { fixture, http } = mount(SaDatabase);
    http.expectOne(isMetrics).flush(payload([]));
    vi.advanceTimersByTime(120_000);
    http.expectNone(isMetrics);
    fixture.debugElement.query(x => x.name === 'app-sa-metrics-panel').componentInstance.toggleAutomatic();
    vi.advanceTimersByTime(59_000);
    http.expectNone(isMetrics);
    vi.advanceTimersByTime(1_000);
    http.expectOne(isMetrics).flush(payload([]));
    http.verify();
  });

  it('apis: keeps the liveness probe next to the process readings and says the numbers are per-process', () => {
    const { fixture, http, el } = mount(SaApis);
    http.expectOne(isProbe).flush({ status: 'ok' });
    http.expectOne(isMetrics).flush(payload([ind('api_rss', 'api', { value: 120, unit: 'MB' })]));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="api-health"]')?.textContent).toContain('يعمل');
    expect(el.querySelector('[data-key="api_rss"]')?.textContent).toContain('120');
    expect(el.textContent).toContain('هذه العملية فقط');
    http.verify();
  });
});
