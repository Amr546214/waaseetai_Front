import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { WithdrawalApiService } from '../../../../../core/services/withdrawal-api.service';
import { Withdrawal, ApproveWithdrawalPayload, RejectWithdrawalPayload } from '../../../../../core/models/withdrawal.model';

@Component({
  selector: 'app-sa-withdrawal-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-withdrawal-detail.html',
  styleUrls: ['../sa-withdrawals.css', './sa-withdrawal-detail.css'],
})
export class SaWithdrawalDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private withdrawalApi = inject(WithdrawalApiService);

  selectedWithdrawal = signal<Withdrawal | null>(null);
  loading = signal(true);
  notFound = signal(false);
  error = signal('');

  showActionForm = signal(false);
  actionType = signal<'approve' | 'reject' | null>(null);
  adminNote = signal('');
  rejectionReason = signal('');
  submittingAction = signal(false);
  actionError = signal('');
  actionSuccess = signal('');

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

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }
      this.fetchDetail(id);
    });
  }

  // Fresh read of the single withdrawal via GET /api/admin/withdrawals/:id
  // (the old in-list panel only reused the list row object).
  private fetchDetail(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.selectedWithdrawal.set(null);
    this.actionSuccess.set('');
    this.cancelActionForm();
    this.withdrawalApi.getAdminWithdrawal(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.selectedWithdrawal.set(res.data);
        } else {
          this.notFound.set(true);
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.notFound.set(true);
        } else {
          this.error.set(err?.error?.message || 'تعذر تحميل تفاصيل طلب السحب');
        }
      },
    });
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.fetchDetail(id);
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/withdrawals']);
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

  formatAmount(amount: number | null | undefined, currency: string | undefined): string {
    if (amount == null) return '—';
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    return currency ? `${formatted} ${currency === 'USD' ? '$' : currency}` : `${formatted} $`;
  }

  ibanLast4(iban: string | undefined): string {
    if (!iban) return '—';
    const clean = iban.replace(/\s/g, '');
    return clean.length > 4 ? `•••• ${clean.slice(-4)}` : clean;
  }

  userDisplay(w: Withdrawal): string {
    return w.userName || w.userEmail || (w.userId ? this.shortId(w.userId) : '—');
  }

  // AI Cleanup Batch 3: the former hash-seeded "mock/demo helpers" (AI risk
  // insights, IBAN-verified flag, balance-source project table) were removed —
  // they were generated from the withdrawal id, not real data, and could sway a
  // real approval decision. No backend risk scoring exists.

  /**
   * Real value from GET /api/admin/withdrawals/:id (withdrawalService.get()
   * -> resolveApprovalLedger() + the same withdrawable-balance arithmetic
   * approve() itself uses) — the withdrawal's ledger balance (provider
   * earnings or affiliate commissions) net of the user's other outstanding
   * withdrawals. null (rendered as "—") when the API response doesn't carry
   * it, instead of assuming the balance covers the requested amount.
   */
  availableBalance(w: Withdrawal): number | null {
    return w.availableBalance ?? null;
  }

  /** Balance remaining after this withdrawal (derived from the real balance above). */
  balanceAfterWithdrawal(w: Withdrawal): number | null {
    const avail = this.availableBalance(w);
    if (avail == null) return null;
    return Math.round(avail - (w.amount ?? 0));
  }

  /** Mostly real (status/dates from API), UI framing (steps/labels) is mock. */
  timelineSteps(w: Withdrawal): { title: string; sub: string; state: 'done' | 'current' | 'pending' | 'rejected' }[] {
    const status = w.status || 'PENDING';
    const steps: { title: string; sub: string; state: 'done' | 'current' | 'pending' | 'rejected' }[] = [];

    steps.push({ title: 'إنشاء الطلب', sub: this.formatDate(w.createdAt), state: 'done' });

    if (status === 'REJECTED') {
      steps.push({ title: 'مراجعة الإدارة', sub: 'تمت المراجعة', state: 'done' });
      steps.push({ title: 'رفض الطلب', sub: w.processedAt ? this.formatDate(w.processedAt) : 'تم الرفض', state: 'rejected' });
      return steps;
    }

    steps.push({
      title: 'مراجعة الإدارة',
      sub: status === 'PENDING' ? 'الحالة الحالية' : 'تمت المراجعة',
      state: status === 'PENDING' ? 'current' : 'done',
    });

    steps.push({
      title: w.method || 'تحويل بنكي',
      sub: status === 'APPROVED' ? 'الحالة الحالية' : status === 'COMPLETED' ? 'تم التحويل' : 'ينتظر الموافقة',
      state: status === 'COMPLETED' ? 'done' : status === 'APPROVED' ? 'current' : 'pending',
    });

    steps.push({
      title: 'اكتمال السحب',
      sub: status === 'COMPLETED' ? this.formatDate(w.processedAt) : '—',
      state: status === 'COMPLETED' ? 'done' : 'pending',
    });

    return steps;
  }
}
