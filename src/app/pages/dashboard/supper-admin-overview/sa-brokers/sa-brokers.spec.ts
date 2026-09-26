import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';

import { SaBrokers } from './sa-brokers';
import { AdminBrokerDetail, AdminBrokerListItem } from '../../../../core/models/admin-broker.model';

// Implementation Batch 3, Part B — real super-admin brokers wiring.
// These tests prove the page now loads real GET /admin/brokers data (no
// hardcoded mock array, no fictional 15-level MLM commissionLevels), shows
// only real referral/commission/channel aggregates, and that there is no
// fake aiNotes/aiFlag content and no fake suspend/freeze/withdraw action
// that reports success without a real backend call.

function makeBroker(overrides: Partial<AdminBrokerListItem> = {}): AdminBrokerListItem {
  return {
    id: 'broker-1',
    name: 'سارة القحطاني',
    email: 's.qahtani@email.com',
    referralSlug: 'sara-q',
    level: 'مساعد',
    status: 'ACTIVE',
    joinedAt: '2026-01-01T09:00:00.000Z',
    totalReferrals: 42,
    convertedReferrals: 17,
    conversionRate: 40.5,
    paidCommission: 3200,
    pendingCommission: 450,
    channelCount: 2,
    ...overrides,
  };
}

function makeBrokerDetail(overrides: Partial<AdminBrokerDetail> = {}): AdminBrokerDetail {
  return {
    ...makeBroker(),
    channels: [{ platform: 'Instagram', handle: '@sara-q', url: 'https://instagram.com/sara-q' }],
    channelMetrics: [{ channel: 'Instagram', visitors: 900, clients: 17, conversionPercentage: 1.9 }],
    customLinks: [{ channelName: 'Instagram', utmSource: 'ig', customSlug: 'sara-promo', createdAt: '2026-01-05T00:00:00.000Z' }],
    recentCommissions: [
      { type: 'REFERRAL', amount: 200, currency: 'SAR', status: 'PAID', createdAt: '2026-01-10T00:00:00.000Z', referredUserName: 'خالد المطيري' },
    ],
    ...overrides,
  };
}

function makeListResponse(items: any[] = [makeBroker()], total = items.length, page = 1, limit = 20) {
  return {
    success: true,
    data: {
      items,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    },
  };
}

describe('SaBrokers', () => {
  let component: SaBrokers;
  let fixture: ComponentFixture<SaBrokers>;
  let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

  async function setup(getImpl: (...args: any[]) => any) {
    getSpy = vi.fn(getImpl);
    await TestBed.configureTestingModule({
      imports: [SaBrokers],
      providers: [{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } }],
    }).compileComponents();

    fixture = TestBed.createComponent(SaBrokers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  // Status-count KPI requests (forkJoin of 4 limit=1 calls) return an empty
  // list by default so tests can focus on the main list fetch in isolation.
  function defaultGetImpl(listResponse: any) {
    return (url: string, opts?: any) => {
      const params = opts?.params;
      const status = params?.get ? params.get('status') : undefined;
      const limit = params?.get ? params.get('limit') : undefined;
      if (status && limit === '1') {
        return of(makeListResponse([], 0, 1, 1));
      }
      return of(listResponse);
    };
  }

  it('loads real brokers from GET /admin/brokers (no hardcoded mock array)', async () => {
    await setup(defaultGetImpl(makeListResponse()));
    expect(getSpy.mock.calls.some((c) => String(c[0]).includes('/admin/brokers'))).toBe(true);
    expect(component.brokers().length).toBe(1);
    expect(component.brokers()[0].name).toBe('سارة القحطاني');
  });

  it('shows a loading state while the real request is in flight, then clears it', async () => {
    const listSubject = new Subject<any>();
    getSpy = vi.fn((url: string, opts?: any) => {
      const status = opts?.params?.get ? opts.params.get('status') : undefined;
      const limit = opts?.params?.get ? opts.params.get('limit') : undefined;
      if (status && limit === '1') return of(makeListResponse([], 0, 1, 1));
      return listSubject.asObservable();
    });
    await TestBed.configureTestingModule({
      imports: [SaBrokers],
      providers: [{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SaBrokers);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loading()).toBe(true);
    listSubject.next(makeListResponse());
    expect(component.loading()).toBe(false);
    expect(component.brokers().length).toBe(1);
  });

  it('shows an empty state when the backend returns zero real brokers', async () => {
    await setup(defaultGetImpl(makeListResponse([], 0)));
    fixture.detectChanges();
    expect(component.brokers().length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('لا توجد بيانات مطابقة');
  });

  it('shows an honest error state on API failure instead of fabricated data', async () => {
    getSpy = vi.fn((url: string, opts?: any) => {
      const status = opts?.params?.get ? opts.params.get('status') : undefined;
      const limit = opts?.params?.get ? opts.params.get('limit') : undefined;
      if (status && limit === '1') return of(makeListResponse([], 0, 1, 1));
      return throwError(() => ({ error: { message: 'تعذر الاتصال بالخادم' } }));
    });
    await TestBed.configureTestingModule({
      imports: [SaBrokers],
      providers: [{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SaBrokers);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.error()).toBe('تعذر الاتصال بالخادم');
    expect(component.brokers().length).toBe(0);
  });

  it('renders real referral/conversion/commission metrics from the backend', async () => {
    await setup(defaultGetImpl(makeListResponse()));
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('42');
    expect(text).toContain('17');
    expect(text).toContain('40.5%');
  });

  it('paginates using real page/limit params and advances on nextPage()', async () => {
    await setup(defaultGetImpl(makeListResponse([makeBroker()], 45, 1, 20)));
    fixture.detectChanges();
    component.nextPage();
    fixture.detectChanges();
    const lastCall = getSpy.mock.calls[getSpy.mock.calls.length - 1];
    expect(lastCall[1].params.get('page')).toBe('2');
  });

  it('filters using the real status query param via setFilter()', async () => {
    await setup(defaultGetImpl(makeListResponse()));
    getSpy.mockClear();
    component.setFilter('SUSPENDED');
    fixture.detectChanges();
    expect(getSpy.mock.calls.some((c) => c[1]?.params?.get?.('status') === 'SUSPENDED')).toBe(true);
  });

  it('never renders the fictional 15-level MLM commission structure or fake AI notes', async () => {
    await setup(defaultGetImpl(makeListResponse()));
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('هيكل العمولات');
    expect(text).not.toContain('15 مستوى');
    expect(text).not.toContain('ملاحظات الذكاء الاصطناعي');
    expect(text).not.toContain('AI');
  });

  it('does not render any suspend/freeze/withdrawal action button (removed fake actions)', async () => {
    await setup(defaultGetImpl(makeListResponse()));
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('إيقاف');
    expect(text).not.toContain('تجميد');
    expect(text).not.toContain('تحويل للسحب اليدوي');
  });

  it('opens a real broker detail fetched from GET /admin/brokers/:id with real channel/commission data', async () => {
    getSpy = vi.fn((url: string, opts?: any) => {
      const status = opts?.params?.get ? opts.params.get('status') : undefined;
      const limit = opts?.params?.get ? opts.params.get('limit') : undefined;
      if (status && limit === '1') return of(makeListResponse([], 0, 1, 1));
      if (String(url).includes(`/admin/brokers/${makeBroker().id}`)) {
        return of({ success: true, data: makeBrokerDetail() });
      }
      return of(makeListResponse());
    });
    await TestBed.configureTestingModule({
      imports: [SaBrokers],
      providers: [{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SaBrokers);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.openDetail(component.brokers()[0]);
    fixture.detectChanges();
    expect(component.selected()?.recentCommissions?.[0]?.referredUserName).toBe('خالد المطيري');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('خالد المطيري');
  });

  it('shows an honest detail error state on failure instead of fabricated commission data', async () => {
    getSpy = vi.fn((url: string, opts?: any) => {
      const status = opts?.params?.get ? opts.params.get('status') : undefined;
      const limit = opts?.params?.get ? opts.params.get('limit') : undefined;
      if (status && limit === '1') return of(makeListResponse([], 0, 1, 1));
      if (String(url).includes(`/admin/brokers/${makeBroker().id}`)) {
        return throwError(() => ({ error: { message: 'تعذر تحميل تفاصيل الوسيط' } }));
      }
      return of(makeListResponse());
    });
    await TestBed.configureTestingModule({
      imports: [SaBrokers],
      providers: [{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SaBrokers);
    component = fixture.componentInstance;
    fixture.detectChanges();

    component.openDetail(component.brokers()[0]);
    fixture.detectChanges();
    expect(component.detailError()).toBe('تعذر تحميل تفاصيل الوسيط');
  });
});
