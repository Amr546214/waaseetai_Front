import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { SaBusinessModels } from './sa-business-models';
import { SaBusinessModelDetail } from './sa-business-model-detail/sa-business-model-detail';

const id = '11111111-1111-4111-8111-111111111111';
const item = { id, title: 'نموذج اختبار', description: 'الوصف الحقيقي', status: 'PENDING_APPROVAL', provider: { firstName: 'مقدم', lastName: 'اختبار' }, specialty: null, totalDays: 4, auditRejectionReason: null, stages: [], actions: ['APPROVE', 'REJECT'] };

function setup(canManage: boolean) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id }) } } },
      { provide: AdminAccessService, useValue: { can: () => canManage } },
    ],
  });
  return TestBed.inject(HttpTestingController);
}

describe('admin business-model review', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renders returned rows and applies filters before paging', () => {
    const http = setup(false);
    const fixture = TestBed.createComponent(SaBusinessModels);
    fixture.detectChanges();
    const list = (page: string) => http.expectOne(r => r.url.endsWith('/admin/marketplace-services') && r.params.get('page') === page);
    const reply = (page: number) => ({ data: { items: [item], pagination: { page, pages: 2, total: 21 } } });
    list('1').flush(reply(1));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(item.title);
    fixture.componentInstance.search = '  عنوان  ';
    fixture.componentInstance.status = 'PENDING_APPROVAL';
    fixture.componentInstance.applyFilters();
    const filtered = list('1');
    expect(filtered.request.params.get('search')).toBe('عنوان');
    filtered.flush(reply(1));
    fixture.componentInstance.load(2);
    const next = list('2');
    expect(next.request.params.get('status')).toBe('PENDING_APPROVAL');
    next.flush(reply(2));
  });

  it('shows detail without actions to a review-only admin', () => {
    const http = setup(false);
    const fixture = TestBed.createComponent(SaBusinessModelDetail);
    fixture.detectChanges();
    http.expectOne(r => r.url.endsWith(id)).flush({ data: item });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(item.description);
    expect(fixture.nativeElement.textContent).not.toContain('اعتماد ونشر');
    fixture.componentInstance.choose('APPROVE');
    fixture.componentInstance.confirm();
    http.expectNone(r => r.method === 'PATCH');
  });

  it('sends a rejection with the reason and visible status, and reloads a conflict', () => {
    const http = setup(true);
    const fixture = TestBed.createComponent(SaBusinessModelDetail);
    fixture.detectChanges();
    http.expectOne(r => r.url.endsWith(id)).flush({ data: item });
    const cmp = fixture.componentInstance;
    cmp.choose('REJECT');
    cmp.confirm();
    http.expectNone(r => r.method === 'PATCH');
    cmp.reason = '  مستند ناقص  ';
    cmp.confirm();
    const decision = http.expectOne(r => r.method === 'PATCH' && r.url.endsWith('/moderation'));
    expect(decision.request.body).toEqual({ action: 'REJECT', reason: 'مستند ناقص', expectedStatus: 'PENDING_APPROVAL' });
    decision.flush({}, { status: 409, statusText: 'Conflict' });
    http.expectOne(r => r.url.endsWith(id)).flush({ data: { ...item, status: 'REJECTED', actions: [] } });
    expect(cmp.selected()).toBeNull();
    expect(cmp.model()?.status).toBe('REJECTED');
  });
});
