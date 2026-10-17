import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ForecastSummaryComponent } from './forecast-summary.component';
import { AdminFinanceOverview, AdminOpsApiService, saveBlob } from '../../../../core/services/admin-ops-api.service';
import { errMsg, monthLabel, pct, seriesBars, usd } from '../sub-finance/finance-ui';

type ReportTab = 'overview' | 'revenue' | 'expenses' | 'profit';

@Component({
  selector: 'app-sa-finance-reports',
  standalone: true,
  imports: [CommonModule, ForecastSummaryComponent],
  templateUrl: './sa-finance-reports.html',
  styleUrl: './sa-finance-reports.css',
})
export class SaFinanceReports implements OnInit {
  private api = inject(AdminOpsApiService);

  readonly usd = usd;
  readonly pct = pct;
  readonly monthLabel = monthLabel;
  readonly noExpensesMsg = 'لا يوجد سجل مصروفات في المنصة بعد — لا تُعرض أرقام تقديرية';

  activeTab = signal<ReportTab>('overview');
  overview = signal<AdminFinanceOverview | null>(null);
  loading = signal(true);
  error = signal('');
  exporting = signal(false);
  exportError = signal('');

  readonly tabs: { key: ReportTab; label: string }[] = [
    { key: 'overview', label: 'نظرة عامة' },
    { key: 'revenue', label: 'الإيرادات' },
    { key: 'expenses', label: 'المصروفات' },
    { key: 'profit', label: 'الأرباح' },
  ];

  bars = computed(() => seriesBars(this.overview()));
  monthRows = computed(() => [...(this.overview()?.series ?? [])].reverse());
  /** Real shares of released gross: platform commission vs provider net. */
  distribution = computed(() => {
    const t = this.overview()?.totals;
    if (!t || t.releasedGross <= 0) return [];
    return [
      { label: 'عمولة المنصة', value: t.platformCommission, pct: Math.round((t.platformCommission / t.releasedGross) * 1000) / 10, color: '#2BD4C7' },
      { label: 'صافي مقدمي الخدمة', value: t.providerNetReleased, pct: Math.round((t.providerNetReleased / t.releasedGross) * 1000) / 10, color: '#5DA0FF' },
    ];
  });
  affiliateRows = computed(() => {
    const a = this.overview()?.affiliateCommissions ?? {};
    return [
      { key: 'PENDING', label: 'قيد المراجعة' },
      { key: 'APPROVED', label: 'معتمدة' },
      { key: 'PAID', label: 'مدفوعة' },
    ].map((r) => ({ ...r, count: a[r.key]?.count ?? 0, amount: a[r.key]?.amount ?? 0 }));
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.financeOverview(12).subscribe({
      next: (res) => { this.overview.set(res.data ?? null); this.loading.set(false); },
      error: (err) => { this.error.set(errMsg(err, 'تعذر تحميل التقارير المالية')); this.loading.set(false); },
    });
  }

  setTab(t: ReportTab) {
    this.activeTab.set(t);
  }

  print() {
    window.print();
  }

  exportCsv() {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set('');
    this.api.downloadCsv('commissions').subscribe({
      next: (blob) => { saveBlob(blob, 'commissions.csv'); this.exporting.set(false); },
      error: (err) => { this.exportError.set(errMsg(err, 'تعذر تصدير الملف')); this.exporting.set(false); },
    });
  }
}
