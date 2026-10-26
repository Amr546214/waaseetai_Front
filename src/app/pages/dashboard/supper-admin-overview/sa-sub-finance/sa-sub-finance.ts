import { WsCurrencyPipe } from '../../../../shared/money/money.pipe';
import { formatMoneyIn } from '../../../../core/utils/currency';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminFinanceOverview, AdminOpsApiService, AdminTransaction, saveBlob } from '../../../../core/services/admin-ops-api.service';
import { bucket, errMsg, fmtDate, pct, seriesBars, txParty, txStatusLabel, txTypeLabel, fmtAmount } from '../sub-finance/finance-ui';

@Component({
  selector: 'app-sa-sub-finance',
  standalone: true,
  imports: [WsCurrencyPipe, WsDatePipe, CommonModule, RouterLink],
  templateUrl: './sa-sub-finance.html',
  styleUrl: './sa-sub-finance.css',
})
export class SaSubFinance implements OnInit {
  private api = inject(AdminOpsApiService);

  readonly fmtAmount = fmtAmount;
  readonly fmtDate = fmtDate;
  readonly pct = pct;
  readonly txTypeLabel = txTypeLabel;
  readonly txStatusLabel = txStatusLabel;
  readonly txParty = txParty;

  overview = signal<AdminFinanceOverview | null>(null);
  loading = signal(true);
  error = signal('');
  transactions = signal<AdminTransaction[]>([]);
  txLoading = signal(true);
  txError = signal('');
  updatedAt = signal<Date | null>(null);
  downloading = signal(false);
  downloadError = signal('');

  bars = computed(() => seriesBars(this.overview()));
  /** per-currency lines, only when the platform holds more than one currency (the KPIs above are the headline currency) */
  currencyRows = computed(() => { const o = this.overview(); return o?.mixedCurrencies && o.byCurrency ? Object.entries(o.byCurrency).map(([currency, v]) => ({ currency, ...v })) : []; });
  readonly money = formatMoneyIn;
  pendingWithdrawals = computed(() => bucket(this.overview()?.withdrawals, 'PENDING'));
  breakdown = computed(() => {
    const t = this.overview()?.totals;
    if (!t) return [];
    const share = (v: number) => (t.releasedGross > 0 ? Math.round((v / t.releasedGross) * 1000) / 10 : 0);
    return [
      { name: 'عمولة المنصة', amount: fmtAmount(t.platformCommission), percent: share(t.platformCommission), showPct: t.releasedGross > 0, color: 'linear-gradient(90deg,#2BD4C7,#2B7FFF)' },
      { name: 'صافي مقدمي الخدمة', amount: fmtAmount(t.providerNetReleased), percent: share(t.providerNetReleased), showPct: t.releasedGross > 0, color: '#5DA0FF' },
      { name: 'رسوم بوابة الدفع (تكلفة مدفوعات — ليست إيرادًا)', amount: fmtAmount(t.paymentGatewayFees), percent: 0, showPct: false, color: '#D98A0B' },
    ];
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.txLoading.set(true);
    this.txError.set('');
    this.api.financeOverview(6).subscribe({
      next: (res) => { this.overview.set(res.data ?? null); this.updatedAt.set(new Date()); this.loading.set(false); },
      error: (err) => { this.error.set(errMsg(err, 'تعذر تحميل الملخص المالي')); this.loading.set(false); },
    });
    this.api.financeTransactions({ limit: 5 }).subscribe({
      next: (res) => { this.transactions.set(res.data?.items ?? []); this.txLoading.set(false); },
      error: (err) => { this.txError.set(errMsg(err, 'تعذر تحميل آخر الحركات')); this.txLoading.set(false); },
    });
  }

  print() {
    window.print();
  }

  downloadCsv() {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.downloadError.set('');
    this.api.downloadCsv('transactions').subscribe({
      next: (blob) => { saveBlob(blob, 'transactions.csv'); this.downloading.set(false); },
      error: (err) => { this.downloadError.set(errMsg(err, 'تعذر تنزيل الملف')); this.downloading.set(false); },
    });
  }
}
