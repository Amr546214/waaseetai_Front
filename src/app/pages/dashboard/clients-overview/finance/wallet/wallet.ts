import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DepositModal } from '../../../../../sheards/deposit-modal/deposit-modal';
import { ClientFinanceService, ClientWalletData } from '../../../../../core/services/client-finance.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

export interface DisplayTransaction {
  id: string;
  title: string;
  description: string;
  date: string;
  amount: string;
  direction: 'in' | 'out';
  status: string;
  statusType: 'done' | 'hold' | 'pending';
  icon: 'escrow' | 'wallet';
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

  isDepositModalOpen = signal(false);
  isLoading = signal(true);
  hasError = signal(false);

  balance = signal(0);
  escrowBalance = signal(0);
  activeProjectsCount = signal(0);
  transactions = signal<DisplayTransaction[]>([]);

  availableRatio = computed(() => {
    const avail = this.balance();
    const total = avail + this.escrowBalance();
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((avail / total) * 100)));
  });

  cashbackAmount = computed(() => {
    const avail = this.balance();
    return Math.round(avail * 0.03);
  });

  ngOnInit() {
    const moyasarPaymentId = this.route.snapshot.queryParamMap.get('id');
    if (moyasarPaymentId) {
      this.clientFinanceService.verifyDeposit({ paymentId: moyasarPaymentId }).subscribe({
        next: () => {
          this.router.navigate([], { relativeTo: this.route, replaceUrl: true, queryParams: {} });
          this.loadWalletData();
        },
        error: () => {
          this.router.navigate([], { relativeTo: this.route, replaceUrl: true, queryParams: {} });
          this.hasError.set(true);
          this.isLoading.set(false);
        }
      });
      return;
    }
    this.loadWalletData();
  }

  loadWalletData() {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.clientFinanceService.getWallet().subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.applyWalletData(res.data);
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

        return {
          id: tx.id,
          title: tx.description || (isDeposit ? 'إيداع رصيد بالمحفظة' : 'معاملة مالية'),
          description: tx.referenceId ? `رقم العملية ${tx.referenceId}` : (tx.paymentMethod || 'محفظة وسيط AI'),
          date: formattedDate,
          amount: `${sign}${tx.amount.toLocaleString('en-US')} ريال`,
          direction,
          status: statusText,
          statusType,
          icon
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
    this.loadWalletData();
    this.closeDepositModal();
  }

  retryLoading() {
    this.loadWalletData();
  }
}
