import { MarketerLevelTagComponent } from '../../../../shared/levels/marketer-level-tag.component';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { commissionTypeLabel } from '../../../../core/utils/marketer-labels.util';
import { MarketerOverviewService, MarketerSummary, CommissionLog, MarketerWallet } from '../../../../core/services/marketer-overview.service';
import { handleLoadError } from '../../../../core/utils/rate-limit.util';
import { RouterLink } from '@angular/router';
import { WalletUnifyService } from '../../../../core/services/wallet-unify.service';
import { WalletBreakdownComponent, WalletBreakdownRow } from '../../../../shared/wallet/wallet-breakdown.component';
import { WalletCardItem, WalletExtraCardsComponent } from '../../../../shared/wallet/wallet-cards.component';

@Component({
  selector: 'app-commissions',
  standalone: true,
  imports: [WsDatePipe, MarketerLevelTagComponent, CommonModule, RouterLink, WalletBreakdownComponent, WalletExtraCardsComponent],
  templateUrl: './commissions.html',
  styleUrl: './commissions.css',
})
export class Commissions implements OnInit {
  private service = inject(MarketerOverviewService);
  private walletApi = inject(WalletUnifyService);

  /** the latest lines of «تفصيل المبالغ والخصومات» (commissions + withdrawals); the full list is the history page */
  historyRows = signal<WalletBreakdownRow[]>([]);
  historyFailed = signal(false);
  extraCards = computed<WalletCardItem[]>(() => {
    const c = this.wallet()?.cards;
    if (!c) return [];
    const pending = c.pendingWithdrawals?.state === 'AVAILABLE' && (c.pendingWithdrawals.value ?? 0) > 0 ? `بعد خصم سحوبات قيد المعالجة ${c.pendingWithdrawals.value}` : undefined;
    return [
      { key: 'gross', title: 'المبلغ قبل الخصومات', card: c.grossBeforeDeductions, tone: 'teal' },
      { key: 'available', title: 'المتاح للسحب', card: c.availableToWithdraw, tone: 'teal', sub: pending },
      { key: 'held', title: 'محجوز بالضمان', card: c.heldInEscrow, tone: 'amber' },
    ];
  });

  summary = signal<MarketerSummary | null>(null);
  commissions = signal<CommissionLog[]>([]);
  isLoading = signal(true);
  
  filterStatus = signal<string>('all');
  readonly commissionTypeLabel = commissionTypeLabel;
  loadFailed = signal(false);

  filteredCommissions = computed(() => {
    const status = this.filterStatus();
    const list = this.commissions();
    if (status === 'all') return list;
    return list.filter(log => log.status === status);
  });

  /** The server's own money figures (the same ones the withdraw page uses). */
  wallet = signal<MarketerWallet | null>(null);

  // "محجوزة" — commissions still pending confirmation, not yet released to the withdrawable balance.
  heldAmount = computed(() => this.wallet()?.pendingEarnings ?? 0);

  // "مسحوبة" — withdrawals really paid out (a commission is never flagged "paid" row by row: payouts are withdrawals).
  withdrawnAmount = computed(() => this.wallet()?.paidWithdrawals ?? 0);


  private amountInMonth(date: Date): number {
    return this.commissions()
      .filter(log => {
        const d = new Date(log.time);
        return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
      })
      .reduce((sum, log) => sum + (log.amount || 0), 0);
  }

  // "هذا الشهر" — real month-scoped total, computed from the loaded commission
  // log rather than reusing the all-time total.
  thisMonthAmount = computed(() => this.amountInMonth(new Date()));

  private lastMonthAmount = computed(() => {
    const now = new Date();
    return this.amountInMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  });

  // Real month-over-month delta instead of a hardcoded "+0%".
  monthDeltaPercentage = computed(() => {
    const last = this.lastMonthAmount();
    const current = this.thisMonthAmount();
    if (last === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - last) / last) * 100);
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    
    this.service.getSummary().subscribe({
      next: (res) => {
        if (res.success) {
          this.summary.set(res.data);
        }
      }
    });

    this.service.getWallet().subscribe({
      next: (res) => { if (res.success && res.data) this.wallet.set(res.data); },
      error: () => {}
    });

    this.walletApi.history('marketer', 1, 8).subscribe({
      next: res => {
        this.historyRows.set((res?.data?.items ?? []).map(it => ({
          id: it.id, title: it.title || '', date: it.createdAt?.slice(0, 10), link: ['/marketer-overview/commissions/history', it.id],
          breakdown: it.breakdown ?? null, storedAmount: it.amount, storedCurrency: it.currency,
        })));
      },
      error: () => this.historyFailed.set(true),
    });

    // Fetch up to 100 recent commissions for the log page
    this.service.getRecentCommissions(100).subscribe({
      next: (res) => {
        if (res.success) {
          this.commissions.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: (err) => handleLoadError(err, {
        hasData: () => this.commissions().length > 0,
        onKeep: () => this.isLoading.set(false),
        onRateLimit: () => { this.isLoading.set(false); this.loadFailed.set(true); },
        onOtherError: () => { this.isLoading.set(false); this.loadFailed.set(true); },
      })
    });
  }

  setFilter(status: string) {
    this.filterStatus.set(status);
  }
}
