import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';

import { Progress } from './progress';

// Final AI cleanup batch: the "AI insights" sidebar (and the stage
// "AI match" chip) previously substituted a fabricated positive-looking
// value (94%, 95%, 3 canned bullets, a computed early-days estimate) whenever
// the backend's honest "not computed yet" signal (confidence:0,
// matchPercentage:null, bullets:[], riskLevel:'غير محسوبة') came through.
// These tests prove the fallback now surfaces that honest signal as-is.

describe('Progress (provider delivery review) — honest AI-insights fallback', () => {
  let component: Progress;
  let fixture: ComponentFixture<Progress>;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [Progress],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: vi.fn(() => of({ success: true, data: null })), post: vi.fn(() => of({ success: true, data: {} })) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) } } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(Progress);
    component = fixture.componentInstance;
  }

  const notComputed = { aiInsights: { confidence: null, matchPercentage: null, earlyDays: null, bullets: [], riskLevel: 'غير محسوبة' } };

  it('aiConfidence: shows "غير متاح", never a fabricated percentage, when the backend signals confidence:0', async () => {
    await setup();
    expect(component.aiConfidence(notComputed)).toBe('غير متاح');
  });

  it('aiConfidence: passes through a real, non-zero backend confidence value', async () => {
    await setup();
    expect(component.aiConfidence({ aiInsights: { confidence: 82 } })).toBe('82٪');
  });

  it('aiBullets: shows a single honest "not enough data yet" bullet, never 3 fabricated positive bullets, when bullets is empty', async () => {
    await setup();
    const bullets = component.aiBullets(notComputed);
    expect(bullets.length).toBe(1);
    expect(bullets[0]).toContain('لا تتوفر تحليلات كافية بعد');
  });

  it('aiBullets: passes through real backend bullets when present', async () => {
    await setup();
    const real = ['ملاحظة حقيقية بنص حقيقي'];
    expect(component.aiBullets({ aiInsights: { bullets: real } })).toEqual(real);
  });

  it('aiEarlyDays: shows "—", never a computed-fake value, when earlyDays is 0', async () => {
    await setup();
    expect(component.aiEarlyDays(notComputed)).toBe('—');
  });

  it('aiRiskLevel: passes through the backend\'s own honest "غير محسوبة" string as-is, never a computed substitute', async () => {
    await setup();
    expect(component.aiRiskLevel(notComputed)).toBe('غير محسوبة');
  });

  it('aiRiskLevel: passes through a real backend risk level', async () => {
    await setup();
    expect(component.aiRiskLevel({ aiInsights: { riskLevel: 'منخفضة' } })).toBe('منخفضة');
  });

  it('stageAiMatchPct: shows "غير متاح", never a fabricated 94%, when the stage has no AI match value', async () => {
    await setup();
    expect(component.stageAiMatchPct({})).toBe('غير متاح');
  });

  it('stageAiMatchPct: passes through a real stage AI match value', async () => {
    await setup();
    expect(component.stageAiMatchPct({ aiMatchPct: 77 })).toBe('77٪');
  });
});

// Implementation Batch 8 — advisory-only Gemini project health analysis,
// on-demand via analyzeProjectHealth(). These tests prove the loading,
// success, and unavailable/error states are all honest — the real result
// (once fetched) takes priority over the static placeholder, a failure
// never falls back to a fabricated "positive" result, and the page's
// existing delivery-review flow is unaffected.
describe('Progress — Batch 8 on-demand project health analysis', () => {
  let component: Progress;
  let fixture: ComponentFixture<Progress>;
  let postSpy: ReturnType<typeof vi.fn>;

  async function setup(postImpl: () => any) {
    postSpy = vi.fn(postImpl);
    await TestBed.configureTestingModule({
      imports: [Progress],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: vi.fn(() => of({ success: true, data: { title: 'مشروع تجريبي', stages: [], deliveries: [], edits: [], messages: [], files: [] } })), post: postSpy } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) } } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(Progress);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loading: sets healthAnalysisLoading while the request is in flight, and never marks it done before the response resolves', async () => {
    const subject = new Subject<any>();
    await setup(() => subject.asObservable());
    component.analyzeProjectHealth();
    expect(component.healthAnalysisLoading()).toBe(true);
    subject.next({ success: true, data: { confidence: 60, riskLevel: 'منخفضة', riskLevelKey: 'LOW', healthRating: 'جيدة', bullets: ['ملاحظة حقيقية'], earlyDays: 1, matchPercentage: null } });
    subject.complete();
    expect(component.healthAnalysisLoading()).toBe(false);
  });

  it('success: renders the real fetched health analysis, replacing the static placeholder, with no fabricated fallback', async () => {
    const realResult = { confidence: 88, riskLevel: 'منخفضة', riskLevelKey: 'LOW', healthRating: 'المشروع يسير جيداً', bullets: ['التزام كامل بالجدول الزمني.'], earlyDays: 2, matchPercentage: null };
    await setup(() => of({ success: true, data: realResult }));
    component.analyzeProjectHealth();
    expect(component.healthAnalysisLoading()).toBe(false);
    expect(component.healthAnalysisError()).toBe(false);
    expect(component.healthAnalysis()).toEqual(realResult);
    expect(component.aiConfidence({})).toBe('88٪');
    expect(component.aiRiskLevel({})).toBe('منخفضة');
    expect(component.aiBullets({})).toEqual(['التزام كامل بالجدول الزمني.']);
  });

  it('error/unavailable: a failed request sets healthAnalysisError and never fabricates a positive-looking result', async () => {
    await setup(() => throwError(() => ({ status: 502 })));
    component.analyzeProjectHealth();
    expect(component.healthAnalysisLoading()).toBe(false);
    expect(component.healthAnalysisError()).toBe(true);
    expect(component.healthAnalysis()).toBeNull();
    // Falls back to the honest static placeholder helpers, not a fake positive value.
    expect(component.aiConfidence({ aiInsights: { confidence: null } })).toBe('غير متاح');
  });

  it('error/unavailable: a non-success response body (success:false) is also treated as an honest failure, not silently accepted', async () => {
    await setup(() => of({ success: false }));
    component.analyzeProjectHealth();
    expect(component.healthAnalysisError()).toBe(true);
    expect(component.healthAnalysis()).toBeNull();
  });

  it('the rendered template never uses contractual-decision wording for the AI analysis section', async () => {
    const realResult = { confidence: 88, riskLevel: 'منخفضة', riskLevelKey: 'LOW', healthRating: 'المشروع يسير جيداً', bullets: ['ملاحظة حقيقية'], earlyDays: 2, matchPercentage: null };
    await setup(() => of({ success: true, data: realResult }));
    component.analyzeProjectHealth();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('تحليل استشاري بمساعدة الذكاء الاصطناعي');
    expect(text).not.toMatch(/قرار نهائي بالإفراج|قرار ملزم|حكم نهائي/);
  });

  it('the existing project page still loads and renders without the health-analysis feature interfering', async () => {
    await setup(() => of({ success: true, data: {} }));
    fixture.detectChanges();
    expect(component.projectData()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });
});
