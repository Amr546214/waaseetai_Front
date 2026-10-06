import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DepositModal } from '../../../../../sheards/deposit-modal/deposit-modal';
import { ClientFinanceService, ClientWalletData, ClientWalletEmployeeSpend } from '../../../../../core/services/client-finance.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

export interface DisplayTransaction {
  id: string;
  referenceId?: string;
  title: string;
  description: string;
  date: string;
  amount: string;
  direction: 'in' | 'out';
  status: string;
  statusType: 'done' | 'hold' | 'pending';
  icon: 'escrow' | 'wallet';
  employeeName?: string;
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, RouterLink, DepositModal],
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

  loadWalletData(onLoaded?: () => void) {
    this.isLoading.set(true);
    this.hasError.set(false);

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
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  private applyWalletData(data: ClientWalletData) {
    this.balance.set(data.summary?.availableBalance ?? 0);
    this.escrowBalance.set(data.summary?.escrowBalance ?? 0);
    this.activeProjectsCount.set(data.summary?.activeProjectsCount ?? 0);
    this.quarterSpend.set(data.summary?.quarterSpend ?? 0);
    this.quarterBudget.set(data.summary?.quarterBudget ?? 0);
    this.employeeSpending.set(data.employeeSpending ?? []);

    if (data.transactions && data.transactions.length > 0) {
      const mapped = data.transactions.map(tx => {
        const isDeposit = tx.type === 'DEPOSIT';
        const isEscrow = tx.type === 'ESCROW_LOCK';
        const isDone = tx.status === 'COMPLETED';
        const isHeld = tx.status === 'HELD';

        const direction: 'in' | 'out' = isDeposit ? 'in' : 'out';
        const statusType: 'done' | 'hold' | 'pending' = isDone ? 'done' : (isHeld ? 'hold' : 'pending');
        const statusText = isDone ? 'مكتمل' : (isHeld ? 'محجوز' : 'قيد المعالجة');
        const icon: 'escrow' | 'wallet' = isEscrow ? 'escrow' : 'wallet';

        const formattedDate = new Date(tx.createdAt).toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });

        const sign = direction === 'in' ? '+' : '-';
        // Each transaction shows its own recorded currency: USD as '$'; a legacy row in any other currency shows no
        // currency symbol at all (never an old riyal label).
        const currencyLabel = tx.currency === 'USD' ? '$' : '';

        return {
          id: tx.id,
          referenceId: tx.referenceId,
          title: tx.description || (isDeposit ? 'إيداع رصيد بالمحفظة' : 'معاملة مالية'),
          description: tx.referenceId ? `رقم العملية ${tx.referenceId}` : (tx.paymentMethod || 'محفظة وسيط AI'),
          date: formattedDate,
          amount: `${sign}${tx.amount.toLocaleString('en-US')}${currencyLabel ? ' ' + currencyLabel : ''}`,
          direction,
          status: statusText,
          statusType,
          icon,
          employeeName: tx.employeeName
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
        this.router.navigate(['/client-overview/finance/transactions', tx.id]);
      }
    });
  }

  retryLoading() {
    this.loadWalletData();
  }
}
