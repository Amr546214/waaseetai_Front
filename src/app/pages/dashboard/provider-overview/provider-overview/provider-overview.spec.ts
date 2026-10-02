import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProviderOverview } from './provider-overview';

describe('ProviderOverview', () => {
  let component: ProviderOverview;
  let fixture: ComponentFixture<ProviderOverview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProviderOverview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProviderOverview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

// AI Cleanup Batch 5 — the "طلبات مطابقة لتخصصاتك" widget is fed by the real
// matching engine (GET /provider/statistics → ai-matching-engine.service.ts).
// A GEMINI item carries a genuine AI score; the DETERMINISTIC rule-engine
// fallback carries aiMatchScore = null and must show no percentage, no "(AI)"
// claim and no "أفضل مطابقة" superlative.
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProviderApiService } from '../../../../core/services/provider-api.service';
import { AuthStore } from '../../../../core/store/auth.store';

describe('ProviderOverview — matching widget truthfulness (AI Cleanup Batch 5)', () => {
  function render(aiMatchingProjects: any[]) {
    const data = {
      summary: { firstName: 'م', lastName: 'خ', hasApprovedSpecialties: true, profileSetupCompleted: true, setupTestCompleted: true, pendingOffersCount: 0 },
      topSteps: {}, latestProjects: [], latestProposals: [], aiMatchingProjects,
    };
    TestBed.configureTestingModule({
      imports: [ProviderOverview],
      providers: [
        provideRouter([]),
        { provide: ProviderApiService, useValue: { getOverviewStats: () => of({ success: true, data }) } },
        { provide: AuthStore, useValue: { currentUser: () => null } },
      ],
    });
    const fixture = TestBed.createComponent(ProviderOverview);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const item = { id: 'p1', title: 'مشروع', specialty: 'تطوير الويب', budget: 1000, matchReasons: ['سبب'], createdAt: new Date().toISOString() };

  it('a real GEMINI score is displayed exactly, labeled as AI', () => {
    const host = render([{ ...item, aiMatchScore: 87, generationSource: 'GEMINI' }]);
    expect(host.querySelector('.offer-ai-match')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('توافق AI • 87%');
    expect(host.textContent).toContain('طلبات مطابقة لتخصصاتك (AI)');
  });

  it('the DETERMINISTIC fallback shows no percentage, no AI claim and no "best match" superlative', () => {
    const host = render([{ ...item, aiMatchScore: null, generationSource: 'DETERMINISTIC' }]);
    expect(host.querySelector('.offer-ai-match')).toBeNull();
    const text = host.textContent || '';
    const widget = Array.from(host.querySelectorAll('.offers-section')).find(el => el.textContent?.includes('طلبات مطابقة لتخصصاتك'));
    expect(widget).toBeTruthy();
    expect(widget!.textContent).not.toMatch(/\d+%/);
    expect(text).not.toContain('(AI)');
    expect(widget!.textContent).not.toContain('أفضل');
    expect(text).not.toContain('نظام الترتيب الذكي');
    expect(text).toContain('دون AI');
  });

  it('keeps the backend order exactly', () => {
    const host = render([
      { ...item, id: 'a', title: 'أول', aiMatchScore: 70, generationSource: 'GEMINI' },
      { ...item, id: 'b', title: 'ثاني', aiMatchScore: 95, generationSource: 'GEMINI' },
    ]);
    const names = Array.from(host.querySelectorAll('.offer-card .offer-name')).map(el => el.textContent?.trim().split(/\s+/)[0]);
    expect(names).toEqual(['أول', 'ثاني']);
  });

  it('a missing budget is not rendered as an invented amount', () => {
    const host = render([{ ...item, budget: null, aiMatchScore: null, generationSource: 'DETERMINISTIC' }]);
    expect(host.querySelector('.offer-card .offer-price')?.textContent).not.toContain('$');
  });
});
