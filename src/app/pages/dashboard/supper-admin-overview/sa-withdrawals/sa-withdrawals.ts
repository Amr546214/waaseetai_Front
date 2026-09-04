import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WithdrawalApiService } from '../../../../core/services/withdrawal-api.service';
import { Withdrawal, WithdrawalPagination, ApproveWithdrawalPayload, RejectWithdrawalPayload } from '../../../../core/models/withdrawal.model';

type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

@Component({
  selector: 'app-sa-withdrawals',
  standalone: true,
  imports: [CommonModule],
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

  selectedWithdrawal = signal<Withdrawal | null>(null);
  showDetail = signal(false);

  showActionForm = signal(false);
  actionType = signal<'approve' | 'reject' | null>(null);
  adminNote = signal('');
  rejectionReason = signal('');
  submittingAction = signal(false);
  actionError = signal('');
  actionSuccess = signal('');

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

  openDetail(w: Withdrawal) {
    this.showDetail.set(true);
    this.selectedWithdrawal.set(w);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selectedWithdrawal.set(null);
    this.cancelActionForm();
  }

  canAct(status: string | undefined): boolean {
    const s = status || 'PENDING';
    return s !== 'APPROVED' && s !== 'REJECTED' && s !== 'COMPLETED';
  }

  openActionForm(action: 'approve' | 'reject') {
    this.actionType.set(action);
    this.adminNote.set('');
    this.rejectionReason.set('');
    this.actionError.set('');
    this.actionSuccess.set('');
    this.showActionForm.set(true);
  }

  cancelActionForm() {
    this.showActionForm.set(false);
    this.actionType.set(null);
    this.adminNote.set('');
    this.rejectionReason.set('');
    this.actionError.set('');
  }

  submitAction() {
    const w = this.selectedWithdrawal();
    const action = this.actionType();
    if (!w || !action) return;
    if (this.submittingAction()) return;

    if (action === 'reject') {
      const reason = this.rejectionReason().trim();
      if (!reason) {
        this.actionError.set('يرجى كتابة سبب الرفض');
        return;
      }
    }

    this.actionError.set('');
    this.submittingAction.set(true);

    if (action === 'approve') {
      const payload: ApproveWithdrawalPayload = {};
      const note = this.adminNote().trim();
      if (note) payload.adminNote = note;

      this.withdrawalApi.approveAdminWithdrawal(w.id, payload).subscribe({
        next: (res) => {
          this.submittingAction.set(false);
          if (res.success) {
            this.actionSuccess.set('تم تحديث حالة طلب السحب بنجاح');
            this.showActionForm.set(false);
            this.actionType.set(null);
            this.adminNote.set('');
            this.rejectionReason.set('');
            if (res.data) {
              this.selectedWithdrawal.set(res.data);
            }
            this.fetchWithdrawals();
          } else {
            this.actionError.set(res.message || 'تعذر تحديث طلب السحب، حاول مرة أخرى');
          }
        },
        error: (err) => {
          this.submittingAction.set(false);
          this.actionError.set(err?.error?.message || 'تعذر تحديث طلب السحب، حاول مرة أخرى');
        },
      });
    } else {
      const payload: RejectWithdrawalPayload = {
        rejectionReason: this.rejectionReason().trim(),
      };

      this.withdrawalApi.rejectAdminWithdrawal(w.id, payload).subscribe({
        next: (res) => {
          this.submittingAction.set(false);
          if (res.success) {
            this.actionSuccess.set('تم تحديث حالة طلب السحب بنجاح');
            this.showActionForm.set(false);
            this.actionType.set(null);
            this.adminNote.set('');
            this.rejectionReason.set('');
            if (res.data) {
              this.selectedWithdrawal.set(res.data);
            }
            this.fetchWithdrawals();
          } else {
            this.actionError.set(res.message || 'تعذر تحديث طلب السحب، حاول مرة أخرى');
          }
        },
        error: (err) => {
          this.submittingAction.set(false);
          this.actionError.set(err?.error?.message || 'تعذر تحديث طلب السحب، حاول مرة أخرى');
        },
      });
    }
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
    return currency ? `${formatted} ${currency}` : `${formatted} ر.س`;
  }

  ibanLast4(iban: string | undefined): string {
    if (!iban) return '—';
    const clean = iban.replace(/\s/g, '');
    return clean.length > 4 ? `•••• ${clean.slice(-4)}` : clean;
  }

  userDisplay(w: Withdrawal): string {
    return w.userName || w.userEmail || (w.userId ? this.shortId(w.userId) : '—');
  }
}
