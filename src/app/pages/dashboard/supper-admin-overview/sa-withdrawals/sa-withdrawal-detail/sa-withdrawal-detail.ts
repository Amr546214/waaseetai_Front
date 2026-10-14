import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { WithdrawalApiService } from '../../../../../core/services/withdrawal-api.service';
import { WITHDRAWAL_STATUS_LABELS, WITHDRAWAL_STATUS_CLASSES, withdrawalUserDisplay, withdrawalOwnerLabel } from '../sa-withdrawals';
import { Withdrawal, LEGACY_WITHDRAWAL_LABEL, isLegacyWithdrawal, ApproveWithdrawalPayload, RejectWithdrawalPayload } from '../../../../../core/models/withdrawal.model';

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

  readonly statusLabels = WITHDRAWAL_STATUS_LABELS;
  readonly statusClasses = WITHDRAWAL_STATUS_CLASSES;

  showPayoutConfirm = signal(false);
  sendingPayout = signal(false);
  payoutError = signal('');
  payoutResult = signal('');
  readonly payoutOffReason = 'التحويل الآلي عبر PayPal غير مفعّل في هذه البيئة';

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
    return (status || 'PENDING') === 'PENDING';
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

  canSendPayout(w: Withdrawal): boolean {
    return w.status === 'APPROVED';
  }

  openPayoutConfirm(w: Withdrawal) {
    if (w.payoutAutomationEnabled !== true || w.status !== 'APPROVED') return;
    this.payoutError.set('');
    this.payoutResult.set('');
    this.showPayoutConfirm.set(true);
  }

  cancelPayoutConfirm() {
    if (this.sendingPayout()) return;
    this.showPayoutConfirm.set(false);
    this.payoutError.set('');
  }

  confirmPayout() {
    const w = this.selectedWithdrawal();
    if (!w || w.payoutAutomationEnabled !== true || this.sendingPayout()) return;
    this.sendingPayout.set(true);
    this.payoutError.set('');
    this.withdrawalApi.sendAdminWithdrawalPayout(w.id).subscribe({
      next: (res) => {
        this.sendingPayout.set(false);
        if (res.success) {
          this.payoutResult.set(res.data?.message || res.message || '');
          this.showPayoutConfirm.set(false);
          this.reloadSilently(w.id);
        } else {
          this.payoutError.set(res.message || 'تعذر إرسال التحويل');
        }
      },
      error: (err) => {
        this.sendingPayout.set(false);
        this.payoutError.set(err?.status === 503 ? this.payoutOffReason : (err?.error?.message || 'تعذر إرسال التحويل'));
      },
    });
  }

  private reloadSilently(id: string) {
    this.withdrawalApi.getAdminWithdrawal(id).subscribe({
      next: (res) => { if (res.success && res.data) this.selectedWithdrawal.set(res.data); },
    });
  }

  reviewerDisplay(w: Withdrawal): string {
    const r: any = w['reviewedBy'];
    if (!r) return '';
    if (typeof r === 'string') return r;
    const name = `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim();
    return name || r.email || '';
  }

  attemptStatusLabel(s: string): string {
    const m: Record<string, string> = { PENDING: 'قيد الإرسال', PROCESSING: 'قيد التحويل', SUCCESS: 'نجح', COMPLETED: 'نجح', FAILED: 'فشل', UNCLAIMED: 'لم يُستلم', RETURNED: 'أُعيد', REVERSED: 'أُعيد' };
    return m[s] || s;
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

  // AI Cleanup Batch 3: the former hash-seeded "mock/demo helpers" (AI risk
  // insights, destination-verified flag, balance-source project table) were removed —
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

  /** Timeline built only from real fields: createdAt, reviewedBy, status, processedAt. */
  timelineSteps(w: Withdrawal): { title: string; sub: string; state: 'done' | 'current' | 'pending' | 'rejected' }[] {
    const status = w.status || 'PENDING';
    const steps: { title: string; sub: string; state: 'done' | 'current' | 'pending' | 'rejected' }[] = [];
    steps.push({ title: 'إنشاء الطلب', sub: this.formatDate(w.createdAt), state: 'done' });
    if (status === 'PENDING') {
      steps.push({ title: 'مراجعة الإدارة', sub: 'بانتظار المراجعة', state: 'current' });
      return steps;
    }
    const reviewer = this.reviewerDisplay(w);
    const reviewSub = reviewer ? `بواسطة ${reviewer}` : 'تمت المراجعة';
    if (status === 'REJECTED') {
      steps.push({ title: 'رفض الطلب', sub: `${reviewSub}${w.processedAt ? ' — ' + this.formatDate(w.processedAt) : ''}`, state: 'rejected' });
      return steps;
    }
    steps.push({ title: 'اعتماد الطلب', sub: reviewSub, state: 'done' });
    const label = this.statusLabels[status] || status;
    steps.push({
      title: label,
      sub: status === 'COMPLETED' && w.processedAt ? this.formatDate(w.processedAt) : 'الحالة الحالية',
      state: status === 'COMPLETED' ? 'done' : status === 'REVERSED' ? 'rejected' : 'current',
    });
    return steps;
  }
}
