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
const payload = (indicators: unknown[]) => ({ success: true, data: { generatedAt: '2026-11-08T09:00:00Z', cacheSeconds: 15, windowMinutes: 15, indicators } });
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
    expect(el.querySelector('[data-testid="host-metrics-na"]')?.textContent).toContain('node exporter');
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
});
