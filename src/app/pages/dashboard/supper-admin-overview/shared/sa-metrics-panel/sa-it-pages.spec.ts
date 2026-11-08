import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SaIndicatorCard } from './sa-indicator-card';
import { TechnicalMetricsStore } from './technical-metrics.store';
import { SaServers } from '../../it/sa-servers/sa-servers';
import { SaPerformance } from '../../it/sa-performance/sa-performance';

const isMetrics = (r: { url: string; method: string }) => r.method === 'GET' && r.url.endsWith('/admin/system-settings/technical-metrics');
const ind = (key: string, group: string, over: Record<string, unknown> = {}) => ({ key, group, label: `L-${key}`, value: 7, unit: 'ms', status: 'measured', readAt: '2026-11-08T09:00:00Z', source: 'src', ...over });
const payload = (indicators: unknown[]) => ({ success: true, data: { generatedAt: '2026-11-08T09:00:00Z', cacheSeconds: 15, windowMinutes: 15, instance: { id: 'a1b2c3', startedAt: '2026-11-08T08:00:00Z', note: 'قراءات API والحاوية تخص هذه النسخة وحدها' }, indicators } });
const setup = () => { TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }); return TestBed.inject(HttpTestingController); };

describe('servers / performance pages and the shared pieces', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });

  it('servers: shows only the process readings, lists host metrics as «غير متاح» with the missing integration, one request', () => {
    const http = setup(); const f = TestBed.createComponent(SaServers); f.detectChanges();
    http.expectOne(isMetrics).flush(payload([ind('api_rss', 'api', { value: 90, unit: 'MB' }), ind('api_uptime', 'api', { value: 120, unit: 'ثانية' }), ind('db_latency', 'database')]));
    f.detectChanges(); const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-key="api_rss"]')?.textContent).toContain('90');
    expect(el.querySelector('[data-key="db_latency"]')).toBeNull();
    expect(el.querySelector('[data-testid="host-metrics-na"]')?.textContent).toContain('غير متاح');
    expect(el.querySelector('[data-testid="host-metrics-na"]')?.textContent).toContain('سلاسل زمنية');
    http.verify();
  });

  it('performance: mixes api and database indicators by key, unavailable ones keep their reason, no zero for unknown', () => {
    const http = setup(); const f = TestBed.createComponent(SaPerformance); f.detectChanges();
    http.expectOne(isMetrics).flush(payload([ind('api_p95', 'api', { value: 250 }), ind('api_p50', 'api', { value: null, status: 'unavailable', reason: 'لا طلبات ضمن النافذة لحساب هذا المؤشر' }), ind('db_latency', 'database', { value: 1.5 }), ind('api_rss', 'api')]));
    f.detectChanges(); const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-key="api_p95"]')?.textContent).toContain('250');
    expect(el.querySelector('[data-key="db_latency"]')?.textContent).toContain('1.5');
    expect(el.querySelector('[data-key="api_p50"]')?.textContent).toContain('غير متاح');
    expect(el.querySelector('[data-key="api_p50"]')?.textContent).toContain('لا طلبات');
    expect(el.querySelector('[data-key="api_rss"]')).toBeNull();
    expect(el.querySelector('[data-testid="perf-na"]')?.textContent).toContain('APM');
    http.verify();
  });

  it('indicator card: measured shows value+unit+time; unavailable never shows a number; error says the reading failed', () => {
    setup();
    const mk = (i: any) => { const f = TestBed.createComponent(SaIndicatorCard); f.componentRef.setInput('indicator', i); f.detectChanges(); return f.nativeElement as HTMLElement; };
    const m = mk(ind('a', 'api', { value: 1234.567, unit: 'MB' }));
    expect(m.textContent).toContain('1,234.57'); expect(m.textContent).toContain('MB'); expect(m.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-08T09:00:00Z');
    const u = mk(ind('a', 'api', { value: null, status: 'unavailable', reason: 'سبب' }));
    expect(u.textContent).toContain('غير متاح'); expect(u.querySelector('.smp-val')).toBeNull();
    expect(mk(ind('a', 'api', { value: null, status: 'error', reason: 'r' })).textContent).toContain('تعذّرت القراءة');
  });

  it('store: one request for concurrent loads, cached for 15 s, forced refresh skips the cache, failure keeps the previous data', () => {
    vi.useFakeTimers();
    const http = setup(); const store = TestBed.inject(TechnicalMetricsStore);
    store.load(); store.load(); store.load();
    http.expectOne(isMetrics).flush(payload([ind('a', 'api')]));
    store.load(); http.expectNone(isMetrics);
    vi.advanceTimersByTime(16_000); store.load(); http.expectOne(isMetrics).flush(payload([ind('b', 'api')]));
    expect(store.data()?.indicators[0].key).toBe('b');
    store.load(true); http.expectOne(isMetrics).flush({}, { status: 500, statusText: 'x' });
    expect(store.error()).toContain('تعذّر'); expect(store.data()?.indicators[0].key).toBe('b');
    store.load(true); http.expectOne(isMetrics).flush({}, { status: 403, statusText: 'x' });
    expect(store.error()).toContain('صلاحية');
    http.verify();
  });

  it('servers: container, host and waf readings show their scope; an unconfigured host source shows «غير متاح» with the variable the infra team must provide', () => {
    const http = setup(); const f = TestBed.createComponent(SaServers); f.detectChanges();
    http.expectOne(isMetrics).flush(payload([
      ind('ctr_mem_used', 'infra', { value: 256, unit: 'MB', scope: 'حاوية الباك فقط (ليس المضيف ولا بقية الخدمات)' }),
      ind('host_cpu', 'infra', { value: null, status: 'unavailable', unit: '%', scope: 'المضيف (المصدر غير مهيأ)', reason: 'المصدر غير مهيأ؛ يلزم من فريق البنية توفير HOST_METRICS_URL (نقطة JSON لمقاييس المضيف)' }),
    ]));
    f.detectChanges(); const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-key="ctr_mem_used"]')?.textContent).toContain('حاوية الباك فقط');
    expect(el.querySelector('[data-key="host_cpu"]')?.textContent).toContain('غير متاح');
    expect(el.querySelector('[data-key="host_cpu"]')?.textContent).toContain('HOST_METRICS_URL');
    expect(el.querySelector('[data-key="host_cpu"] .smp-val')).toBeNull();
    expect(el.querySelector('[data-testid="instance-note"]')?.textContent).toContain('هذه النسخة وحدها');
    http.verify();
  });

  it('backup indicators: a state card, a datetime card with the reading time, detail and scope', () => {
    setup();
    const mk = (i: any) => { const f = TestBed.createComponent(SaIndicatorCard); f.componentRef.setInput('indicator', i); f.detectChanges(); return f.nativeElement as HTMLElement; };
    const st = mk(ind('backup_status', 'backup', { value: null, unit: '', valueText: 'قديمة', state: 'STALE', detail: 'آخر نجاح أقدم من 36 ساعة', scope: 'آخر ما سجّلته مهمة النسخ في ملف الحالة' }));
    expect(st.textContent).toContain('قديمة'); expect(st.textContent).toContain('أقدم من 36 ساعة'); expect(st.textContent).toContain('النطاق'); expect(st.querySelector('[data-state="STALE"]')).not.toBeNull();
    const dt = mk(ind('backup_last_success', 'backup', { value: null, unit: '', valueText: '2026-11-08T07:30:00Z', kind: 'datetime' }));
    expect(dt.querySelectorAll('time').length).toBe(2); expect(dt.querySelector('.smp-val time')?.getAttribute('datetime')).toBe('2026-11-08T07:30:00Z');
    const na = mk(ind('backup_status', 'backup', { value: null, unit: '', valueText: null, status: 'unavailable', state: 'NO_DATA', reason: 'مهمة النسخ لا تنشر حالتها بعد' }));
    expect(na.textContent).toContain('غير متاح'); expect(na.textContent).toContain('مهمة النسخ لا تنشر'); expect(na.querySelector('.smp-val')).toBeNull();
  });
});
