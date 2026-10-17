import { isRateLimitError } from '../../../../core/utils/rate-limit.util';
import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../../../core/store/auth.store';
import { ProviderApiService, ProviderReportRange, ProviderReports } from '../../../../core/services/provider-api.service';
import { AccountType } from '../../../../core/models/auth.model';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html'
})
export class Reports implements OnInit {
  private authStore = inject(AuthStore);
  private providerApi = inject(ProviderApiService);
  private notify = inject(UiNotificationService);

  /** Real provider statistics (GET /provider/statistics) — the only source behind this page's KPI cards. */
  stats = signal<{ summary?: { monthlyEarnings?: number; humanRating?: number | null } } | null>(null);

  /** Real provider reports (GET /provider/reports) for the selected range. */
  reports = signal<ProviderReports | null>(null);
  reportsLoading = signal<boolean>(true);
  reportsError = signal<string>('');

  ngOnInit() {
    this.providerApi.getProviderStatistics().subscribe({
      next: (res: any) => this.stats.set(res?.success ? res.data : null),
      error: (e) => { if (!isRateLimitError(e)) this.stats.set(null); }
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
  
  /** CSV of the data currently loaded on the page (GET /provider/reports for the selected range) — no server file involved. */
  exportCsv() {
    const r = this.reports();
    if (!r) { this.notify.warning('لا توجد بيانات محمّلة للتصدير بعد'); return; }
    const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const row = (cells: unknown[]) => cells.map(esc).join(',');
    const lines: string[] = [
      row(['الفترة', this.periods.find(p => p.id === r.range)?.label ?? r.range]),
      '',
      row(['طلبات العملاء']),
      row(['العنوان', 'التخصص', 'السعر', 'الحالة', 'التاريخ']),
      ...r.requests.items.map(i => row([i.title, i.specialty, i.price, this.bucketLabel(i.bucket), i.createdAt?.slice(0, 10)])),
      '',
      row(['المعاملات المالية']),
      row(['الوصف', 'النوع', 'المبلغ', 'العملة', 'الحالة', 'التاريخ']),
      ...r.payments.transactions.map(t => row([t.description, t.type, t.amount, t.currency, t.status, t.createdAt?.slice(0, 10)])),
      '',
      row(['النزاعات']),
      row(['السبب', 'الحالة', 'التاريخ']),
      ...r.disputes.items.map(d => row([d.reason, d.status, d.createdAt?.slice(0, 10)])),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `waseet-provider-report-${r.range}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.notify.success('تم تنزيل ملف CSV');
  }

  /** PDF = the browser's print dialog ("Save as PDF"); a server-generated PDF would need a dedicated endpoint. */
  printReport() {
    window.print();
  }
}
