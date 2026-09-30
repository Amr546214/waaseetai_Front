import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { Referrals } from './referrals';
import { MarketerOverviewService, ReferralStatus } from '../../../../core/services/marketer-overview.service';

describe('Referrals', () => {
  let component: Referrals;
  let fixture: ComponentFixture<Referrals>;
  let getReferralsSpy: ReturnType<typeof jasmineLikeFn>;

  // Minimal fn() helper so this spec doesn't need to pull in a mocking lib
  // just to assert call args/count.
  function jasmineLikeFn<T extends (...args: any[]) => any>(impl: T) {
    const calls: any[][] = [];
    const fn = ((...args: any[]) => { calls.push(args); return impl(...args); }) as T & { calls: any[][] };
    fn.calls = calls;
    return fn;
  }

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
      getSummary: () => of({
        success: true,
        data: { tier: 'مساعد', successfulReferrals: 2, totalCommissions: 120, overallConversionRate: 0, nextTierThreshold: 3, progressPercentage: 10 }
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

  it('shows commissionEarned as "—" when null and "0 ريال" when zero, never blank', () => {
    expect(component.formatCommission(null)).toBe('—');
    expect(component.formatCommission(0)).toBe('0 ريال');
    expect(component.formatCommission(150)).toBe('150 ريال');
  });

  it('paginates by calling getReferrals with the requested page', () => {
    component.total.set(25);
    getReferralsSpy.calls.length = 0;
    component.goToPage(2);
    expect(getReferralsSpy.calls[0][0]).toBe(2);
    expect(getReferralsSpy.calls[0][1]).toBe(component.limit);
  });
});
