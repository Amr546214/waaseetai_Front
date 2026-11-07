import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { PlatformReportButton } from '../../../../shared/platform-report-button/platform-report-button';
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
