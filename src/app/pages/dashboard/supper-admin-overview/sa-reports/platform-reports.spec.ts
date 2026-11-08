import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { PlatformReportButton } from '../../../../shared/platform-report-button/platform-report-button';
import { SaReports } from './sa-reports';
import { SaReportDetail } from './sa-report-detail/sa-report-detail';

const id = '11111111-1111-4111-8111-111111111111';

describe('platform reporting UI', () => {
  it('submits the report for the active target and shows the confirmation', () => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), { provide: AuthStore, useValue: { isAuthenticated: () => true } },
    ] });
    const f = TestBed.createComponent(PlatformReportButton);
    f.componentRef.setInput('targetType', 'SERVICE');
    f.componentRef.setInput('targetId', id);
    f.detectChanges();
    f.componentInstance.reason = '  سبب واضح للإبلاغ  ';
    f.componentInstance.submit();
    const http = TestBed.inject(HttpTestingController);
    const req = http.expectOne(r => r.url.endsWith('/reports'));
    expect(req.request.body).toEqual({ targetType: 'SERVICE', targetId: id, reason: 'سبب واضح للإبلاغ' });
    req.flush({ success: true, data: { id, status: 'OPEN' } }, { status: 201, statusText: 'Created' });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('تم إرسال البلاغ للمراجعة');
    http.verify();
  });

  it('loads URL filters, cancels the previous request, and keeps the queue context on detail and back links', async () => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([
        { path: 'supper-admin-overview/reports', component: SaReports },
        { path: 'supper-admin-overview/reports/:id', component: SaReportDetail },
      ]),
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AdminAccessService, useValue: { can: () => false } },
    ] });
    const queue = '/supper-admin-overview/reports';
    const filters = '?status=RESOLVED&targetType=SERVICE&search=Design&page=2';
    const harness = await RouterTestingHarness.create(queue);
    const http = TestBed.inject(HttpTestingController);
    const old = http.expectOne(r => r.url.endsWith('/admin/reports') && r.params.get('status') === 'OPEN');
    const filterForm = harness.routeNativeElement!.querySelector('form')!;
    const search = filterForm.querySelector('input')!;
    search.value = 'unsaved';
    search.dispatchEvent(new Event('input'));
    filterForm.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(search.value).toBe('');
    await harness.navigateByUrl(queue + filters);
    expect(old.cancelled).toBe(true);
    const req = http.expectOne(r => r.url.endsWith('/admin/reports'));
    expect(req.request.params.get('status')).toBe('RESOLVED');
    expect(req.request.params.get('targetType')).toBe('SERVICE');
    expect(req.request.params.get('search')).toBe('Design');
    expect(req.request.params.get('page')).toBe('2');
    const report = { id, targetId: id, targetType: 'SERVICE', targetLabel: 'Design', status: 'RESOLVED', createdAt: '2026-11-08T01:00:00Z' };
    req.flush({ data: { items: [report], total: 21, page: 2, pages: 2 } });
    harness.detectChanges();
    const detail = harness.routeNativeElement!.querySelector('article a')!.getAttribute('href')!;
    expect(detail).toBe(queue + '/' + id + filters);
    await harness.navigateByUrl(detail);
    http.expectOne(r => r.url.endsWith('/reports/' + id)).flush({ data: {
      ...report, reporter: { firstName: 'A', lastName: 'B' }, reviewer: null, reason: 'سبب البلاغ',
      resolution: 'Reviewed', reviewedAt: '2026-11-08T02:00:00Z',
    } });
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('section > a')?.getAttribute('href')).toBe(queue + filters);
    expect(harness.routeNativeElement!.textContent).toContain('وقت القرار');
    expect(harness.routeNativeElement!.textContent).not.toContain('مراجعة الخدمة في الإدارة');
    expect(harness.routeNativeElement!.querySelector('article a')?.getAttribute('href')).toBe('/marketplace/offer/' + id);
    http.verify();
  });

  it('does not send a decision without the management permission', () => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AdminAccessService, useValue: { can: () => false } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id }) } } },
    ] });
    const f = TestBed.createComponent(SaReportDetail);
    f.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(r => r.method === 'GET' && r.url.endsWith('/reports/' + id)).flush({
      data: { id, targetId: id, targetType: 'ACCOUNT', targetLabel: 'اختبار', status: 'OPEN',
        reporter: { firstName: 'A', lastName: 'B' }, reviewer: null, reason: 'سبب البلاغ' },
    });
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('سبب البلاغ');
    expect(f.nativeElement.textContent).not.toContain('حفظ القرار');
    f.componentInstance.resolution = 'Reviewed';
    f.componentInstance.decision = 'RESOLVED';
    f.componentInstance.confirm();
    http.expectNone(r => r.method === 'PATCH');
    http.verify();
  });
});
