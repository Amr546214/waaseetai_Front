import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

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
});
