import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { Referrals } from './referrals';
import { MarketerOverviewService, ReferralStatus } from '../../../../core/services/marketer-overview.service';

// Minimal fn() helper so this spec doesn't need to pull in a mocking lib
// just to assert call args/count.
function jasmineLikeFn<T extends (...args: any[]) => any>(impl: T) {
  const calls: any[][] = [];
  const fn = ((...args: any[]) => { calls.push(args); return impl(...args); }) as T & { calls: any[][] };
  fn.calls = calls;
  return fn;
}

/** Builds a fake MarketerOverviewService with the given getSummary/getReferrals behavior. */
function buildFakeService(opts: {
  getSummary?: () => any;
  getReferrals?: ReturnType<typeof jasmineLikeFn>;
}) {
  return {
    getSummary: opts.getSummary ?? (() => of({
      success: true,
      data: { tier: 'مساعد', successfulReferrals: 2, totalCommissions: 120, overallConversionRate: 0 }
    })),
    getReferrals: opts.getReferrals ?? jasmineLikeFn((_page: number, _limit: number) => of({
      success: true,
      data: { items: [], page: 1, limit: 10, total: 0 }
    }))
  };
}

async function createComponent(fakeService: ReturnType<typeof buildFakeService>) {
  await TestBed.configureTestingModule({
    imports: [Referrals],
    providers: [{ provide: MarketerOverviewService, useValue: fakeService }]
  }).compileComponents();

  const fixture = TestBed.createComponent(Referrals);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, component };
}

describe('Referrals', () => {
  let component: Referrals;
  let fixture: ComponentFixture<Referrals>;
  let getReferralsSpy: ReturnType<typeof jasmineLikeFn>;

  beforeEach(async () => {
    getReferralsSpy = jasmineLikeFn((_page: number, _limit: number) => of({
      success: true,
      data: {
        items: [
          { referredUserDisplayName: 'سارة الزهراني', status: ReferralStatus.QUALIFIED, joinedAt: '2026-06-28', commissionEarned: 120 },
          { referredUserDisplayName: 'فهد العتيبي', status: ReferralStatus.PENDING, joinedAt: '2026-06-20', commissionEarned: null }
        ],
        page: 1,
        limit: 10,
        total: 2
      }
    }));

    const fakeService = {
      // No nextTierThreshold/progressPercentage — those fields were removed
      // from MarketerSummary along with the backend fabricated logic.
      getSummary: () => of({
        success: true,
        data: { tier: 'مساعد', successfulReferrals: 2, totalCommissions: 120, overallConversionRate: 0 }
      }),
      getReferrals: getReferralsSpy
    };

    await TestBed.configureTestingModule({
      imports: [Referrals],
      providers: [{ provide: MarketerOverviewService, useValue: fakeService }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Referrals);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('replaces the hardcoded mock array with real data from MarketerOverviewService.getReferrals()', () => {
    expect(getReferralsSpy.calls.length).toBeGreaterThan(0);
    expect(component.referrals().length).toBe(2);
    expect(component.referrals()[0].referredUserDisplayName).toBe('سارة الزهراني');
    expect(component.total()).toBe(2);
  });

  it('translates the backend ReferralStatus enum into Arabic labels', () => {
    expect(component.getStatusLabel(ReferralStatus.PENDING)).toBe('معلقة');
    expect(component.getStatusLabel(ReferralStatus.QUALIFIED)).toBe('مؤهلة');
    expect(component.getStatusLabel(ReferralStatus.CONVERTED)).toBe('محولة');
  });

  it('shows commissionEarned as "—" when null and "0 دولار" when zero, never blank', () => {
    expect(component.formatCommission(null)).toBe('—');
    expect(component.formatCommission(0)).toBe('0 دولار');
    expect(component.formatCommission(150)).toBe('150 دولار');
  });

  it('paginates by calling getReferrals with the requested page', () => {
    component.total.set(25);
    getReferralsSpy.calls.length = 0;
    component.goToPage(2);
    expect(getReferralsSpy.calls[0][0]).toBe(2);
    expect(getReferralsSpy.calls[0][1]).toBe(component.limit);
  });

  it('filters the loaded page by status and by search query (client-side, over real data)', () => {
    component.setFilter(ReferralStatus.PENDING);
    expect(component.filteredReferrals().length).toBe(1);
    expect(component.filteredReferrals()[0].referredUserDisplayName).toBe('فهد العتيبي');

    component.setFilter('all');
    component.searchQuery.set('سارة');
    expect(component.filteredReferrals().length).toBe(1);
    expect(component.filteredReferrals()[0].referredUserDisplayName).toBe('سارة الزهراني');
  });

  it('derives pendingCount honestly as total() minus successfulReferrals, never a fabricated number', () => {
    // total() = 2 (from getReferrals), successfulReferrals = 2 (from getSummary) => 0 pending
    expect(component.pendingCount()).toBe(0);
  });
});

describe('Referrals — KPI cards (real/derived data, no fabricated fallbacks)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('zero-referral state: all 4 KPI cards render truthful 0s, no fabricated 52/47/4/1', async () => {
    const fakeService = buildFakeService({
      getSummary: () => of({
        success: true,
        data: { tier: 'مساعد', successfulReferrals: 0, totalCommissions: 0, overallConversionRate: 0 }
      }),
      getReferrals: jasmineLikeFn((_page: number, _limit: number) => of({
        success: true,
        data: { items: [], page: 1, limit: 10, total: 0 }
      }))
    });

    const { fixture, component } = await createComponent(fakeService);

    expect(component.total()).toBe(0);
    expect(component.summary()?.successfulReferrals).toBe(0);
    expect(component.pendingCount()).toBe(0);

    const kpiVals = Array.from(fixture.nativeElement.querySelectorAll('.kpi-val')) as HTMLElement[];
    expect(kpiVals.length).toBe(4);
    expect(kpiVals[0].textContent?.trim()).toBe('0');       // إجمالي الإحالات
    expect(kpiVals[1].textContent?.trim()).toBe('0');       // أول مشروع مؤهل
    expect(kpiVals[2].textContent?.trim()).toBe('0');       // بانتظار الاكتمال
    expect(kpiVals[3].textContent?.trim()).toBe('0 دولار');  // إجمالي العمولات

    // None of the old hardcoded mock digits appear anywhere in the KPI grid.
    const kpiGridHtml = fixture.nativeElement.querySelector('.kpi-grid')?.textContent ?? '';
    expect(kpiGridHtml).not.toContain('52');
    expect(kpiGridHtml).not.toContain('47');
    // '4' and '1' are too common as standalone digits to substring-match safely;
    // instead assert the exact per-card values above, which already rules out
    // the old hardcoded 4 / 1.
  });

  it('non-zero real referrals: KPI cards show exactly the real/derived values (8, 3, 5, formatted 150)', async () => {
    const fakeService = buildFakeService({
      getSummary: () => of({
        success: true,
        data: { tier: 'مساعد', successfulReferrals: 3, totalCommissions: 150, overallConversionRate: 0.375 }
      }),
      getReferrals: jasmineLikeFn((_page: number, _limit: number) => of({
        success: true,
        data: { items: [], page: 1, limit: 10, total: 8 }
      }))
    });

    const { fixture, component } = await createComponent(fakeService);

    expect(component.total()).toBe(8);
    expect(component.summary()?.successfulReferrals).toBe(3);
    expect(component.pendingCount()).toBe(5);

    const kpiVals = Array.from(fixture.nativeElement.querySelectorAll('.kpi-val')) as HTMLElement[];
    expect(kpiVals[0].textContent?.trim()).toBe('8');
    expect(kpiVals[1].textContent?.trim()).toBe('3');
    expect(kpiVals[2].textContent?.trim()).toBe('5');
    expect(kpiVals[3].textContent?.trim()).toBe(component.formatCommission(150));
  });

  it('never renders the old fabricated AI-recommendation sentence or fake fallback numbers', async () => {
    const fakeService = buildFakeService({});
    const { fixture } = await createComponent(fakeService);

    const text: string = fixture.nativeElement.textContent ?? '';
    expect(text).not.toContain('3 إحالات إضافية ترقّيك');
    expect(text).not.toContain('أكمل أول 3 إحالات للترقي');
    expect(text).not.toContain('2340'); // old fake totalCommissions fallback
  });

  it('removes the progress bar entirely (bound to the now-nonexistent progressPercentage)', async () => {
    const fakeService = buildFakeService({});
    const { fixture } = await createComponent(fakeService);

    // The progress bar's outer track div carried this exact inline-style signature.
    const progressTrack = fixture.nativeElement.querySelector('[style*="height:7px"]');
    expect(progressTrack).toBeNull();
  });

  it('getSummary()/getReferrals() error: shows the real error state, not silent fallback mock data', async () => {
    const fakeService = buildFakeService({
      getSummary: () => throwError(() => new Error('summary failed')),
      getReferrals: jasmineLikeFn((_page: number, _limit: number) => throwError(() => new Error('referrals failed')))
    });

    const { fixture, component } = await createComponent(fakeService);

    expect(component.errorMessage()).toBe('تعذر تحميل قائمة الإحالات، حاول مرة أخرى');
    expect(component.referrals().length).toBe(0);
    expect(component.total()).toBe(0);
    expect(component.summary()).toBeNull();

    const text: string = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('تعذر تحميل قائمة الإحالات');
    // No fabricated fallback numbers sneak in during an error state.
    expect(text).not.toContain('52');
  });
});
