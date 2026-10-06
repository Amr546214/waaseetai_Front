import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../../../core/store/auth.store';
import { ProviderApiService, ProviderReportRange, ProviderReports } from '../../../../core/services/provider-api.service';
import { AccountType } from '../../../../core/models/auth.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html'
})
export class Reports implements OnInit {
  private authStore = inject(AuthStore);
  private providerApi = inject(ProviderApiService);

  /** Real provider statistics (GET /provider/statistics) — the only source behind this page's KPI cards. */
  stats = signal<{ summary?: { monthlyEarnings?: number; humanRating?: number } } | null>(null);

  /** Real provider reports (GET /provider/reports) for the selected range. */
  reports = signal<ProviderReports | null>(null);
  reportsLoading = signal<boolean>(true);
  reportsError = signal<string>('');

  ngOnInit() {
    this.providerApi.getProviderStatistics().subscribe({
      next: (res: any) => this.stats.set(res?.success ? res.data : null),
      error: () => this.stats.set(null)
    });
    this.loadReports();
  }

  loadReports() {
    this.reportsLoading.set(true);
    this.reportsError.set('');
    this.providerApi.getProviderReports(this.currentPeriod() as ProviderReportRange).subscribe({
      next: res => { this.reports.set(res?.success ? res.data ?? null : null); this.reportsLoading.set(false); },
      error: err => { this.reports.set(null); this.reportsLoading.set(false); this.reportsError.set(err?.error?.message || 'تعذّر تحميل التقارير'); }
    });
  }

  periods: Array<{ id: ProviderReportRange; label: string }> = [
    { id: 'month', label: 'هذا الشهر' }, { id: '3m', label: '3 أشهر' }, { id: '6m', label: '6 أشهر' }, { id: 'year', label: 'هذا العام' }, { id: 'all', label: 'الكل' }
  ];

  orderBuckets: Array<{ id: string; label: string }> = [
    { id: 'all', label: 'الكل' }, { id: 'pending', label: 'بانتظار الرد' }, { id: 'accepted', label: 'مقبول' }, { id: 'rejected', label: 'مرفوض' }, { id: 'cancelled', label: 'ملغي' }
  ];
  bucketLabel(b: string): string { return this.orderBuckets.find(x => x.id === b)?.label ?? '—'; }
  bucketCount(id: string): number | null {
    const r = this.reports();
    if (!r) return null;
    return id === 'all' ? r.requests.total : (r.requests.byStatus as any)[id] ?? 0;
  }
  filteredRequests = computed(() => {
    const r = this.reports();
    const f = this.orderStatus();
    return (r?.requests.items ?? []).filter(i => f === 'all' || i.bucket === f);
  });

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  // No team-performance / payouts / dispute-resolution-rate endpoint exists yet (the team tab shows "لا توجد بيانات بعد").
  teamPerformance: Array<{
    name: string;
    role: string;
    level: string;
    projects: number;
    rating: number;
    onTime: number;
    revenue: string;
    status: 'active' | 'delay';
  }> = [];  // no team-member model / team-performance endpoint exists, so no invented members are shown

  providerPayoutsTotal: string | null = null;
  providerPayoutsTrend: string | null = null;
  disputeResolutionProviderRate: number | null = null;

  // Tab badges come from GET /provider/reports; "—" until it loads.
  tabs = computed(() => {
    const r = this.reports();
    const list: Array<{ id: string; label: string; icon: string; count: number | null }> = [
      { id: 'orders', label: 'طلبات العملاء', icon: 'list', count: r ? r.requests.total : null }
    ];
    if (this.isCompanyMode()) {
      list.push({ id: 'team', label: 'أداء الفريق', icon: 'team', count: null });
    }
    list.push(
      { id: 'projects', label: 'مشاريعي', icon: 'doc', count: r ? r.projects.totalCount : null },
      { id: 'finance', label: 'إيراداتي', icon: 'wallet', count: r ? r.payments.transactions.length : null },
      { id: 'disputes', label: 'النزاعات', icon: 'dispute', count: r ? r.disputes.counts.all : null }
    );
    return list;
  });

  currentTab = signal<string>('orders');
  currentPeriod = signal<string>('month');
  showDatePicker = signal<boolean>(false);
  showToast = signal<string>('');
  
  // Filters
  orderStatus = signal<string>('all');
  projStatus = signal<string>('all');
  projRating = signal<string>('all');
  projDuration = signal<string>('all');
  finType = signal<string>('all');
  finStatus = signal<string>('all');
  dispStatus = signal<string>('all');
  dispReason = signal<string>('all');
  
  setTab(tab: string) {
    this.currentTab.set(tab);
  }
  
  setPeriod(period: string) {
    this.currentPeriod.set(period);
    this.loadReports();
  }
  
  openToast(msg: string) {
    this.showToast.set(msg);
    setTimeout(() => this.showToast.set(''), 3000);
  }
}
