import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SaOffers } from './sa-offers';
import { SaOfferDetail } from './sa-offer-detail/sa-offer-detail';
import { feedbackSummary, toList } from './sa-offers.service';

const person = { userId: 'u1', name: 'م', email: 'a@b.c', accountType: 'PROVIDER', memberSince: '2026-01-01', rating: null, completedProjects: 0 };
const list = {
  success: true,
  data: {
    items: [{ id: 'o1', requestId: 'r1', requestTitle: 'ط', title: 'ع', status: 'ACCEPTED', price: 50, deliveryDays: 5, aiMatchScore: null, aiQualityTag: null, aiPriceTag: null, createdAt: '2026-01-01T00:00:00Z', currency: 'USD', provider: person, client: person }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    counts: { all: 5, ACCEPTED: 2, UNDER_NEGOTIATION: 1 },
  },
};

describe('SaOffers (live)', () => {
  it('loads from API, tab counts and KPIs from counts', () => {
    const get = vi.fn().mockReturnValue(of(list));
    TestBed.configureTestingModule({ imports: [SaOffers], providers: [provideRouter([]), { provide: HttpClient, useValue: { get } }] });
    const f = TestBed.createComponent(SaOffers);
    f.detectChanges();
    const c = f.componentInstance;
    expect(get.mock.calls[0][0]).toContain('/admin/offers');
    expect(c.stats()).toEqual({ total: 5, accepted: 2, negotiating: 1 });
    c.setFilter('REJECTED');
    expect(get.mock.calls.at(-1)![1].params.get('status')).toBe('REJECTED');
    f.detectChanges();
    // no AI mark when AI fields are null
    expect(f.nativeElement.querySelector('use')).toBeNull();
  });

  it('shows error message from BE', () => {
    const get = vi.fn().mockReturnValue(throwError(() => ({ error: { message: 'فشل' } })));
    TestBed.configureTestingModule({ imports: [SaOffers], providers: [provideRouter([]), { provide: HttpClient, useValue: { get } }] });
    const f = TestBed.createComponent(SaOffers);
    f.detectChanges();
    expect(f.componentInstance.error()).toBe('فشل');
  });
});

describe('SaOfferDetail (live)', () => {
  const detail = (aiReview: any, neg: any) => ({
    success: true,
    data: { id: 'o1', requestId: 'r1', requestTitle: 'ط', requestStatus: 'OPEN', title: 'ع', message: 'م', advantages: null, outputs: 'مخرج', price: 10, deliveryDays: 3, currency: 'USD', status: 'SUBMITTED', agreedToTerms: true, agreedToEscrow: true, aiReview, milestones: [], provider: person, client: person, contract: null, negotiation: neg, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  });
  const make = (res: any) => {
    TestBed.configureTestingModule({
      imports: [SaOfferDetail],
      providers: [provideRouter([]), { provide: HttpClient, useValue: { get: vi.fn().mockReturnValue(res) } }, { provide: ActivatedRoute, useValue: { paramMap: of({ get: () => 'o1' }) } }],
    });
    const f = TestBed.createComponent(SaOfferDetail);
    f.detectChanges();
    return f;
  };

  it('hides AI panel when aiReview is null and shows negotiation empty state', () => {
    const f = make(of(detail(null, { state: 'NONE', entriesCount: 0, entries: [] })));
    const t = f.nativeElement.textContent;
    expect(t).not.toContain('WaseetAI');
    expect(t).toContain('لا يوجد تفاوض');
    expect(t).toContain('لا توجد جولات تفاوض مسجلة');
  });

  it('shows AI panel only when aiReview exists', () => {
    const f = make(of(detail({ matchScore: 80, qualityTag: 'GOOD', priceTag: null, feedback: { summary: 'ملخص' } }, { state: 'COUNTER_PENDING', entriesCount: 0, entries: [] })));
    const t = f.nativeElement.textContent;
    expect(t).toContain('مراجعة WaseetAI');
    expect(t).toContain('ملخص');
    expect(t).toContain('عرض مضاد بانتظار العميل');
  });

  it('404 gives notFound', () => {
    const f = make(throwError(() => ({ status: 404 })));
    expect(f.componentInstance.notFound()).toBe(true);
  });

  it('helpers', () => {
    expect(toList('a')).toEqual(['a']);
    expect(toList(null)).toEqual([]);
    expect(feedbackSummary({ matchScore: 1, qualityTag: null, priceTag: null, feedback: 'نص' })).toBe('نص');
  });
});
