import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
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

  const notComputed = { aiInsights: { confidence: 0, matchPercentage: null, earlyDays: 0, bullets: [], riskLevel: 'غير محسوبة' } };

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
    expect(bullets[0].title).toContain('لا تتوفر تحليلات كافية بعد');
  });

  it('aiBullets: passes through real backend bullets when present', async () => {
    await setup();
    const real = [{ title: 'ملاحظة حقيقية', text: 'نص حقيقي' }];
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
