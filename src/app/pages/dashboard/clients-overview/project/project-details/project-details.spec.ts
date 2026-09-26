import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';

import { ProjectDetails } from './project-details';

// AI disclosure cleanup batch: aiMatchPct/aiConfidence/aiEarlyDays/aiRiskLevel/
// aiBullets previously fabricated a positive-looking value (a computed 88-96%
// match, a fake 95% confidence, a fake early-days estimate, a fake risk level,
// and 3 fabricated positive bullets) whenever the backend's honest "not
// computed yet" signal (confidence:0/matchPercentage:null/bullets:[]/
// riskLevel:'غير محسوبة') came through — the same bug already fixed in the
// sibling provider-overview progress.ts in an earlier batch. These tests
// prove the fallback now surfaces that honest signal as-is.

describe('ProjectDetails', () => {
  let component: ProjectDetails;
  let fixture: ComponentFixture<ProjectDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectDetails],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: () => of({ success: true, data: null }), post: () => of({ success: true, data: {} }) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) }, params: of({ id: 'proj-1' }) } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  const notComputed = { aiInsights: { confidence: 0, matchPercentage: null, earlyDays: 0, bullets: [], riskLevel: 'غير محسوبة' } };

  it('aiMatchPct: shows "غير متاح", never a fabricated 88-96% computed from progress, when the backend signals matchPercentage:null', () => {
    expect(component.aiMatchPct(notComputed)).toBe('غير متاح');
  });

  it('aiMatchPct: passes through a real backend match percentage', () => {
    expect(component.aiMatchPct({ aiInsights: { matchPercentage: 73 } })).toBe('73٪');
  });

  it('aiConfidence: shows "غير متاح", never a fabricated 95%, when the backend signals confidence:0', () => {
    expect(component.aiConfidence(notComputed)).toBe('غير متاح');
  });

  it('aiConfidence: passes through a real backend confidence value', () => {
    expect(component.aiConfidence({ aiInsights: { confidence: 88 } })).toBe('88٪');
  });

  it('aiEarlyDays: shows "—", never a value computed from daysLeft, when earlyDays is 0', () => {
    expect(component.aiEarlyDays(notComputed)).toBe('—');
  });

  it('aiRiskLevel: passes through the backend\'s own honest "غير محسوبة" string as-is, never a computed substitute from daysLeft', () => {
    expect(component.aiRiskLevel(notComputed)).toBe('غير محسوبة');
  });

  it('aiRiskLevel: passes through a real backend risk level', () => {
    expect(component.aiRiskLevel({ aiInsights: { riskLevel: 'منخفضة' } })).toBe('منخفضة');
  });

  it('aiBullets: shows a single honest "not enough data yet" bullet, never 3 fabricated positive bullets, when bullets is empty', () => {
    const bullets = component.aiBullets(notComputed);
    expect(bullets.length).toBe(1);
    expect(bullets[0]).toContain('لا تتوفر تحليلات كافية بعد');
  });

  it('aiBullets: passes through real backend bullets when present', () => {
    const real = ['ملاحظة حقيقية'];
    expect(component.aiBullets({ aiInsights: { bullets: real } })).toEqual(real);
  });

  // Batch 5: qualityNote previously fell back to a fixed "اجتاز فحص الذكاء"
  // (passed AI check) sentence — there is no aiQualityNote/automated
  // pass-fail field anywhere in the backend, so this claimed an inspection
  // that never happened.
  it('qualityNote: shows an honest "no automated note yet" fallback, never the fake "passed AI check" claim', () => {
    const note = component.qualityNote({});
    expect(note).not.toContain('اجتاز فحص الذكاء');
    expect(note).not.toMatch(/\d+\s*[%٪]/);
  });

  it('qualityNote: passes through a real backend note when present', () => {
    expect(component.qualityNote({ aiQualityNote: 'ملاحظة حقيقية من الخادم' })).toBe('ملاحظة حقيقية من الخادم');
  });
});

// Implementation Batch 8 — advisory-only Gemini project health analysis,
// on-demand via analyzeProjectHealth(). Mirrors the equivalent tests added
// to the sibling provider-overview progress.spec.ts.
describe('ProjectDetails — Batch 8 on-demand project health analysis', () => {
  let component: ProjectDetails;
  let fixture: ComponentFixture<ProjectDetails>;

  async function setup(postImpl: () => any) {
    await TestBed.configureTestingModule({
      imports: [ProjectDetails],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: () => of({ success: true, data: { title: 'مشروع', stages: [], files: [], messages: [] } }), post: vi.fn(postImpl) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) }, params: of({ id: 'proj-1' }) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loading: sets healthAnalysisLoading while the request is in flight', async () => {
    const subject = new Subject<any>();
    await setup(() => subject.asObservable());
    component.analyzeProjectHealth();
    expect(component.healthAnalysisLoading()).toBe(true);
    subject.next({ success: true, data: { confidence: 60, riskLevel: 'منخفضة', riskLevelKey: 'LOW', healthRating: 'جيدة', bullets: ['ملاحظة حقيقية'], earlyDays: 1, matchPercentage: null } });
    subject.complete();
    expect(component.healthAnalysisLoading()).toBe(false);
  });

  it('success: renders the real fetched health analysis, replacing the static placeholder, with no fabricated fallback', async () => {
    const realResult = { confidence: 91, riskLevel: 'منخفضة', riskLevelKey: 'LOW', healthRating: 'المشروع يسير جيداً', bullets: ['التزام كامل بالجدول الزمني.'], earlyDays: 3, matchPercentage: null };
    await setup(() => of({ success: true, data: realResult }));
    component.analyzeProjectHealth();
    expect(component.healthAnalysisError()).toBe(false);
    expect(component.healthAnalysis()).toEqual(realResult);
    expect(component.aiConfidence({})).toBe('91٪');
    expect(component.aiRiskLevel({})).toBe('منخفضة');
    expect(component.aiBullets({})).toEqual(['التزام كامل بالجدول الزمني.']);
  });

  it('error/unavailable: a failed request sets healthAnalysisError and never fabricates a positive-looking result', async () => {
    await setup(() => throwError(() => ({ status: 502 })));
    component.analyzeProjectHealth();
    expect(component.healthAnalysisLoading()).toBe(false);
    expect(component.healthAnalysisError()).toBe(true);
    expect(component.healthAnalysis()).toBeNull();
    expect(component.aiConfidence({ aiInsights: { confidence: 0 } })).toBe('غير متاح');
  });

  it('the rendered template never uses contractual-decision wording for the AI analysis section', async () => {
    const realResult = { confidence: 91, riskLevel: 'منخفضة', riskLevelKey: 'LOW', healthRating: 'المشروع يسير جيداً', bullets: ['ملاحظة حقيقية'], earlyDays: 3, matchPercentage: null };
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
    expect(component).toBeTruthy();
  });
});
