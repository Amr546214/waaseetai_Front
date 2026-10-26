import { WsCurrencyPipe } from '../../../../../shared/money/money.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminCommissionsData, AdminOpsApiService, saveBlob } from '../../../../../core/services/admin-ops-api.service';
import { LevelsService } from '../../../../../core/levels/levels.service';
import { errMsg, fmtDate, fmtAmount } from '../finance-ui';

@Component({
  selector: 'app-sa-commissions',
  standalone: true,
  imports: [WsCurrencyPipe, CommonModule],
  templateUrl: './sa-commissions.html',
  styleUrl: './sa-commissions.css',
})
export class SaCommissions implements OnInit {
  private api = inject(AdminOpsApiService);
  private levels = inject(LevelsService);

  readonly fmtAmount = fmtAmount;
  readonly fmtDate = fmtDate;
  readonly editReason = 'نسب العمولة تُدار من جداول المستويات في النظام ولا تُعدَّل من هذه الصفحة';
  readonly escrowLabels: Record<string, string> = { HELD: 'محجوز', RELEASED: 'محرَّر', REFUNDED: 'مُسترد' };

  data = signal<AdminCommissionsData | null>(null);
  page = signal(1);
  loading = signal(true);
  error = signal('');
  exporting = signal(false);
  exportError = signal('');

  affiliateRows = computed(() => {
    const a = this.data()?.affiliate ?? {};
    return [
      { key: 'PENDING', label: 'قيد المراجعة' },
      { key: 'APPROVED', label: 'معتمدة' },
      { key: 'PAID', label: 'مدفوعة' },
    ].map((r) => ({ ...r, count: a[r.key]?.count ?? 0, amount: a[r.key]?.amount ?? 0 }));
  });

  /** Real percentage ladders from GET /levels (marketer commission and provider platform fee). */
  ladders = computed(() => {
    const p = this.levels.payload();
    if (!p) return null;
    const fmt = (r: 'MARKETER' | 'PROVIDER') => {
      const ls = p.roles[r]?.levels ?? [];
      if (!ls.length) return null;
      const ps = ls.map((l) => l.percent);
      return { min: Math.min(...ps), max: Math.max(...ps), levels: ls.map((l) => ({ level: l.level, name: l.name, percent: l.percent })) };
    };
    return { marketer: fmt('MARKETER'), provider: fmt('PROVIDER') };
  });

  constructor() { this.levels.ensureLoaded(); }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.financeCommissions({ page: this.page(), limit: 20 }).subscribe({
      next: (res) => { this.data.set(res.data ?? null); this.loading.set(false); },
      error: (err) => { this.error.set(errMsg(err, 'تعذر تحميل العمولات')); this.loading.set(false); },
    });
  }

  totalPages(): number {
    const p = this.data()?.pagination;
    return p?.totalPages ?? p?.pages ?? 1;
  }
  prevPage() { if (this.page() > 1) { this.page.update((v) => v - 1); this.load(); } }
  nextPage() { if (this.page() < this.totalPages()) { this.page.update((v) => v + 1); this.load(); } }

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
