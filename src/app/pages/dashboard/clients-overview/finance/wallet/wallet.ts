import { LoadRetryComponent } from '../../../../../sheards/load-retry/load-retry';
import { providerTimeZone } from '../../../../../core/services/provider-prefs.store';
import { RateLimitNoteComponent } from '../../../../../sheards/load-retry/rate-limit-note';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DepositModal } from '../../../../../sheards/deposit-modal/deposit-modal';
import { ClientFinanceService, ClientWalletData, ClientWalletEmployeeSpend } from '../../../../../core/services/client-finance.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { handleLoadError } from '../../../../../core/utils/rate-limit.util';
import { formatMoney } from '../../../../../core/utils/money.util';
import { WalletBreakdown, WalletCard } from '../../../../../core/models/wallet-unify.model';
import { WalletBreakdownComponent, WalletBreakdownRow } from '../../../../../shared/wallet/wallet-breakdown.component';
import { WalletCardItem, WalletExtraCardsComponent } from '../../../../../shared/wallet/wallet-cards.component';

export interface DisplayTransaction {
  id: string;
  referenceId?: string;
  title: string;
  description: string;
  date: string;
  amount: string;
  direction: 'in' | 'out';
  status: string;
  statusType: 'done' | 'hold' | 'pending' | 'failed';
  icon: 'escrow' | 'wallet';
  employeeName?: string;
  breakdown?: WalletBreakdown;
  rawAmount: number;
  currency: string;
  createdAt: string;
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, RouterLink, DepositModal, LoadRetryComponent, RateLimitNoteComponent, WalletBreakdownComponent, WalletExtraCardsComponent],
  templateUrl: './wallet.html',
  styleUrl: './wallet.css',
})
export class Wallet implements OnInit {
  private clientFinanceService = inject(ClientFinanceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authStore = inject(AuthStore);

  readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

  isDepositModalOpen = signal(false);
  isLoading = signal(true);
  hasError = signal(false);

  balance = signal(0);
  escrowBalance = signal(0);
  activeProjectsCount = signal(0);
  transactions = signal<DisplayTransaction[]>([]);

  /** the cards of the stored wallet (null on an older server: the page then shows the states, not zeros) */
  cards = signal<{ grossBeforeDeductions?: WalletCard; cashback?: WalletCard } | null>(null);
  /** the extra row: amount before deductions, and the cashback state (an individual client; a company shows its quarter spend in the main grid) */
  extraCards = computed<WalletCardItem[]>(() => {
    const c = this.cards();
    const items: WalletCardItem[] = [{ key: 'gross', title: 'المبلغ قبل الخصومات (إيداعات)', card: c?.grossBeforeDeductions, tone: 'teal' }];
    if (this.isCompany()) items.push({ key: 'cashback', title: 'كاش باك الولاء', card: c?.cashback, tone: 'teal' });
    return items;
  });
  /** the latest operations in «تفصيل المبالغ والخصومات»; the full list is the history page */
  breakdownRows = computed<WalletBreakdownRow[]>(() => this.transactions().slice(0, 8).map(t => ({
    id: t.id, title: t.employeeName ? `${t.title} · ${t.employeeName}` : t.title, date: t.date, link: ['/client-overview/finance/wallet', t.id], breakdown: t.breakdown ?? null, storedAmount: Math.abs(t.rawAmount), storedCurrency: t.currency,
  })));

  /** the company quarter figures exist only when the server sends them: otherwise the card says so instead of 0 */
  quarterKnown = signal(false);
  quarterSpend = signal(0);
  quarterBudget = signal(0);
  employeeSpending = signal<ClientWalletEmployeeSpend[]>([]);

  quarterBudgetPercent = computed(() => {
    const total = this.quarterBudget();
    if (total <= 0) return 0;
    return Math.min(100, Math.round((this.quarterSpend() / total) * 100));
  });

  employeeSpendBarWidth(amount: number): number {
    const max = Math.max(...this.employeeSpending().map(e => e.amount), 1);
    return Math.max(4, Math.round((amount / max) * 100));
  }

  availableRatio = computed(() => {
    const avail = this.balance();
    const total = avail + this.escrowBalance();
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((avail / total) * 100)));
  });

  // Loyalty cashback is not computed anywhere in the backend (REQUESTER_LEVEL_MATRIX.rate in progression-calculators.ts is
  // defined but never used or credited), so the wallet shows no cashback amount instead of an invented 3% of the balance.

  ngOnInit() {
    this.loadWalletData();
  }

  /** a 429 with nothing loaded / a 429 while the wallet is shown (data kept) */
  rateLimited = signal(false);
  rateLimitKept = signal(false);

  loadWalletData(onLoaded?: () => void) {
    this.isLoading.set(true);
    this.hasError.set(false); this.rateLimited.set(false); this.rateLimitKept.set(false);

    this.clientFinanceService.getWallet().subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.applyWalletData(res.data);
          onLoaded?.();
        } else {
          this.hasError.set(true);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load client wallet:', err);
        handleLoadError(err, {
          hasData: () => this.walletLoaded,
          onKeep: () => { this.rateLimitKept.set(true); this.isLoading.set(false); },
          onRateLimit: () => { this.hasError.set(true); this.rateLimited.set(true); this.isLoading.set(false); },
          onOtherError: () => { this.hasError.set(true); this.isLoading.set(false); },
        });
      }
    });
  }

  private walletLoaded = false;

  private applyWalletData(data: ClientWalletData) {
    this.walletLoaded = true;
    this.balance.set(data.summary?.availableBalance ?? 0);
    this.escrowBalance.set(data.summary?.escrowBalance ?? 0);
    this.activeProjectsCount.set(data.summary?.activeProjectsCount ?? 0);
    this.quarterKnown.set(data.summary?.quarterSpend != null && data.summary?.quarterBudget != null);
    this.quarterSpend.set(data.summary?.quarterSpend ?? 0);
    this.quarterBudget.set(data.summary?.quarterBudget ?? 0);
    this.employeeSpending.set(data.employeeSpending ?? []);
    this.cards.set(data.summary?.cards ?? null);

    if (data.transactions && data.transactions.length > 0) {
      const mapped = data.transactions.map(tx => {
        const isDeposit = tx.type === 'DEPOSIT';
        const isEscrow = tx.type === 'ESCROW_LOCK';
        const isDone = tx.status === 'COMPLETED';
        const isHeld = tx.status === 'HELD';
        const isFailed = tx.status === 'FAILED';

        // A refund returns money to the wallet, like a deposit.
        const direction: 'in' | 'out' = isDeposit || tx.type === 'REFUND' || tx.type === 'AMENDMENT_REFUND' ? 'in' : 'out';
        const statusType: 'done' | 'hold' | 'pending' | 'failed' = isFailed ? 'failed' : (isDone ? 'done' : (isHeld ? 'hold' : 'pending'));
        const statusText = isFailed ? 'فشلت' : (isDone ? 'مكتمل' : (isHeld ? 'محجوز' : 'قيد المعالجة'));
        const icon: 'escrow' | 'wallet' = isEscrow ? 'escrow' : 'wallet';

        const formattedDate = new Date(tx.createdAt).toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit', timeZone: providerTimeZone() });

        // A failed attempt moved no money: no sign. A recorded payment is stored negative (ORDER_PAYMENT), so the sign is shown once, from the direction.
        const sign = isFailed ? '' : (direction === 'in' ? '+' : '-');
        // Each transaction shows its own recorded currency: USD as '$'; a legacy row in any other currency shows no
        // currency symbol at all (never an old riyal label).
        const currencyLabel = tx.currency === 'USD' ? '$' : '';

        return {
          id: tx.id,
          referenceId: tx.referenceId,
          title: tx.description || (isDeposit ? 'إيداع رصيد بالمحفظة' : 'معاملة مالية'),
          description: tx.referenceId ? `رقم العملية ${tx.referenceId}` : (tx.paymentMethod || 'محفظة وسيط AI'),
          date: formattedDate,
          amount: `${sign}${formatMoney(Math.abs(tx.amount))}${currencyLabel ? ' ' + currencyLabel : ''}`,
          direction,
          status: statusText,
          statusType,
          icon,
          employeeName: tx.employeeName,
          breakdown: tx.breakdown,
          rawAmount: tx.amount,
          currency: tx.currency,
          createdAt: tx.createdAt
        } as DisplayTransaction;
      });

      this.transactions.set(mapped);
    } else {
      this.transactions.set([]);
    }
  }

  openDepositModal() {
    this.isDepositModalOpen.set(true);
  }

  closeDepositModal() {
    this.isDepositModalOpen.set(false);
  }

  onDepositComplete(payment: { amount: number; reference: string; method: string }) {
    this.closeDepositModal();
    // Open the resulting transaction's details instead of just closing the
    // modal — WalletTransaction.referenceId is set server-side to the same
    // gateway reference this event carries (PayPal
    // capture id), so the freshly reloaded list can be matched against it.
    // If no match is found (e.g. the transaction hasn't posted yet), stay on
    // the wallet page rather than navigating somewhere wrong.
    this.loadWalletData(() => {
      const tx = this.transactions().find(t => t.referenceId === payment.reference);
      if (tx) {
        this.router.navigate(['/client-overview/finance/wallet', tx.id]);
      }
    });
  }

  retryLoading() {
    this.loadWalletData();
  }
}
