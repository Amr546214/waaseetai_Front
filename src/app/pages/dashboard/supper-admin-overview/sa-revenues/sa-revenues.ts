import { WsCurrencyPipe } from '../../../../shared/money/money.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { CommonModule } from '@angular/common';
import { AdminFinanceOverview, AdminOpsApiService, AdminPagination, AdminTransaction, saveBlob } from '../../../../core/services/admin-ops-api.service';
import { bucket, errMsg, fmtDate, monthLabel, pct, seriesBars, txParty, txStatusClass, txStatusLabel, txTypeLabel, fmtAmount } from '../sub-finance/finance-ui';

type Months = 3 | 6 | 12;

@Component({
  selector: 'app-sa-revenues',
  standalone: true,
  imports: [WsCurrencyPipe, WsDatePipe, CommonModule],
  templateUrl: './sa-revenues.html',
  styleUrl: './sa-revenues.css',
})
export class SaRevenues implements OnInit {
  private api = inject(AdminOpsApiService);

  readonly periods: { key: Months; label: string }[] = [
    { key: 3, label: '3 أشهر' },
    { key: 6, label: '6 أشهر' },
    { key: 12, label: 'سنة' },
  ];
  readonly fmtAmount = fmtAmount;
  readonly fmtDate = fmtDate;
  readonly monthLabel = monthLabel;
  readonly txTypeLabel = txTypeLabel;
  readonly txStatusLabel = txStatusLabel;
  readonly txStatusClass = txStatusClass;
  readonly txParty = txParty;
  readonly pct = pct;

  months = signal<Months>(6);
  overview = signal<AdminFinanceOverview | null>(null);
  overviewLoading = signal(true);
  overviewError = signal('');
  updatedAt = signal<Date | null>(null);

  txType = signal('');
  txPage = signal(1);
  txItems = signal<AdminTransaction[]>([]);
  typeCounts = signal<Record<string, number>>({});
  txPagination = signal<AdminPagination | null>(null);
  txLoading = signal(true);
  txError = signal('');
  exporting = signal(false);
  exportError = signal('');

  bars = computed(() => seriesBars(this.overview()));
  tabs = computed(() => {
    const c = this.typeCounts();
    const total = Object.values(c).reduce((s, n) => s + n, 0);
    return [{ key: '', label: 'الكل', count: total }, ...Object.keys(c).map((k) => ({ key: k, label: txTypeLabel(k), count: c[k] }))];
  });
  pendingWithdrawals = computed(() => bucket(this.overview()?.withdrawals, 'PENDING'));
  /** Releases split: real platform commission vs provider net, as shares of released gross. */
  split = computed(() => {
    const t = this.overview()?.totals;
    if (!t || t.releasedGross <= 0) return [];
    const circ = 238.8;
    const parts = [
      { label: 'عمولة المنصة', value: t.platformCommission, color: '#2BD4C7' },
      { label: 'صافي مقدمي الخدمة', value: t.providerNetReleased, color: '#5DA0FF' },
    ];
    let cum = 0;
    return parts.map((p) => {
      const share = (p.value / t.releasedGross) * 100;
      const dashArray = `${(share / 100) * circ} ${circ}`;
      const dashOffset = -(cum / 100) * circ;
      cum += share;
      return { ...p, share, dashArray, dashOffset };
    });
  });
  /** Newest month first, for the monthly table. */
  monthRows = computed(() => [...(this.overview()?.series ?? [])].reverse());
  /** Real month-over-month change of released gross (last two months of the series), null when not computable. */
  momChange = computed(() => {
    const s = this.overview()?.series ?? [];
    if (s.length < 2) return null;
    const cur = s[s.length - 1].releasedGross;
    const prev = s[s.length - 2].releasedGross;
    if (prev <= 0) return null;
    return ((cur - prev) / prev) * 100;
  });

  ngOnInit() {
    this.loadOverview();
    this.loadTransactions();
  }

  setPeriod(m: Months) {
    this.months.set(m);
    this.loadOverview();
  }

  loadOverview() {
    this.overviewLoading.set(true);
    this.overviewError.set('');
    this.api.financeOverview(this.months()).subscribe({
      next: (res) => {
        this.overview.set(res.data ?? null);
        this.updatedAt.set(new Date());
        this.overviewLoading.set(false);
      },
      error: (err) => {
        this.overviewError.set(errMsg(err, 'تعذر تحميل الملخص المالي'));
        this.overviewLoading.set(false);
      },
    });
  }

  loadTransactions() {
    this.txLoading.set(true);
    this.txError.set('');
    this.api.financeTransactions({ type: this.txType() || undefined, page: this.txPage(), limit: 10 }).subscribe({
      next: (res) => {
        this.txItems.set(res.data?.items ?? []);
        this.typeCounts.set(res.data?.typeCounts ?? {});
        this.txPagination.set(res.data?.pagination ?? null);
        this.txLoading.set(false);
      },
      error: (err) => {
        this.txError.set(errMsg(err, 'تعذر تحميل المعاملات'));
        this.txLoading.set(false);
      },
    });
  }

  setTxnTab(t: string) {
    this.txType.set(t);
    this.txPage.set(1);
    this.loadTransactions();
  }

  totalPages(): number {
    const p = this.txPagination();
    return p?.totalPages ?? p?.pages ?? 1;
  }
  prevPage() {
    if (this.txPage() > 1) { this.txPage.update((v) => v - 1); this.loadTransactions(); }
  }
  nextPage() {
    if (this.txPage() < this.totalPages()) { this.txPage.update((v) => v + 1); this.loadTransactions(); }
  }

  exportCsv() {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set('');
    this.api.downloadCsv('transactions', { type: this.txType() || undefined }).subscribe({
      next: (blob) => { saveBlob(blob, 'transactions.csv'); this.exporting.set(false); },
      error: (err) => { this.exportError.set(errMsg(err, 'تعذر تصدير الملف')); this.exporting.set(false); },
    });
  }

  print() {
    window.print();
  }
}
