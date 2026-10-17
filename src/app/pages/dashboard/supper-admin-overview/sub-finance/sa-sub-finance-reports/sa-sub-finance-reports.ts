import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ForecastSummaryComponent } from '../../sa-finance-reports/forecast-summary.component';
import { AdminFinanceOverview, AdminOpsApiService, saveBlob } from '../../../../../core/services/admin-ops-api.service';
import { errMsg, usd } from '../finance-ui';

type ExportName = 'transactions' | 'commissions' | 'invoices' | 'withdrawals';

@Component({
  selector: 'app-sa-sub-finance-reports',
  standalone: true,
  imports: [CommonModule, RouterLink, ForecastSummaryComponent],
  templateUrl: './sa-sub-finance-reports.html',
  styleUrl: './sa-sub-finance-reports.css',
})
export class SaSubFinanceReports implements OnInit {
  private api = inject(AdminOpsApiService);

  readonly usd = usd;
  readonly exports: { name: ExportName; title: string; desc: string }[] = [
    { name: 'transactions', title: 'المعاملات المالية', desc: 'كل حركات المحفظة: إيداعات وحجز وتحرير واسترداد' },
    { name: 'commissions', title: 'العمولات', desc: 'عمولة المنصة لكل مشروع وصافي مقدم الخدمة' },
    { name: 'invoices', title: 'الفواتير', desc: 'فواتير المراحل المشتقة من التسليمات' },
    { name: 'withdrawals', title: 'طلبات السحب', desc: 'طلبات السحب بجميع حالاتها' },
  ];

  overview = signal<AdminFinanceOverview | null>(null);
  loading = signal(true);
  error = signal('');
  busy = signal<ExportName | null>(null);
  exportError = signal('');

  kpis = computed(() => {
    const t = this.overview()?.totals;
    return t ? [
      { label: 'عمولة المنصة', value: usd(t.platformCommission) },
      { label: 'إجمالي المحرَّر', value: usd(t.releasedGross) },
      { label: 'الإيداعات', value: usd(t.depositsAmount) },
    ] : [];
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.financeOverview(12).subscribe({
      next: (res) => { this.overview.set(res.data ?? null); this.loading.set(false); },
      error: (err) => { this.error.set(errMsg(err, 'تعذر تحميل الملخص المالي')); this.loading.set(false); },
    });
  }

  download(name: ExportName) {
    if (this.busy()) return;
    this.busy.set(name);
    this.exportError.set('');
    this.api.downloadCsv(name).subscribe({
      next: (blob) => { saveBlob(blob, `${name}.csv`); this.busy.set(null); },
      error: (err) => { this.exportError.set(errMsg(err, 'تعذر تنزيل الملف')); this.busy.set(null); },
    });
  }

  print() {
    window.print();
  }
}
