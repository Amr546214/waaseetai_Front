import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ActiveProject } from './active-project';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

describe('ActiveProject', () => {
  let component: ActiveProject;
  let fixture: ComponentFixture<ActiveProject>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActiveProject],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: () => of({ success: true, data: { kpis: [], projects: [] } }) } },
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType: AccountType.CLIENT_INDIVIDUAL }) } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActiveProject);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

// Batch 6 — the canonical company project list now carries the real
// "المسؤول عن المتابعة" (responsible employee) field, backed by
// Project.assignedEmployeeId. The UI fields themselves (employeeName,
// employeeJobTitle) were already pre-wired in this component — these tests
// prove they're now correctly fed from the real `project.employee`
// {id,name,jobTitle} shape the backend returns, not the old speculative
// `project.employee?.department` mapping.
describe('ActiveProject — real responsible-employee field (Batch 6)', () => {
  function setup(opts: { isCompany?: boolean; getImpl?: () => any } = {}) {
    const isCompany = opts.isCompany ?? true;
    TestBed.configureTestingModule({
      imports: [ActiveProject],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: opts.getImpl ?? (() => of({ success: true, data: { kpis: [], projects: [] } })) } },
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType: isCompany ? AccountType.CLIENT_COMPANY : AccountType.CLIENT_INDIVIDUAL }) } },
      ],
    });
    const fixture: ComponentFixture<ActiveProject> = TestBed.createComponent(ActiveProject);
    return { fixture, component: fixture.componentInstance };
  }

  function rawProject(overrides: any = {}) {
    return {
      id: 'p1', title: 'مشروع تجريبي', status: 'run', progress: 50,
      provider: { name: 'مزود', initial: 'م' }, contract: 'CT-0001',
      heldAmount: 500, nextStep: 'خطوة', completedStages: 1, stagesCount: 2, daysLeft: 5,
      ...overrides,
    };
  }

  it('1) renders the real employee name/jobTitle for a company account when assigned', () => {
    const { fixture } = setup({
      getImpl: () => of({ success: true, data: { kpis: [], projects: [rawProject({ employee: { id: 'e1', name: 'سارة القحطاني', jobTitle: 'مديرة المشتريات' } })] } }),
    });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('سارة القحطاني');
    expect(text).toContain('مديرة المشتريات');
  });

  it('2) shows a truthful "غير معيّن" (unassigned) state for a company account when employee is null — never fabricated', () => {
    const { fixture } = setup({
      getImpl: () => of({ success: true, data: { kpis: [], projects: [rawProject({ employee: null })] } }),
    });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).toContain('غير معيّن');
  });

  it('3) a CLIENT_INDIVIDUAL never sees the responsible-employee UI at all, even if the field happened to be present', () => {
    const { fixture } = setup({
      isCompany: false,
      getImpl: () => of({ success: true, data: { kpis: [], projects: [rawProject({ employee: { id: 'e1', name: 'سارة القحطاني', jobTitle: 'مديرة' } })] } }),
    });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(text).not.toContain('المسؤول');
  });

  it('4) an unfunded project awaiting signature is labelled as such, says what is next, and opens the request instead of the workspace', () => {
    const { fixture } = setup({
      getImpl: () => of({ success: true, data: { kpis: [], projects: [rawProject({ id: 'p9', status: 'wait', rawStatus: 'PENDING_SIGNATURE', progress: 0, heldAmount: 0, nextStep: 'توقيع العقد وإيداع الضمان لبدء التنفيذ' })] } }),
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent || '';
    expect(text).toContain('بانتظار التوقيع');
    expect(text).toContain('توقيع العقد وإيداع الضمان لبدء التنفيذ');
    expect(text).toContain('إكمال التوقيع');
    expect(el.querySelector('.pl-badge')?.textContent?.trim()).toBe('بانتظار التوقيع');
    expect(el.querySelector('a.pl-card')?.getAttribute('href')).toContain('/client-overview/my-requests/p9');
  });
});

// Honest funding states (BE: funded / phase / daysLeft null before the contract starts): an unfunded project holds nothing and counts nothing
// down; a funded one waits for the provider's signature; a running one shows its stages' real progress.
describe('ActiveProject — funding states', () => {
  function setup(projects: any[]) {
    TestBed.configureTestingModule({
      imports: [ActiveProject],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: { get: () => of({ success: true, data: { kpis: [], projects } }) } },
        { provide: AuthStore, useValue: { currentUser: () => ({ accountType: AccountType.CLIENT_INDIVIDUAL }) } },
      ],
    });
    const fixture: ComponentFixture<ActiveProject> = TestBed.createComponent(ActiveProject);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, component: fixture.componentInstance, el, text: () => (el.textContent || '').replace(/\s+/g, ' ') };
  }
  const P = (o: any = {}) => ({ id: 'p1', title: 'مشروع', status: 'pending', rawStatus: 'PENDING_SIGNATURE', funded: false, phase: 'awaiting_funding', progress: 0, provider: { name: 'مزود', initial: 'م' }, contract: 'CT-1', heldAmount: 0, nextStep: 'توقيع العقد وإيداع الضمان لبدء التنفيذ', completedStages: 0, stagesCount: 3, daysLeft: null, ...o });
  afterEach(() => TestBed.resetTestingModule());

  it('unfunded: never "running", nothing held, no countdown, opens the request to sign + fund', () => {
    const s = setup([P()]);
    expect(s.text()).toContain('بانتظار التوقيع');
    expect(s.text()).toContain('لا مبلغ محتجز بعد');
    expect(s.text()).toContain('لم يبدأ التنفيذ بعد');
    expect(s.text()).not.toContain('قيد التنفيذ مع');
    expect(s.text()).not.toContain('متبقية');
    expect(s.el.querySelector('.pl-badge')!.textContent!.trim()).not.toBe('قيد التنفيذ');
    expect(s.el.querySelector('a.pl-card')!.getAttribute('href')).toContain('/client-overview/my-requests/p1');
    expect(s.text()).toContain('إكمال التوقيع والضمان');
  });

  it('funded and waiting for the provider: shows the held money, says the provider signs next, and opens the project (nothing left for the client to sign)', () => {
    const s = setup([P({ funded: true, phase: 'awaiting_provider_signature', heldAmount: 900, nextStep: 'بانتظار توقيع مقدم الخدمة للعقد' })]);
    expect(s.el.querySelector('.pl-badge')!.textContent!.trim()).toBe('بانتظار توقيع مقدم الخدمة');
    expect(s.text()).toContain('محتجز 900 USD');
    expect(s.el.querySelector('a.pl-card')!.getAttribute('href')).toContain('/client-overview/projects/p1');
    expect(s.text()).not.toContain('إكمال التوقيع والضمان');
  });

  it('a pending project is not counted in "بانتظار مراجعتك" (that tab is for deliveries waiting for the client)', () => {
    const s = setup([P(), P({ id: 'p2', status: 'wait', rawStatus: 'IN_PROGRESS', funded: true, daysLeft: 5 })]);
    const tabs = s.component.tabs();
    expect(tabs.find(t => t.id === 'wait')!.count).toBe(1);
    expect(tabs.find(t => t.id === 'pending')!.count).toBe(1);
  });

  it('running: shows the real remaining days and the stage progress; late is told apart', () => {
    const s = setup([P({ id: 'r', status: 'run', rawStatus: 'IN_PROGRESS', funded: true, phase: 'running', progress: 40, completedStages: 1, stagesCount: 3, daysLeft: 6, heldAmount: 300 }), P({ id: 'l', status: 'late', rawStatus: 'IN_PROGRESS', funded: true, daysLeft: -2 })]);
    expect(s.text()).toContain('1 من 3 مراحل · 6 أيام متبقية');
    expect(s.text()).toContain('متأخر 2');
    expect(s.text()).toContain('40');
  });

  it('no invented compliance / version footer and no default "جيد" status', () => {
    const s = setup([]);
    expect(s.text()).not.toContain('SAMA'); expect(s.text()).not.toContain('PDPL'); expect(s.text()).not.toContain('v1.0.0');
    expect(s.component.kpis()[3].value).not.toBe('جيد');
  });
});
