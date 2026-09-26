import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { MarketerProfileComponent } from './marketer-profile';
import { MarketerPublicProfile } from '../../../../core/models/marketer-public-profile.model';

// Implementation Batch 3, Part A. Proves the route :id actually determines
// which marketer is fetched, that only real backend fields are ever
// rendered, and that no hardcoded "فهد الغامدي" fallback or fake
// followers/engagementRate/monthlyReach/campaigns/audience data can appear
// even when the API fails.

function realProfileFixture(overrides: Partial<MarketerPublicProfile> = {}): MarketerPublicProfile {
  return {
    id: 'marketer-1',
    name: 'خالد الغامدي',
    avatarUrl: null,
    bio: 'سيرة ذاتية حقيقية للوسيط',
    level: 'مساعد',
    identityVerified: true,
    channels: [{ platform: 'INSTAGRAM', handle: '@khalid', url: 'https://instagram.com/khalid' }],
    channelMetrics: null,
    ...overrides,
  };
}

describe('MarketerProfileComponent (real public profile)', () => {
  let component: MarketerProfileComponent;
  let fixture: ComponentFixture<MarketerProfileComponent>;
  let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

  beforeEach(() => {
    // This test environment has no global `localStorage` (same pre-existing
    // gap documented in create-request.spec.ts / ai-assistant.spec.ts) —
    // AuthStore's own token lookup is exercised against a stubbed one.
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
      imports: [MarketerProfileComponent],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id }) }, paramMap: of(convertToParamMap({ id })) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketerProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('uses the real route :id to determine which marketer is fetched', async () => {
    await setup('marketer-42', () => of({ success: true, data: realProfileFixture({ id: 'marketer-42' }) }));

    expect(getSpy.mock.calls[0][0]).toContain('/marketer/profile/public/marketer-42');
    expect(component.profile()?.id).toBe('marketer-42');
  });

  it('shows a loading state before the real response arrives', async () => {
    getSpy = vi.fn(() => of({ success: true, data: realProfileFixture() }));
    await TestBed.configureTestingModule({
      imports: [MarketerProfileComponent],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'm-1' }) }, paramMap: of(convertToParamMap({ id: 'm-1' })) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MarketerProfileComponent);
    component = fixture.componentInstance;
    expect(component.loading()).toBe(true);
  });

  it('renders the real name, bio, and channels — no hardcoded fallback person', async () => {
    await setup('m-1', () => of({ success: true, data: realProfileFixture({ name: 'سارة العتيبي', bio: 'نبذة حقيقية' }) }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('سارة العتيبي');
    expect(text).toContain('نبذة حقيقية');
    expect(text).not.toContain('فهد الغامدي');
  });

  it('shows a not-found state on a 404 response, not a fake profile', async () => {
    await setup('missing', () => throwError(() => ({ status: 404, error: { message: 'غير موجود' } })));

    expect(component.notFound()).toBe(true);
    expect(component.profile()).toBeNull();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('لم يتم العثور على هذا الملف الشخصي');
  });

  it('shows an honest error state on a non-404 failure, with no fake analytics displayed', async () => {
    await setup('m-1', () => throwError(() => ({ status: 500, error: { message: 'خطأ في الخادم' } })));

    expect(component.error()).toBe('خطأ في الخادم');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('1.2M');
    expect(text).not.toContain('340K');
  });

  it('never renders fake followers/engagementRate/monthlyReach/campaigns/audience fields', async () => {
    await setup('m-1', () => of({ success: true, data: realProfileFixture() }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('إجمالي المتابعين');
    expect(text).not.toContain('معدل التفاعل');
    expect(text).not.toContain('وصول شهري');
    expect(text).not.toContain('حملة ناجحة');
    expect(text).not.toContain('تحليل الجمهور');
  });

  it('never renders a fake AI score/AI Verified badge', async () => {
    await setup('m-1', () => of({ success: true, data: realProfileFixture() }));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('AI Verified');
    expect(text).not.toContain('نقاط AI');
    expect(text).not.toContain('تحليل AI للأداء التسويقي');
  });

  it('shows an empty-channel state when the marketer has no real channels', async () => {
    await setup('m-1', () => of({ success: true, data: realProfileFixture({ channels: [] }) }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('لا توجد قنوات مسجلة حالياً');
  });

  it('shows the real channelMetrics when the marketer opted in (sharePerformanceStats)', async () => {
    await setup('m-1', () => of({
      success: true,
      data: realProfileFixture({ channelMetrics: [{ channel: 'INSTAGRAM', visitors: 500, clients: 20, conversionPercentage: 4 }] }),
    }));
    component.setTab('channels');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('500 زائر');
    expect(text).toContain('4%');
  });

  it('shows an honest opt-out message when channelMetrics is null, not a fabricated zero', async () => {
    await setup('m-1', () => of({ success: true, data: realProfileFixture({ channelMetrics: null }) }));
    component.setTab('channels');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('لم يشارك هذا الوسيط إحصائيات الأداء علنياً');
  });

  it('shows the real identityVerified badge only when true', async () => {
    await setup('m-1', () => of({ success: true, data: realProfileFixture({ identityVerified: false }) }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('هوية موثّقة');
  });
});
