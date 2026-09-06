import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WithdrawalApiService } from '../../../../core/services/withdrawal-api.service';
import {
  Withdrawal,
  WithdrawalStatus,
  AdminWithdrawalsQuery,
  ApproveWithdrawalPayload,
  RejectWithdrawalPayload,
} from '../../../../core/models/withdrawal.model';

@Component({
  selector: 'app-sa-withdrawals',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-withdrawals.html',
  styleUrls: ['./sa-withdrawals.css']
})
export class SaWithdrawals implements OnInit {
  private withdrawalApi = inject(WithdrawalApiService);

  withdrawals = signal<Withdrawal[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  total = signal<number>(0);
  readonly limit = 10;

  statusFilter = signal<string>('all');

  readonly statusOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'الكل' },
    { value: 'PENDING', label: 'قيد الانتظار' },
    { value: 'APPROVED', label: 'موافق عليها' },
    { value: 'REJECTED', label: 'مرفوضة' },
    { value: 'COMPLETED', label: 'مكتملة' },
  ];

  selectedWithdrawal = signal<Withdrawal | null>(null);
  detailLoading = signal<boolean>(false);
  detailError = signal<string | null>(null);
  showDetailModal = signal<boolean>(false);

  showActionModal = signal<boolean>(false);
  actionType = signal<'approve' | 'reject'>('approve');
  actionNote = signal<string>('');
  actionReason = signal<string>('');
  processing = signal<boolean>(false);

  ngOnInit() {
    this.loadWithdrawals();
  }

  loadWithdrawals() {
    this.loading.set(true);
    this.error.set(null);

    const query: AdminWithdrawalsQuery = {
      page: this.currentPage(),
      limit: this.limit,
    };
    if (this.statusFilter() !== 'all') {
      query.status = this.statusFilter();
    }

    this.withdrawalApi.getAdminWithdrawals(query).subscribe({
      next: (res) => {
        this.loading.set(false);
        const data = res?.data;
        if (data) {
          const items = data.withdrawals ?? data.items ?? [];
          this.withdrawals.set(items);
          const pag = data.pagination;
          if (pag) {
            this.total.set(pag.total ?? 0);
            this.totalPages.set(pag.totalPages ?? pag.pages ?? 1);
          } else {
            this.total.set(data.total ?? items.length);
            this.totalPages.set(data.pages ?? 1);
          }
        } else {
          this.withdrawals.set([]);
          this.total.set(0);
          this.totalPages.set(1);
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 204) {
          this.withdrawals.set([]);
          this.total.set(0);
          this.totalPages.set(1);
          this.error.set(null);
        } else {
          this.error.set(err?.error?.message || err?.message || 'تعذر تحميل طلبات السحب');
        }
      },
    });
  }

  onStatusFilterChange(status: string) {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.loadWithdrawals();
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadWithdrawals();
  }

  viewDetail(id: string) {
    this.showDetailModal.set(true);
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.selectedWithdrawal.set(null);

    this.withdrawalApi.getAdminWithdrawal(id).subscribe({
      next: (res) => {
        this.detailLoading.set(false);
        if (res?.data) {
          this.selectedWithdrawal.set(res.data);
        } else {
          this.detailError.set('لم يتم العثور على طلب السحب');
        }
      },
      error: (err) => {
        this.detailLoading.set(false);
        this.detailError.set(err?.error?.message || err?.message || 'تعذر تحميل تفاصيل طلب السحب');
      },
    });
  }

  closeDetailModal() {
    this.showDetailModal.set(false);
    this.selectedWithdrawal.set(null);
    this.detailError.set(null);
  }

  openActionModal(action: 'approve' | 'reject') {
    this.actionType.set(action);
    this.actionNote.set('');
    this.actionReason.set('');
    this.showActionModal.set(true);
  }

  closeActionModal() {
    this.showActionModal.set(false);
    this.actionNote.set('');
    this.actionReason.set('');
  }

  confirmAction() {
    const w = this.selectedWithdrawal();
    if (!w) return;
    if (this.actionType() === 'reject' && !this.actionReason().trim()) return;

    this.processing.set(true);

    if (this.actionType() === 'approve') {
      const payload: ApproveWithdrawalPayload = {};
      if (this.actionNote().trim()) payload.adminNote = this.actionNote().trim();

      this.withdrawalApi.approveAdminWithdrawal(w.id, payload).subscribe({
        next: (res) => {
          this.processing.set(false);
          this.showActionModal.set(false);
          if (res?.data) this.selectedWithdrawal.set(res.data);
          this.loadWithdrawals();
        },
        error: (err) => {
          this.processing.set(false);
          this.detailError.set(err?.error?.message || err?.message || 'تعذر تنفيذ الإجراء');
        },
      });
    } else {
      const payload: RejectWithdrawalPayload = {
        rejectionReason: this.actionReason().trim(),
      };

      this.withdrawalApi.rejectAdminWithdrawal(w.id, payload).subscribe({
        next: (res) => {
          this.processing.set(false);
          this.showActionModal.set(false);
          if (res?.data) this.selectedWithdrawal.set(res.data);
          this.loadWithdrawals();
        },
        error: (err) => {
          this.processing.set(false);
          this.detailError.set(err?.error?.message || err?.message || 'تعذر تنفيذ الإجراء');
        },
      });
    }
  }

  getStatusLabel(status?: WithdrawalStatus): string {
    const map: Record<string, string> = {
      PENDING: 'قيد الانتظار',
      APPROVED: 'موافق عليها',
      REJECTED: 'مرفوضة',
      COMPLETED: 'مكتملة',
    };
    return map[status as string] || status || 'غير محدد';
  }

  getStatusClass(status?: WithdrawalStatus): string {
    const map: Record<string, string> = {
      PENDING: 'st-pending',
      APPROVED: 'st-approved',
      REJECTED: 'st-rejected',
      COMPLETED: 'st-completed',
    };
    return map[status as string] || 'st-pending';
  }

  getShortId(id: string): string {
    return id?.length > 8 ? id.substring(0, 8) : id;
  }

  formatAmount(amount?: number, currency?: string): string {
    if (amount == null) return '—';
    const formatted = new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    return `${formatted} ${currency || 'ر.س'}`;
  }

  formatDate(date?: string | null): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return date;
    }
  }

  canAct(status?: WithdrawalStatus): boolean {
    return status === 'PENDING';
  }

  getPagesArray(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages(); i++) {
      pages.push(i);
    }
    return pages;
  }
}
