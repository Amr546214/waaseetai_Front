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
});
