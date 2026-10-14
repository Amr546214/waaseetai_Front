import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WithdrawalApiService } from '../../../../core/services/withdrawal-api.service';
import { saveBlob, AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';
import { Withdrawal, LEGACY_WITHDRAWAL_LABEL, isLegacyWithdrawal, WithdrawalPagination } from '../../../../core/models/withdrawal.model';

export type WdStatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'REVERSED';
export type WdOwnerFilter = 'all' | 'provider' | 'affiliate';

/** Exact server statuses with their Arabic labels (shared by the list and the detail page). */
export const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد المراجعة',
  APPROVED: 'معتمد (بانتظار التحويل)',
  PROCESSING: 'قيد التحويل',
  COMPLETED: 'تم التحويل',
  REJECTED: 'مرفوض',
  REVERSED: 'أُعيد من PayPal',
};
export const WITHDRAWAL_STATUS_CLASSES: Record<string, string> = {
  PENDING: 'wd-st-pending',
  APPROVED: 'wd-st-approved',
  PROCESSING: 'wd-st-processing',
  COMPLETED: 'wd-st-completed',
  REJECTED: 'wd-st-rejected',
  REVERSED: 'wd-st-reversed',
};

/** Owner display from the API `user` object: first + last name, else email. */
export function withdrawalUserDisplay(w: Withdrawal): string {
  const u = w.user;
  if (!u) return '—';
  const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return name || u.email || '—';
}
export function withdrawalOwnerLabel(w: Withdrawal): string {
  const u = w.user;
  if (!u) return '—';
  return u.affiliateProfile || u.accountType === 'AFFILIATE' || u.accountType === 'MARKETER' ? 'وسيط تسويقي' : 'مقدم خدمة';
}

@Component({
  selector: 'app-sa-withdrawals',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-withdrawals.html',
  styleUrl: './sa-withdrawals.css',
})
export class SaWithdrawals implements OnInit {
  private withdrawalApi = inject(WithdrawalApiService);
  private adminOps = inject(AdminOpsApiService);

  withdrawals = signal<Withdrawal[]>([]);
  counts = signal<Record<string, { count: number; amount: number }>>({});
  loading = signal(false);
  error = signal('');
  activeFilter = signal<WdStatusFilter>('all');
  ownerFilter = signal<WdOwnerFilter>('all');
  currentPage = signal(1);
  pageSize = signal(10);
  pagination = signal<WithdrawalPagination | null>(null);
  exporting = signal(false);
  exportError = signal('');

  readonly filters: { key: WdStatusFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'PENDING', label: WITHDRAWAL_STATUS_LABELS['PENDING'] },
    { key: 'APPROVED', label: WITHDRAWAL_STATUS_LABELS['APPROVED'] },
    { key: 'PROCESSING', label: WITHDRAWAL_STATUS_LABELS['PROCESSING'] },
    { key: 'COMPLETED', label: WITHDRAWAL_STATUS_LABELS['COMPLETED'] },
    { key: 'REJECTED', label: WITHDRAWAL_STATUS_LABELS['REJECTED'] },
    { key: 'REVERSED', label: WITHDRAWAL_STATUS_LABELS['REVERSED'] },
  ];
  readonly owners: { key: WdOwnerFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'provider', label: 'مقدمو الخدمة' },
    { key: 'affiliate', label: 'الوسطاء التسويقيون' },
  ];

  readonly statusLabels = WITHDRAWAL_STATUS_LABELS;
  readonly statusClasses = WITHDRAWAL_STATUS_CLASSES;

  ngOnInit() {
    this.fetchWithdrawals();
  }

  fetchWithdrawals() {
    this.loading.set(true);
    this.error.set('');
    const filter = this.activeFilter();
    const owner = this.ownerFilter();
    this.withdrawalApi.getAdminWithdrawals({
      status: filter === 'all' ? undefined : filter,
      owner: owner === 'all' ? undefined : owner,
      page: this.currentPage(),
      limit: this.pageSize(),
    }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const d = res.data;
          const list = d.withdrawals || d.items || [];
          this.withdrawals.set(list as Withdrawal[]);
          this.counts.set(d.counts ?? {});
          if (d.pagination) {
            this.pagination.set(d.pagination);
          } else {
            this.pagination.set({
              page: d.page ?? this.currentPage(),
              limit: d.limit ?? this.pageSize(),
              total: d.total ?? list.length,
              totalPages: d.totalPages ?? d.pages ?? 1,
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

  setFilter(filter: WdStatusFilter) {
    this.activeFilter.set(filter);
    this.currentPage.set(1);
    this.fetchWithdrawals();
  }

  setOwner(owner: WdOwnerFilter) {
    this.ownerFilter.set(owner);
    this.currentPage.set(1);
    this.fetchWithdrawals();
  }

  /** Real count for a tab from `counts` (all = sum of every status). */
  tabCount(key: WdStatusFilter): number {
    const c = this.counts();
    if (key === 'all') return Object.values(c).reduce((s, b) => s + (b?.count ?? 0), 0);
    return c[key]?.count ?? 0;
  }
  tabAmount(key: WdStatusFilter): number {
    const c = this.counts();
    if (key === 'all') return Object.values(c).reduce((s, b) => s + (b?.amount ?? 0), 0);
    return c[key]?.amount ?? 0;
  }

  totalPages(): number {
    const p = this.pagination();
    return p?.totalPages ?? p?.pages ?? 1;
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
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

  exportCsv() {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set('');
    const filter = this.activeFilter();
    this.adminOps.downloadCsv('withdrawals', { status: filter === 'all' ? undefined : filter }).subscribe({
      next: (blob) => {
        saveBlob(blob, 'withdrawals.csv');
        this.exporting.set(false);
      },
      error: (err) => {
        this.exportError.set(err?.error?.message || 'تعذر تصدير الملف');
        this.exporting.set(false);
      },
    });
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
    return withdrawalUserDisplay(w);
  }

  ownerLabel(w: Withdrawal): string {
    return withdrawalOwnerLabel(w);
  }
}
