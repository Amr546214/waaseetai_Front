import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ClientFinanceService, ClientWalletTransaction } from '../../../../../core/services/client-finance.service';

@Component({
  selector: 'app-transaction-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
  direction = computed<'in' | 'out'>(() => this.isDeposit() ? 'in' : 'out');
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
    return tx.type;
  });

  statusLabel = computed(() => this.isHeld() ? 'محجوز في الضمان' : (this.isDone() ? 'مكتمل' : 'قيد المعالجة'));

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
    const date = new Date(value);
    const datePart = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    const timePart = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { hour: '2-digit', minute: '2-digit' }).format(date);
    return `${datePart} · ${timePart}`;
  }
}
