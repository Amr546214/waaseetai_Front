import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ClientOverviewComponent } from './client-overview.component';
import { DashboardStore } from '../../../../core/store/dashboard.store';
import { AuthStore } from '../../../../core/store/auth.store';
import { CompanyDashboardApiService } from '../../../../core/services/company-dashboard-api.service';

describe('company dashboard API integration', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('renders real company data and keeps unavailable budgets distinct from zero', () => {
    TestBed.configureTestingModule({ imports: [ClientOverviewComponent], providers: [
      provideRouter([]),
      { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_COMPANY', id: 'co-1' }) } },
      { provide: DashboardStore, useValue: {} },
      { provide: CompanyDashboardApiService, useValue: { getCompanyDashboard: () => of({ success: true, data: {
        companyName: 'شركة الاختبار', companyBadge: '', profileCompletionPercent: 100,
        kpis: { remainingBudget: null, activeEmployees: 2, activeEmployeesTotal: 3, quarterSpend: 13.25, activeTeamProjects: 4, activeTeamProjectsMembers: 1, pendingYourApproval: null },
        quarterBudget: null, actionCards: [], levelProgress: { points: 25, nextLevelPoints: 101, currentLevel: 1, levelLabel: 'مسوق' },
        walletBalance: 42.75, employeeSpending: [], aiInsight: '', pendingApprovals: [], recentTeamRequests: [], recentActivity: [], pendingProfileCompletionRequired: false
      } }) } }
    ] });
    const fixture = TestBed.createComponent(ClientOverviewComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.co-dash')).not.toBeNull();
    expect(host.querySelector('#state-error-co')).toBeNull();
    expect(host.textContent).toContain('شركة الاختبار');
    expect(host.textContent).toContain('ميزانية الربع غير محددة');
    expect(host.querySelectorAll('.co-kpi-val')[0].textContent?.trim()).toBe('—');
    expect(host.querySelectorAll('.co-kpi-val')[1].textContent?.trim()).toBe('2');
    expect(host.querySelectorAll('.co-kpi-val')[4].textContent?.trim()).toBe('—');
    expect(host.querySelector('.co-level-lbl')?.textContent).toContain('مسوق');
    expect(fixture.componentInstance.companyLevelProgressPercent(200, 100)).toBe(100);
    expect(fixture.componentInstance.companyLevelProgressPercent(0, 0)).toBe(100);
  });
});
