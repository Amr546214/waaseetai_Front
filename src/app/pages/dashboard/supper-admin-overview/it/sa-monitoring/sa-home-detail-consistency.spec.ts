import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { SaBackups } from '../sa-backups/sa-backups';
import { SaCdn } from '../sa-cdn/sa-cdn';
import { SaMonitoring } from './sa-monitoring';

const isMetrics = (r: { url: string; method: string }) => r.method === 'GET' && r.url.endsWith('/admin/system-settings/technical-metrics');
const isHealth = (r: { url: string }) => r.url.endsWith('/admin/system-settings/health');
const isEsc = (r: { url: string }) => r.url.endsWith('/admin/system-settings/escalation-readiness');
const ind = (key: string, group: string, over: Record<string, unknown> = {}) => ({ key, group, label: `L-${key}`, value: 5, unit: 'MB', status: 'measured', readAt: '2026-11-08T09:00:00Z', source: 'src', ...over });
const payload = (indicators: unknown[]) => ({ success: true, data: { generatedAt: '2026-11-08T09:00:00Z', cacheSeconds: 15, windowMinutes: 15, indicators } });
const norm = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').replace(/التفاصيل/, '').trim();

function open(indicators: unknown[]) {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const home = TestBed.createComponent(SaMonitoring);
  home.detectChanges();
  http.expectOne(isHealth).flush({ success: true, data: { checkedAt: '2026-11-08T09:00:00Z', items: [] } });
  http.expectOne(isEsc).flush({ success: true, data: { readAt: '2026-11-08T09:00:00Z', automaticEscalation: 'closed', enabled: false, summary: 'التصعيد الآلي مقفول', ready: false, source: 's', supportPermissions: [], disputePermissions: [], preconditions: [] } });
  // ONE metrics request for the whole home page, not one per card
  http.expectOne(isMetrics).flush(payload(indicators));
  home.detectChanges();
  return { http, home, el: home.nativeElement as HTMLElement };
}

describe('monitoring home and detail pages read the same reading', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('CDN measured: home card equals the detail card (value, unit, readAt) and the detail page makes no second request', () => {
    const { http, el } = open([ind('cdn_storage', 'cdn', { value: 42.5, readAt: '2026-11-08T09:00:07Z' }), ind('backup_status', 'backup', { value: null, status: 'unavailable', unit: '', state: 'NO_DATA', reason: 'يلزم ملف حالة من مهمة النسخ' })]);
    const detail = TestBed.createComponent(SaCdn); detail.detectChanges();
    http.expectNone(isMetrics);
    const homeCard = el.querySelector('[data-key="cdn_storage"]')!, detailCard = (detail.nativeElement as HTMLElement).querySelector('[data-key="cdn_storage"]')!;
    expect(norm(homeCard)).toContain('42.5');
    expect(norm(homeCard)).toBe(norm(detailCard));
    expect(homeCard.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-08T09:00:07Z');
    expect(detailCard.querySelector('time')?.getAttribute('datetime')).toBe('2026-11-08T09:00:07Z');
    http.verify();
  });

  it('CDN not configured: both show «غير متاح» with the same reason; backups show the missing integration on both; no «لا يوجد مصدر» wording', () => {
    const { http, el } = open([
      ind('cdn_storage', 'cdn', { value: null, status: 'unavailable', reason: 'تكامل Cloudinary غير مهيأ في هذه البيئة' }),
      ind('backup_status', 'backup', { value: null, status: 'unavailable', unit: '', state: 'NO_DATA', reason: 'يلزم ملف حالة من مهمة النسخ' }),
    ]);
    const cdn = TestBed.createComponent(SaCdn); cdn.detectChanges();
    const bk = TestBed.createComponent(SaBackups); bk.detectChanges();
    http.expectNone(isMetrics);
    const pairs: Array<[string, HTMLElement, string]> = [['cdn_storage', cdn.nativeElement, 'غير مهيأ'], ['backup_status', bk.nativeElement, 'ملف حالة']];
    for (const [key, detailEl, reason] of pairs) {
      const h = el.querySelector(`[data-key="${key}"]`)!, d = detailEl.querySelector(`[data-key="${key}"]`)!;
      expect(norm(h)).toContain('غير متاح'); expect(norm(h)).toContain(reason); expect(norm(h)).toBe(norm(d));
      expect(norm(h)).not.toMatch(/\b0\b/);
    }
    expect(el.textContent).not.toContain('لا يوجد مصدر');
    http.verify();
  });

  it('backup measured (STALE with detail and scope): home card equals the detail card', () => {
    const { http, el } = open([ind('backup_status', 'backup', { value: null, unit: '', valueText: 'قديمة', state: 'STALE', detail: 'آخر نجاح أقدم من 36 ساعة', scope: 'آخر ما سجّلته مهمة النسخ في ملف الحالة' })]);
    const bk = TestBed.createComponent(SaBackups); bk.detectChanges(); http.expectNone(isMetrics);
    const h = el.querySelector('[data-key="backup_status"]')!, d = (bk.nativeElement as HTMLElement).querySelector('[data-key="backup_status"]')!;
    expect(norm(h)).toContain('قديمة'); expect(norm(h)).toContain('أقدم من 36 ساعة'); expect(norm(h)).toBe(norm(d));
    http.verify();
  });
});
