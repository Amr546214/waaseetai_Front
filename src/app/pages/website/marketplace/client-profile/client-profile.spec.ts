import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ClientProfileComponent } from './client-profile';
import { ClientPublicProfile } from '../../../../core/models/client-public-profile.model';

// Implementation Batch 6. Proves the route :id actually determines which
// client is fetched, that only real backend fields are ever rendered, and
// that buildMockClientProfile()'s previous fabricated data (name
// "محمد الغامدي", the entire "aiTrust" block — overall/payment/commitment
// 94/97/89 — the hardcoded "97% payment rate, trusted client" recommendation
// string, project history with prices, budgetRange/avgSpend,
// preferredCategories) can never appear again, even when the API fails.

function realProfileFixture(overrides: Partial<ClientPublicProfile> = {}): ClientPublicProfile {
  return {
    id: 'client-1',
    name: 'خالد العتيبي',
    avatarUrl: null,
    bio: 'أبحث عن جودة عالية والتزام بالمواعيد.',
    city: 'الرياض',
    country: 'السعودية',
    memberSince: '2023-05-01T00:00:00.000Z',
    isVerified: true,
    stats: { completedProjects: 4, activeProjects: 1, totalContracts: 6, providerReviewsCount: 2, providerRatingAverage: 4.5 },
    reviewsFromProviders: [
      { rating: 5, comment: 'التزام ممتاز بالمواعيد.', createdAt: '2024-02-01T00:00:00.000Z', providerName: 'سارة الحربي' },
    ],
    ...overrides,
  };
}

describe('ClientProfileComponent (real public profile)', () => {
  let component: ClientProfileComponent;
  let fixture: ComponentFixture<ClientProfileComponent>;
  let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      clear: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function setup(id: string, getImpl: (...args: any[]) => any) {
    getSpy = vi.fn(getImpl);
    await TestBed.configureTestingModule({
      imports: [ClientProfileComponent],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id }) }, paramMap: of(convertToParamMap({ id })) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('uses the real route :id to determine which client is fetched, via the real endpoint', async () => {
    await setup('client-42', () => of({ success: true, data: realProfileFixture({ id: 'client-42' }) }));

    expect(getSpy.mock.calls[0][0]).toContain('/client/profile/public/client-42');
    expect(component.profile()?.id).toBe('client-42');
  });

  it('shows a loading state before the real response arrives', async () => {
    getSpy = vi.fn(() => of({ success: true, data: realProfileFixture() }));
    await TestBed.configureTestingModule({
      imports: [ClientProfileComponent],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'c-1' }) }, paramMap: of(convertToParamMap({ id: 'c-1' })) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ClientProfileComponent);
    component = fixture.componentInstance;
    expect(component.loading()).toBe(true);
  });

  it('renders the real name, bio and stats — never the old hardcoded "محمد الغامدي" mock person', async () => {
    await setup('c-1', () => of({ success: true, data: realProfileFixture({ name: 'نورة القحطاني', bio: 'نبذة حقيقية' }) }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('نورة القحطاني');
    expect(text).toContain('نبذة حقيقية');
    expect(text).not.toContain('محمد الغامدي');
  });

  it('shows a not-found state on a 404 response, not a fake profile', async () => {
    await setup('missing', () => throwError(() => ({ status: 404, error: { message: 'غير موجود' } })));

    expect(component.notFound()).toBe(true);
    expect(component.profile()).toBeNull();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('لم يتم العثور على هذا الملف الشخصي');
  });

  it('shows an honest error state on a non-404 failure, with no fake data displayed', async () => {
    await setup('c-1', () => throwError(() => ({ status: 500, error: { message: 'خطأ في الخادم' } })));

    expect(component.error()).toBe('خطأ في الخادم');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('94');
    expect(text).not.toContain('97');
  });

  it('renders the real deterministic stats only — completed/active projects, total contracts, real rating average', async () => {
    await setup('c-1', () => of({ success: true, data: realProfileFixture() }));
    fixture.detectChanges();

    const stats = fixture.nativeElement.querySelector('[data-testid="stats-bar"]').textContent as string;
    expect(stats).toContain('4');
    expect(stats).toContain('1');
    expect(stats).toContain('6');
    expect(stats).toContain('4.5');
  });

  it('shows an honest "no rating yet" state instead of a fabricated zero or default score', async () => {
    await setup('c-1', () => of({
      success: true,
      data: realProfileFixture({ stats: { completedProjects: 0, activeProjects: 0, totalContracts: 0, providerReviewsCount: 0, providerRatingAverage: null } }),
    }));
    fixture.detectChanges();

    const stats = fixture.nativeElement.querySelector('[data-testid="stats-bar"]').textContent as string;
    expect(stats).toContain('لا يوجد تقييم بعد');
  });

  it('never renders any fabricated AI trust/payment/commitment field or the "aiTrust" block, in any state', async () => {
    await setup('c-1', () => of({ success: true, data: realProfileFixture() }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('أداء العميل');
    expect(text).not.toContain('تحليل الذكاء الاصطناعي');
    expect(text).not.toContain('موثوقية العميل');
    expect(text).not.toMatch(/\d+\s*[%٪]/); // no percentage of any kind is ever rendered on this page
    expect((component.profile() as any).aiTrust).toBeUndefined();
  });

  it('never renders the old hardcoded "97% payment rate, trusted client" AI recommendation sentence', async () => {
    await setup('c-1', () => of({ success: true, data: realProfileFixture() }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('عميل موثوق بمعدل دفع');
    expect(text).not.toContain('يُنصح بقبول عروضه');
  });

  it('never renders fake project history with prices, budget range, average spend, or preferred categories', async () => {
    await setup('c-1', () => of({ success: true, data: realProfileFixture() }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('ريال');
    expect(text).not.toContain('نطاق الميزانية');
    expect(text).not.toContain('متوسط الإنفاق');
    expect(text).not.toContain('الفئات المفضلة');
  });

  it('renders real reviews from providers (reviewerRole PROVIDER), with an honest empty state when there are none', async () => {
    await setup('c-1', () => of({ success: true, data: realProfileFixture({ reviewsFromProviders: [] }) }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('لا توجد تقييمات من مقدمي خدمة بعد');
  });

  it('shows the real verified badge (Nafath wording, no AI-verification framing) only when true', async () => {
    await setup('c-1', () => of({ success: true, data: realProfileFixture({ isVerified: false }) }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('هوية موثّقة');
  });

  it('when verified, labels it via Nafath, never "هوية مدققة من وسيط AI" or any AI-verification claim', async () => {
    await setup('c-1', () => of({ success: true, data: realProfileFixture({ isVerified: true }) }));
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('هوية موثّقة عبر نفاذ');
    expect(text).not.toContain('من وسيط AI');
    expect(text).not.toContain('مدققة من');
  });
});
