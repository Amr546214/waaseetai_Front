import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { FinalApproval } from './final-approval';

// Batch 5 regression fix: aiMatchPct previously fell back to a fixed "95٪"
// and qualityNote to a fixed "اجتاز فحص الذكاء" (passed AI check) sentence —
// neither aiMatchPct/aiQualityNote is ever computed by the real backend for
// this page, so both fabricated a positive-looking result never verified by
// anything. Same class of bug already fixed in the sibling project-details.ts.

describe('FinalApproval', () => {
  let component: FinalApproval;
  let fixture: ComponentFixture<FinalApproval>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinalApproval],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: () => of({ success: true, data: null }), post: () => of({ success: true, data: {} }) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FinalApproval);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('aiMatchPct: shows "غير متاح", never a fabricated 95%, when no real match percentage exists', () => {
    expect(component.aiMatchPct({})).toBe('غير متاح');
  });

  it('aiMatchPct: passes through a real backend match percentage', () => {
    expect(component.aiMatchPct({ aiInsights: { matchPercentage: 81 } })).toBe('81٪');
  });

  it('qualityNote: shows an honest "no automated note yet" fallback, never the fake "passed AI check" claim', () => {
    const note = component.qualityNote({});
    expect(note).not.toContain('اجتاز فحص الذكاء');
    expect(note).not.toMatch(/\d+\s*[%٪]/);
  });

  it('qualityNote: passes through a real backend note when present', () => {
    expect(component.qualityNote({ aiQualityNote: 'ملاحظة حقيقية من الخادم' })).toBe('ملاحظة حقيقية من الخادم');
  });
});
