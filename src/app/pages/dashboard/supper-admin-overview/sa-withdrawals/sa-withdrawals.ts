import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
  typeFilter = signal<string>('all');

  readonly statusOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'الكل' },
    { value: 'PENDING', label: 'قيد الانتظار' },
    { value: 'APPROVED', label: 'موافق عليها' },
    { value: 'REJECTED', label: 'مرفوضة' },
    { value: 'COMPLETED', label: 'مكتملة' },
  ];

  readonly typeOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'الكل' },
    { value: 'provider', label: 'مقدمو خدمة' },
    { value: 'broker', label: 'وسطاء' },
    { value: 'suspicious', label: 'مشبوهة' },
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

  // ── Computed summary (from loaded items) ────────────────────────────
  pendingCount = computed(() => this.withdrawals().filter(w => w.status === 'PENDING').length);
  pendingAmount = computed(() =>
    this.withdrawals()
      .filter(w => w.status === 'PENDING')
      .reduce((sum, w) => sum + (w.amount ?? 0), 0)
  );
  approvedCount = computed(() =>
    this.withdrawals().filter(w => w.status === 'APPROVED' || w.status === 'COMPLETED').length
  );
  suspiciousCount = computed(() =>
    this.withdrawals().filter(w => Boolean((w as any).isSuspicious || (w as any).suspicious)).length
  );

  // ── Frontend-only type filter on loaded items ───────────────────────
  filteredWithdrawals = computed(() => {
    const tf = this.typeFilter();
    if (tf === 'all') return this.withdrawals();
    if (tf === 'suspicious') {
      return this.withdrawals().filter(w => Boolean((w as any).isSuspicious || (w as any).suspicious));
    }
    // provider / broker — filter by userType/role field if present
    return this.withdrawals().filter(w => {
      const ut = String((w as any).userType || (w as any).role || '').toLowerCase();
      return ut.includes(tf);
    });
  });

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

  onTypeFilterChange(type: string) {
    this.typeFilter.set(type);
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

  getMethodLabel(method?: string): string {
    const map: Record<string, string> = {
      bank_transfer: 'تحويل بنكي',
      card: 'بطاقة',
    };
    return map[method || ''] || method || '—';
  }

  getShortId(id: string): string {
    return id?.length > 8 ? id.substring(0, 8) : id;
  }

  maskIban(iban?: string): string {
    if (!iban) return '—';
    const v = iban.replace(/\s/g, '');
    if (v.length <= 8) return v;
    return v.substring(0, 4) + ' •••• ' + v.substring(v.length - 4);
  }

  getWaitDuration(createdAt?: string | null): string {
    if (!createdAt) return '—';
    try {
      const created = new Date(createdAt).getTime();
      const now = Date.now();
      const diffMs = now - created;
      if (diffMs < 0) return '—';
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      if (hours < 1) return 'أقل من ساعة';
      if (hours < 24) return `${hours} ساعة`;
      const days = Math.floor(hours / 24);
      return `${days} يوم`;
    } catch {
      return '—';
    }
  }

  getUserTypeLabel(w: Withdrawal): string {
    const ut = String((w as any).userType || (w as any).role || '').toLowerCase();
    if (ut.includes('broker')) return 'وسيط';
    if (ut.includes('provider')) return 'مقدم خدمة';
    return 'مقدم خدمة';
  }

  formatAmount(amount?: number, currency?: string): string {
    if (amount == null) return '—';
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    const cur = currency || 'SAR';
    return `${cur} ${formatted}`;
  }

  formatDate(date?: string | null): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return date;
    }
  }

  getAiStatus(w: Withdrawal): { label: string; class: string } {
    const suspicious = (w as any).isSuspicious || (w as any).suspicious;
    if (suspicious) return { label: 'مشبوه', class: 'sw-ai-flag' };
    const verified = (w as any).aiVerified || (w as any).verified;
    if (verified) return { label: 'موثّق', class: 'sw-ai-ok' };
    return { label: 'مراجعة', class: 'sw-ai-review' };
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
