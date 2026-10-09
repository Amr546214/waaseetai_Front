import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WithdrawalApiService } from '../../../../core/services/withdrawal-api.service';
import { Withdrawal, LEGACY_WITHDRAWAL_LABEL, isLegacyWithdrawal, WithdrawalPagination } from '../../../../core/models/withdrawal.model';

type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

@Component({
  selector: 'app-sa-withdrawals',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-withdrawals.html',
  styleUrl: './sa-withdrawals.css',
})
export class SaWithdrawals implements OnInit {
  private withdrawalApi = inject(WithdrawalApiService);

  withdrawals = signal<Withdrawal[]>([]);
  loading = signal(false);
  error = signal('');
  activeFilter = signal<StatusFilter>('all');
  currentPage = signal(1);
  pageSize = signal(10);
  pagination = signal<WithdrawalPagination | null>(null);

  readonly filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'PENDING', label: 'قيد المراجعة' },
    { key: 'APPROVED', label: 'مقبول' },
    { key: 'REJECTED', label: 'مرفوض' },
    { key: 'COMPLETED', label: 'مكتمل' },
  ];

  readonly statusLabels: Record<string, string> = {
    PENDING: 'قيد المراجعة',
    APPROVED: 'مقبول',
    REJECTED: 'مرفوض',
    COMPLETED: 'مكتمل',
  };

  readonly statusClasses: Record<string, string> = {
    PENDING: 'wd-st-pending',
    APPROVED: 'wd-st-approved',
    REJECTED: 'wd-st-rejected',
    COMPLETED: 'wd-st-completed',
  };

  ngOnInit() {
    this.fetchWithdrawals();
  }

  fetchWithdrawals() {
    this.loading.set(true);
    this.error.set('');
    const filter = this.activeFilter();
    this.withdrawalApi.getAdminWithdrawals({
      status: filter === 'all' ? undefined : filter,
      page: this.currentPage(),
      limit: this.pageSize(),
    }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const d = res.data;
          const list = d.withdrawals || d.items || [];
          this.withdrawals.set(list as Withdrawal[]);
          if (d.pagination) {
            this.pagination.set(d.pagination);
          } else {
            this.pagination.set({
              page: d.page ?? this.currentPage(),
              limit: d.limit ?? this.pageSize(),
              total: d.total ?? list.length,
              totalPages: d.pages ?? d.totalPages ?? 1,
            });
          }
        } else {
          this.withdrawals.set([]);
          this.pagination.set(null);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'تعذر تحميل طلبات السحب');
        this.loading.set(false);
      },
    });
  }

  setFilter(filter: StatusFilter) {
    this.activeFilter.set(filter);
    this.currentPage.set(1);
    this.fetchWithdrawals();
  }

  nextPage() {
    const p = this.pagination();
    if (!p) return;
    const totalPages = p.totalPages ?? p.pages ?? 1;
    if (this.currentPage() < totalPages) {
      this.currentPage.update((v) => v + 1);
      this.fetchWithdrawals();
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update((v) => v - 1);
      this.fetchWithdrawals();
    }
  }

  shortId(id: string): string {
    return id.length > 8 ? id.slice(0, 8) + '…' : id;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatAmount(amount: number | undefined, currency: string | undefined): string {
    if (amount == null) return '—';
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    return currency ? `${formatted} ${currency === 'USD' ? '$' : currency}` : `${formatted} $`;
  }

  readonly legacyLabel = LEGACY_WITHDRAWAL_LABEL;

  isLegacy(w: Withdrawal): boolean {
    return isLegacyWithdrawal(w);
  }

  userDisplay(w: Withdrawal): string {
    return w.userName || w.userEmail || (w.userId ? this.shortId(w.userId) : '—');
  }
}
