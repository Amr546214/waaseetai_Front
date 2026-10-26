import { formatWsDate } from '../../../../../shared/ws-date/ws-date.pipe';
import { WsAmountPipe } from '../../../../../shared/money/money.pipe';
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ClientFinanceService, ClientWalletTransaction } from '../../../../../core/services/client-finance.service';

@Component({
  selector: 'app-transaction-details',
  standalone: true,
  imports: [WsAmountPipe, CommonModule, RouterLink],
  templateUrl: './transaction-details.html',
  styleUrl: './transaction-details.css',
})
export class TransactionDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private financeService = inject(ClientFinanceService);

  transaction = signal<ClientWalletTransaction | null>(null);
  loading = signal(true);
  error = signal('');

  isEscrow = computed(() => this.transaction()?.type === 'ESCROW_LOCK');
  isDeposit = computed(() => this.transaction()?.type === 'DEPOSIT');
  // A refund returns money to the wallet, like a deposit.
  direction = computed<'in' | 'out'>(() => this.isDeposit() || this.transaction()?.type === 'REFUND' ? 'in' : 'out');
  isFailed = computed(() => this.transaction()?.status === 'FAILED');
  // payments are stored negative: the sign is shown once, from the direction; a failed attempt moved no money, so it has no sign
  amountAbs = computed(() => Math.abs(this.transaction()?.amount ?? 0));
  sign = computed(() => this.isFailed() ? '' : (this.direction() === 'out' ? '-' : '+'));
  isDone = computed(() => this.transaction()?.status === 'COMPLETED');
  isHeld = computed(() => this.transaction()?.status === 'HELD');

  title = computed(() => {
    const tx = this.transaction();
    if (!tx) return '';
    if (tx.description) return tx.description;
    return this.isEscrow() ? 'إيداع بالضمان' : (this.isDeposit() ? 'إيداع رصيد بالمحفظة' : 'معاملة مالية');
  });

  typeLabel = computed(() => {
    const tx = this.transaction();
    if (!tx) return '';
    if (tx.type === 'ESCROW_LOCK') return 'إيداع بحساب الضمان';
    if (tx.type === 'DEPOSIT') return 'إيداع رصيد بالمحفظة';
    if (tx.type === 'ORDER_PAYMENT') return 'دفع طلب خدمة من المحفظة';
    if (tx.type === 'REFUND') return 'استرداد إلى المحفظة';
    return tx.type;
  });

  statusLabel = computed(() => this.isFailed() ? 'فشلت' : this.isHeld() ? 'محجوز في الضمان' : (this.isDone() ? 'مكتمل' : 'قيد المعالجة'));

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('رقم المعاملة غير صالح');
      this.loading.set(false);
      return;
    }

    this.financeService.getWallet().subscribe({
      next: response => {
        const found = response?.data?.transactions?.find(tx => tx.id === id) || null;
        if (found) {
          this.transaction.set(found);
        } else {
          this.error.set('تعذر العثور على هذه المعاملة');
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('تعذر تحميل بيانات المعاملة');
        this.loading.set(false);
      }
    });
  }

  goBack() {
    this.router.navigate(['/client-overview/finance/wallet']);
  }

  formatDateTime(value: string | undefined): string {
    if (!value) return '—';
    return `${formatWsDate(value, 'date', 'yyyy-MM-dd')} · ${formatWsDate(value, 'time')}`;
  }
}
