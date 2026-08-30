import { computed, inject, Injectable, signal } from '@angular/core';
import { DashboardStatsPayload } from '../models/dashboard.model';
import { DashboardApiService } from '../services/dashboard-api.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DashboardStore {
  private dashboardApiService = inject(DashboardApiService);

  // Core Signals
  private readonly _dashboardData = signal<DashboardStatsPayload | null>(null);
  private readonly _isLoadingDashboard = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  // Computed Selectors
  readonly dashboardData = this._dashboardData.asReadonly();
  readonly isLoadingDashboard = this._isLoadingDashboard.asReadonly();
  readonly error = this._error.asReadonly();

  // Project state
  private readonly _totalActiveRequestsCount = signal<number>(0);
  readonly totalActiveRequestsCount = this._totalActiveRequestsCount.asReadonly();

  setTotalActiveRequestsCount(count: number) {
    this._totalActiveRequestsCount.set(count);
  }

  // Easy access computed signals
  readonly activeContract = computed(() => {
    const data = this._dashboardData();
    if (!data) return null;

    // 1. If backend supplies real activeContract object, use it directly
    if ((data as any).activeContract !== undefined) {
      return (data as any).activeContract;
    }

    // 2. Fallback: Only match projects that are strictly IN_PROGRESS or COMPLETED
    if (!data.latestProjects || data.latestProjects.length === 0) return null;
    const project = data.latestProjects.find(p => p.status === 'IN_PROGRESS' || p.status === 'COMPLETED');
    if (!project) return null; // Returns null for OPEN, SUBMITTED, or draft projects!

    return {
      title: project.title,
      provider: 'مقدم خدمة موثق',
      requestId: `#${project.id.substring(0, 4)}`,
      amount: project.budget,
      progress: project.status === 'COMPLETED' ? 100 : 0,
      statusText: project.status === 'IN_PROGRESS' ? 'العقد النشط' : project.status
    };
  });

  /**
   * Fetch dashboard statistics
   */
  public async fetchDashboardStats(): Promise<void> {
    this._isLoadingDashboard.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(this.dashboardApiService.getDashboardStats());
      if (response.success && response.data) {
        this._dashboardData.set(response.data);
      }
    } catch (err: any) {
      this._error.set(err?.error?.message || 'Failed to load dashboard data');
    } finally {
      this._isLoadingDashboard.set(false);
    }
  }
}
