import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';

import { ProjectDetails } from './project-details';

// Batch 6 — ProjectDetails now also injects ClientCompanyTeamService
// alongside the pre-existing AuthStore injection; with AuthStore unmocked in
// any describe block in this file, Angular constructs the REAL AuthStore,
// whose constructor reads localStorage synchronously — this runner provides
// no global localStorage. Pre-existing test-environment gap (same class
// already worked around elsewhere this session, e.g. marketplace.spec.ts),
// not a production bug.
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

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

// Batch 6 — real "الموظف المسؤول عن المتابعة" (responsible employee)
// assignment on the canonical project workspace page, backed by
// Project.assignedEmployeeId via PUT /client/projects/:id/assigned-employee.
// No parallel "employee projects" page was kept — this IS the real page.
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { ClientCompanyTeamService } from '../../../../../core/services/client-company-team.service';

describe('ProjectDetails — real employee assignment (Batch 6)', () => {
  function makeMember(overrides: any = {}) {
    return { id: 'emp-1', name: 'سارة القحطاني', email: 's@x.sa', phone: null, jobTitle: 'مديرة المشتريات', status: 'ACTIVE', avatarUrl: null, createdAt: '', updatedAt: '', ...overrides };
  }

  async function setup(opts: { workspaceData?: any; putImpl?: (...args: any[]) => any; listImpl?: () => any; isCompany?: boolean } = {}) {
    const isCompany = opts.isCompany ?? true;
    const fixture = TestBed.configureTestingModule({
      imports: [ProjectDetails],
      providers: [
        provideRouter([]),
        {
          provide: HttpClient, useValue: {
            get: () => of({ success: true, data: { title: 'مشروع', stages: [], files: [], messages: [], employee: null, ...opts.workspaceData } }),
            post: () => of({ success: true, data: {} }),
            put: opts.putImpl ?? (() => of({ success: true, data: { id: 'proj-1', employee: makeMember() } })),
          }
        },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) }, params: of({ id: 'proj-1' }) } },
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType: isCompany ? AccountType.CLIENT_COMPANY : AccountType.CLIENT_INDIVIDUAL }) } },
        { provide: ClientCompanyTeamService, useValue: { list: opts.listImpl ?? (() => of({ success: true, data: [makeMember()] })) } },
      ],
    });
    const created = TestBed.createComponent(ProjectDetails);
    created.detectChanges();
    await created.whenStable();
    return { fixture: created, component: created.componentInstance };
  }

  it('1) renders the real assigned employee name/jobTitle from the workspace response', async () => {
    const { fixture } = await setup({ workspaceData: { employee: { id: 'emp-1', name: 'سارة القحطاني', jobTitle: 'مديرة المشتريات' } } });
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('سارة القحطاني');
    expect(text).toContain('مديرة المشتريات');
  });

  it('2) shows a truthful unassigned state, never a fabricated name, when employee is null', async () => {
    const { fixture } = await setup({ workspaceData: { employee: null } });
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('غير معيّن');
  });

  it('3) opening the assignment picker loads real ACTIVE roster members only', async () => {
    const { component } = await setup({
      listImpl: () => of({ success: true, data: [makeMember({ id: 'e1', status: 'ACTIVE' }), makeMember({ id: 'e2', status: 'PENDING' }), makeMember({ id: 'e3', status: 'INACTIVE' })] }),
    });
    component.openAssignPicker();
    expect(component.employeeOptions().length).toBe(1);
    expect(component.employeeOptions()[0].id).toBe('e1');
  });

  it('4) assigning an employee calls the real PUT endpoint and updates the displayed state only from the server response', async () => {
    const putSpy = vi.fn((_url: string, _body: any) => of({ success: true, data: { id: 'proj-1', employee: { id: 'e1', name: 'خالد', jobTitle: 'محاسب' } } }));
    const { component } = await setup({ putImpl: putSpy });
    component.assignEmployee('e1');
    expect(putSpy.mock.calls[0][0]).toContain('/client/projects/proj-1/assigned-employee');
    expect(putSpy.mock.calls[0][1]).toEqual({ employeeId: 'e1' });
    expect(component.project()?.employee).toEqual({ id: 'e1', name: 'خالد', jobTitle: 'محاسب' });
  });

  it('5) a failed assignment never shows a fake-success state — the picker stays open with a real error', async () => {
    const { component } = await setup({ putImpl: () => throwError(() => ({ error: { message: 'فشل التعيين' } })) });
    component.openAssignPicker();
    component.assignEmployee('e1');
    expect(component.showAssignPicker()).toBe(true);
    expect(component.assignError()).toBe('فشل التعيين');
  });

  it('6) unassignEmployee calls assignEmployee(null)', async () => {
    const putSpy = vi.fn((_url: string, _body: any) => of({ success: true, data: { id: 'proj-1', employee: null } }));
    const { component } = await setup({ putImpl: putSpy });
    component.unassignEmployee();
    expect(putSpy.mock.calls[0][1]).toEqual({ employeeId: null });
  });

  it('7) a CLIENT_INDIVIDUAL never sees the responsible-employee UI at all', async () => {
    const { fixture } = await setup({ isCompany: false, workspaceData: { employee: { id: 'e1', name: 'سارة', jobTitle: 'مديرة' } } });
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).not.toContain('الموظف المسؤول عن المتابعة');
  });
});
