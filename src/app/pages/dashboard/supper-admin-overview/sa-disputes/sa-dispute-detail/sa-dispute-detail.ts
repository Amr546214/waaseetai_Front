import { formatWsText } from '../../../../../shared/ws-date/ws-date.pipe';
import { WsAmountPipe } from '../../../../../shared/money/money.pipe';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DisputeApiService } from '../../../../../core/services/dispute-api.service';
import { AdminOpsApiService, AdminStaffMember } from '../../../../../core/services/admin-ops-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { FieldProblem } from '../../../../../shared/forms/form-error-focus';
import { clearAllInvalid, handleAdminError, reportAdminProblems } from '../../shared/admin-form-report';
import { Dispute, DisputeStatus, DisputeAction, ResolveDisputePayload, ResolveFinancialPayload, FinancialOutcomeCode, DisputeAiSummary } from '../../../../../core/models/dispute.model';
import { FINANCIAL_OUTCOME_LABELS_AR, TEXT_CLOSURE_LABELS_AR, disputeResolutionText } from '../../../../../core/utils/dispute-labels.util';

@Component({
  selector: 'app-sa-dispute-detail',
  standalone: true,
  imports: [WsAmountPipe, CommonModule, RouterLink, FormsModule, WsSelectComponent],
  templateUrl: './sa-dispute-detail.html',
  styleUrls: ['../sa-disputes.css', './sa-dispute-detail.css'],
})
export class SaDisputeDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private disputeApi = inject(DisputeApiService);
  private opsApi = inject(AdminOpsApiService);
  private notify = inject(UiNotificationService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Honest failure of assign / note / status (network, 429, 5xx, 403, 409, non-field 400), next to the controls. */
  opError = signal('');
  private auth = inject(AuthStore);

  selectedDispute = signal<Dispute | null>(null);
  loading = signal(true);
  notFound = signal(false);
  error = signal('');

  showResolveForm = signal(false);
  resolveAction = signal<DisputeAction | null>(null);
  resolutionText = signal('');
  resolutionNote = signal('');
  submittingResolve = signal(false);
  resolveError = signal('');
  // Two-step resolve: the form first, then an explicit warning/confirmation before anything is sent.
  confirmingResolve = signal(false);

  // Staff operations: assignment, internal notes and the OPEN <-> UNDER_REVIEW switch.
  staff = signal<AdminStaffMember[]>([]);
  staffOptions = computed(() => this.staff().map(s => ({ value: s.id, label: s.name })));
  selectedAssigneeId = signal('');
  noteDraft = signal('');
  opBusy = signal(false);

  readonly noEscalationBackend = 'يحتاج قرار منتج/جدول بيانات غير متوفر';

  // Advisory-only AI summary — entirely separate from the manual
  // resolve/reject state above. Never pre-fills resolutionText/resolutionNote.
  aiSummary = signal<DisputeAiSummary | null>(null);
  aiSummaryLoading = signal(false);
  aiSummaryError = signal('');

  // Two kinds of admin decision (the screen explains both):
  //  1) TEXT closure/rejection (the "resolve"/"reject" form): recorded + both parties notified, moves NO money.
  //  2) FINANCIAL decision (the "financial" form): explicit amounts that settle the whole held escrow, explicit confirmation, executed atomically
  //     by the backend. Typing a code like REFUND_CLIENT in the text form executes nothing (the backend refuses it).
  readonly resolutionPresets = ['MUTUAL_CLOSE', 'NO_FINANCIAL_CHANGE', 'REJECTED_INSUFFICIENT_EVIDENCE'];
  presetLabel(code: string): string { return TEXT_CLOSURE_LABELS_AR[code] ?? code; }
  resolutionDisplay = disputeResolutionText;

  readonly financialOutcomes: { code: FinancialOutcomeCode; label: string; hint: string }[] = [
    { code: 'REFUND_CLIENT', label: FINANCIAL_OUTCOME_LABELS_AR.REFUND_CLIENT, hint: 'يعود المبلغ المحتجز كاملًا إلى محفظة العميل ويُلغى العقد. لا عمولة.' },
    { code: 'RELEASE_PROVIDER', label: FINANCIAL_OUTCOME_LABELS_AR.RELEASE_PROVIDER, hint: 'يُصرف المبلغ المحتجز كاملًا لمقدم الخدمة بعد خصم عمولة المنصة المثبّتة في العقد، ويُغلق العقد.' },
    { code: 'SPLIT', label: FINANCIAL_OUTCOME_LABELS_AR.SPLIT, hint: 'يُقسَّم المبلغ المحتجز: جزء للعميل وجزء لمقدم الخدمة (العمولة على جزء مقدم الخدمة فقط).' },
  ];
  outcomeHint(code: FinancialOutcomeCode): string { return this.financialOutcomes.find(o => o.code === code)?.hint ?? ''; }
  showFinancialForm = signal(false);
  finOutcome = signal<FinancialOutcomeCode | null>(null);
  finRefund = signal('');
  finRelease = signal('');
  finNote = signal('');
  finConfirmStep = signal(false);
  finConfirmed = signal(false);
  finSubmitting = signal(false);
  finError = signal('');

  readonly statusLabels: Record<DisputeStatus, string> = {
    OPEN: 'مفتوح',
    UNDER_REVIEW: 'قيد المراجعة',
    RESOLVED: 'تم الحل',
    REJECTED: 'مرفوض',
  };

  readonly statusClasses: Record<DisputeStatus, string> = {
    OPEN: 'dp-st-open',
    UNDER_REVIEW: 'dp-st-review',
    RESOLVED: 'dp-st-resolved',
    REJECTED: 'dp-st-rejected',
  };

  readonly escrowLabels: Record<string, string> = {
    HELD: 'محتجز',
    RELEASED: 'مُحرَّر',
    REFUNDED: 'مُسترد',
  };

  ngOnInit(): void {
    this.opsApi.listStaff().subscribe({
      next: (res) => this.staff.set(res.success && Array.isArray(res.data) ? res.data : []),
      error: () => this.staff.set([]),
    });
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

  private fetchDetail(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.selectedDispute.set(null);
    this.aiSummary.set(null);
    this.aiSummaryError.set('');
    this.cancelFinancialForm();
    this.noteDraft.set('');
    this.cancelResolveForm();
    this.disputeApi.getAdminDispute(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.selectedDispute.set(res.data);
          this.selectedAssigneeId.set(res.data.assignedTo?.id ?? '');
        } else {
          this.notFound.set(true);
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.notFound.set(true);
        } else {
          this.error.set(err?.error?.message || 'تعذر تحميل تفاصيل النزاع');
        }
      },
    });
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.fetchDetail(id);
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/disputes']);
  }

  private fullName(u?: { firstName?: string; lastName?: string } | null): string {
    return [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim();
  }

  /** Real parties: the opener (claimant) and the other side. `claimText` for the claimant is the real `d.reason`;
   *  the API has no respondent-response field, so none is shown. */
  partyInfo(d: Dispute, role: 'claimant' | 'respondent'): { name: string; initials: string; avBg: string; roleLabel: string; claimText: string | null } {
    const user = role === 'claimant' ? d.openedBy : d.againstUser;
    const name = this.fullName(user) || 'غير متاح';
    return {
      name,
      initials: name === 'غير متاح' ? '—' : name.charAt(0),
      avBg: role === 'claimant' ? 'linear-gradient(135deg,#FFB400,#FF8C69)' : 'linear-gradient(135deg,#0FA99A,#2BD4C7)',
      roleLabel: role === 'claimant' ? 'مقدّم النزاع' : 'الطرف الآخر',
      claimText: role === 'claimant' ? (d.reason || 'لم يُسجَّل سبب صريح للادعاء') : null,
    };
  }

  evidenceFileName(url: string): string {
    try {
      const clean = url.split('?')[0].split('#')[0];
      const last = clean.substring(clean.lastIndexOf('/') + 1);
      return last || url;
    } catch {
      return url;
    }
  }

  /** Dispute log: the opening entry (createdAt) followed by the real audit-log entries returned by the API. */
  activityLog(d: Dispute): { label: string; detail: string; dateLabel: string; dotColor: string }[] {
    const events: { label: string; detail: string; dateLabel: string; dotColor: string }[] = [{
      label: `فتح النزاع بواسطة ${this.partyInfo(d, 'claimant').name}`,
      detail: '',
      dateLabel: this.formatDate(d.createdAt),
      dotColor: '#FFB400',
    }];
    const entries = [...(d.timeline ?? [])].sort((x, y) => new Date(x.occurredAt).getTime() - new Date(y.occurredAt).getTime());
    for (const e of entries) {
      events.push({
        label: e.title,
        detail: [e.summary, e.admin?.name ? `بواسطة ${e.admin.name}` : ''].filter(Boolean).join(' — '),
        dateLabel: this.formatDate(e.occurredAt),
        dotColor: '#5DA0FF',
      });
    }
    return events;
  }

  private reload(successMsg: string) {
    const id = this.selectedDispute()?.id;
    if (!id) return;
    this.disputeApi.getAdminDispute(id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.selectedDispute.set(res.data);
          this.selectedAssigneeId.set(res.data.assignedTo?.id ?? '');
        }
        this.notify.success(successMsg);
      },
      error: () => this.notify.warning(`${successMsg} (تعذر تحديث العرض، أعد تحميل الصفحة)`),
    });
  }

  private runOp(call: (id: string) => import('rxjs').Observable<{ success: boolean; message?: string }>, successMsg: string, fail: string, after?: () => void, resolve: Record<string, string> = {}) {
    const dispute = this.selectedDispute();
    if (!dispute || this.opBusy()) return;
    this.opError.set('');
    this.opBusy.set(true);
    call(dispute.id).subscribe({
      next: (res) => {
        this.opBusy.set(false);
        if (res.success) {
          after?.();
          this.reload(successMsg);
        } else {
          this.opError.set(res.message || fail);
        }
      },
      error: (err) => {
        this.opBusy.set(false);
        handleAdminError(this.host.nativeElement, err, { fallback: fail, resolve }, (m) => this.opError.set(m));
      },
    });
  }

  assign() {
    const assigneeId = this.selectedAssigneeId();
    if (!assigneeId) { this.opError.set(''); void reportAdminProblems(this.host.nativeElement, [{ field: 'dp-assignee', message: 'اختر الموظف الذي سيُسنَد إليه النزاع' }]); return; }
    this.runOp((id) => this.disputeApi.assignAdminDispute(id, assigneeId), 'تم إسناد النزاع', 'تعذر إسناد النزاع', undefined, { assigneeId: 'dp-assignee' });
  }

  addNote() {
    const body = this.noteDraft().trim();
    if (!body) { this.opError.set(''); void reportAdminProblems(this.host.nativeElement, [{ field: 'dp-note', message: 'اكتب نص الملاحظة الداخلية قبل الإضافة' }]); return; }
    this.runOp((id) => this.disputeApi.addAdminDisputeNote(id, body), 'تمت إضافة الملاحظة الداخلية', 'تعذر إضافة الملاحظة', () => this.noteDraft.set(''), { body: 'dp-note' });
  }

  setStatus(status: 'OPEN' | 'UNDER_REVIEW') {
    this.runOp((id) => this.disputeApi.setAdminDisputeStatus(id, status), status === 'UNDER_REVIEW' ? 'بدأت مراجعة النزاع' : 'أُعيد النزاع إلى المفتوح', 'تعذر تغيير الحالة');
  }

  // ── Financial decision ──────────────────────────────────────────────
  private round2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }

  /** The unreleased escrow the decision must settle completely (server value; never computed from anything else). */
  heldAmount(d: Dispute): number { return this.round2(d.heldEscrowAmount ?? 0); }

  /** Why a financial decision is not available, or '' when it is. */
  financialBlockedReason(d: Dispute): string {
    if (!this.canResolve(d.status)) return 'النزاع محسوم مسبقًا';
    // Owner decision: only a SUPER_ADMIN account moves money (the backend refuses anyone else with 403).
    if (this.auth.currentUser()?.accountType !== 'SUPER_ADMIN') return 'القرار المالي من صلاحية المدير الأعلى (SUPER_ADMIN) فقط. يمكنك إغلاق النزاع نصيًا دون أثر مالي';
    if (!d.escrow) return 'لا يوجد ضمان مرتبط بهذا النزاع';
    if (d.escrow.status !== 'HELD' || this.heldAmount(d) <= 0) return 'لا يوجد مبلغ محتجز لتسويته (المبالغ المصروفة سابقًا لا تُسترد بقرار نزاع)';
    if (d.contractStatus && d.contractStatus !== 'ACTIVE') return 'العقد غير نشط، لا يمكن تنفيذ قرار مالي';
    return '';
  }

  openFinancialForm() {
    const d = this.selectedDispute();
    if (!d || this.financialBlockedReason(d)) return;
    this.cancelResolveForm();
    this.finOutcome.set(null); this.finRefund.set(''); this.finRelease.set(''); this.finNote.set('');
    this.finConfirmStep.set(false); this.finConfirmed.set(false); this.finError.set('');
    this.showFinancialForm.set(true);
  }

  cancelFinancialForm() {
    this.showFinancialForm.set(false);
    this.finOutcome.set(null); this.finRefund.set(''); this.finRelease.set(''); this.finNote.set('');
    this.finConfirmStep.set(false); this.finConfirmed.set(false); this.finError.set('');
  }

  /** Picking an outcome pre-fills explicit amounts that settle the whole held balance; the admin can still edit them before confirming. */
  chooseOutcome(code: FinancialOutcomeCode) {
    const d = this.selectedDispute(); if (!d) return;
    clearAllInvalid(this.host.nativeElement);
    const held = this.heldAmount(d);
    this.finOutcome.set(code);
    this.finConfirmStep.set(false); this.finConfirmed.set(false); this.finError.set('');
    if (code === 'REFUND_CLIENT') { this.finRefund.set(held.toFixed(2)); this.finRelease.set('0.00'); }
    else if (code === 'RELEASE_PROVIDER') { this.finRefund.set('0.00'); this.finRelease.set(held.toFixed(2)); }
    else { const half = this.round2(held / 2); this.finRefund.set(half.toFixed(2)); this.finRelease.set(this.round2(held - half).toFixed(2)); }
  }

  private amount(v: string): number { const n = Number(String(v).trim()); return Number.isFinite(n) ? n : NaN; }
  finRefundNum = computed(() => this.amount(this.finRefund()));
  finReleaseNum = computed(() => this.amount(this.finRelease()));
  finSum = computed(() => this.round2((this.finRefundNum() || 0) + (this.finReleaseNum() || 0)));

  /** Client-side mirror of the backend rules (the backend re-checks everything): every problem with the control it belongs to. */
  financialProblems(d: Dispute): FieldProblem[] {
    const outcome = this.finOutcome(); const refund = this.finRefundNum(); const release = this.finReleaseNum(); const held = this.heldAmount(d);
    if (!outcome) return [{ field: 'dp-fin-outcome', message: 'اختر نوع القرار المالي' }];
    const R = 'dp-fin-refund', L = 'dp-fin-release';
    if (Number.isNaN(refund)) return [{ field: R, message: 'أدخل مبلغين صحيحين (مبلغ العميل ومبلغ مقدم الخدمة)' }, ...(Number.isNaN(release) ? [{ field: L, message: 'أدخل مبلغين صحيحين (مبلغ العميل ومبلغ مقدم الخدمة)' }] : [])];
    if (Number.isNaN(release)) return [{ field: L, message: 'أدخل مبلغين صحيحين (مبلغ العميل ومبلغ مقدم الخدمة)' }];
    const out: FieldProblem[] = [];
    if (refund < 0) out.push({ field: R, message: 'لا يمكن أن يكون المبلغ سالبًا' });
    if (release < 0) out.push({ field: L, message: 'لا يمكن أن يكون المبلغ سالبًا' });
    if (out.length) return out;
    if (this.round2(refund) !== refund) out.push({ field: R, message: 'بحد أقصى خانتان عشريتان' });
    if (this.round2(release) !== release) out.push({ field: L, message: 'بحد أقصى خانتان عشريتان' });
    if (out.length) return out;
    if (outcome === 'REFUND_CLIENT' && !(refund > 0 && release === 0)) return [{ field: !(refund > 0) ? R : L, message: 'الاسترداد الكامل: مبلغ العميل أكبر من صفر ومبلغ مقدم الخدمة صفر' }];
    if (outcome === 'RELEASE_PROVIDER' && !(release > 0 && refund === 0)) return [{ field: !(release > 0) ? L : R, message: 'الصرف الكامل: مبلغ مقدم الخدمة أكبر من صفر ومبلغ العميل صفر' }];
    if (outcome === 'SPLIT' && !(release > 0 && refund > 0)) return [{ field: !(refund > 0) ? R : L, message: 'التقسيم: يجب أن يكون المبلغان أكبر من صفر' }];
    if (this.finSum() !== held) return [{ field: R, message: `مجموع المبلغين (${this.finSum()}) يجب أن يساوي المبلغ المحتجز بالكامل (${held})` }];
    const note = this.finNote().trim();
    if (note && note.length < 2) return [{ field: 'dp-fin-note', message: 'الملاحظة قصيرة جدًا: اكتب حرفين على الأقل أو اتركها فارغة' }];
    return [];
  }

  /** First message of financialProblems, or '' (kept for callers that only need the text). */
  financialValidation(d: Dispute): string {
    return this.financialProblems(d)[0]?.message ?? '';
  }

  /** Step 1: validate and show the explicit confirmation; nothing is sent. */
  requestFinancialConfirm() {
    const d = this.selectedDispute(); if (!d) return;
    const problems = this.financialProblems(d);
    if (problems.length) { this.finError.set(''); void reportAdminProblems(this.host.nativeElement, problems); return; }
    this.finError.set(''); this.finConfirmed.set(false); this.finConfirmStep.set(true);
  }

  /** Step 2: send. Only possible after the explicit checkbox; a second click while sending is ignored. */
  submitFinancial() {
    const d = this.selectedDispute(); const outcome = this.finOutcome();
    if (!d || !outcome || this.finSubmitting() || !this.finConfirmStep() || !this.finConfirmed()) return;
    const problems = this.financialProblems(d);
    if (problems.length) { this.finError.set(''); this.finConfirmStep.set(false); void reportAdminProblems(this.host.nativeElement, problems); return; }
    const payload: ResolveFinancialPayload = { outcome, refundToClient: this.finRefundNum(), releaseToProvider: this.finReleaseNum(), expectedHeldAmount: this.heldAmount(d), confirm: true };
    const note = this.finNote().trim();
    if (note) payload.resolutionNote = note;
    this.finSubmitting.set(true); this.finError.set('');
    this.disputeApi.resolveAdminDisputeFinancial(d.id, payload).subscribe({
      next: (res) => {
        this.finSubmitting.set(false);
        if (res.success) {
          this.notify.success('نُفِّذ القرار المالي وأُبلغ الطرفان');
          this.cancelFinancialForm();
          this.reload('');
        } else {
          this.finError.set(res.message || 'تعذر تنفيذ القرار المالي، لم يتغيّر أي مبلغ');
          this.finConfirmStep.set(false);
        }
      },
      error: (err) => {
        this.finSubmitting.set(false);
        this.finConfirmStep.set(false);
        handleAdminError(this.host.nativeElement, err, { fallback: 'تعذر تنفيذ القرار المالي، لم يتغيّر أي مبلغ', resolve: { refundToClient: 'dp-fin-refund', releaseToProvider: 'dp-fin-release', resolutionNote: 'dp-fin-note', outcome: 'dp-fin-outcome' } }, (m) => this.finError.set(m));
      },
    });
  }

  // Advisory-only — purely additive read. Never touches resolutionText/
  // resolutionNote/resolveAction, and never calls resolveAdminDispute.
  requestAiSummary() {
    const dispute = this.selectedDispute();
    if (!dispute || this.aiSummaryLoading()) return;
    this.aiSummaryError.set('');
    this.aiSummaryLoading.set(true);
    this.disputeApi.getDisputeAiSummary(dispute.id).subscribe({
      next: (res) => {
        this.aiSummaryLoading.set(false);
        if (res.success && res.data) {
          this.aiSummary.set(res.data);
        } else {
          this.aiSummaryError.set(res.message || 'تعذر إنشاء ملخص الذكاء الاصطناعي لهذا النزاع حالياً');
        }
      },
      error: (err) => {
        this.aiSummaryLoading.set(false);
        this.aiSummaryError.set(err?.error?.message || 'تعذر إنشاء ملخص الذكاء الاصطناعي لهذا النزاع حالياً');
      },
    });
  }

  openResolveForm(action: DisputeAction) {
    this.resolveAction.set(action);
    this.resolutionText.set('');
    this.resolutionNote.set('');
    this.resolveError.set('');
    this.confirmingResolve.set(false);
    this.showResolveForm.set(true);
  }

  cancelResolveForm() {
    this.showResolveForm.set(false);
    this.resolveAction.set(null);
    this.resolutionText.set('');
    this.resolutionNote.set('');
    this.resolveError.set('');
    this.confirmingResolve.set(false);
  }

  /** Step 1: validates the form and shows the warning; nothing is sent yet. */
  requestResolveConfirm() {
    const problems: FieldProblem[] = [];
    if (!this.resolutionText().trim()) problems.push({ field: 'dp-resolution', message: 'يرجى كتابة قرار النزاع' });
    const note = this.resolutionNote().trim();
    if (note && note.length < 2) problems.push({ field: 'dp-resolution-note', message: 'الملاحظة قصيرة جدًا: اكتب حرفين على الأقل أو اتركها فارغة' });
    this.resolveError.set('');
    if (problems.length) { void reportAdminProblems(this.host.nativeElement, problems); return; }
    this.confirmingResolve.set(true);
  }

  selectPreset(preset: string) {
    this.resolutionText.set(preset);
  }

  submitResolve() {
    const dispute = this.selectedDispute();
    const action = this.resolveAction();
    if (!dispute || !action) return;
    if (this.submittingResolve() || !this.confirmingResolve()) return;

    const resolution = this.resolutionText().trim();
    if (!resolution) {
      this.confirmingResolve.set(false);
      void reportAdminProblems(this.host.nativeElement, [{ field: 'dp-resolution', message: 'يرجى كتابة قرار النزاع' }]);
      return;
    }

    this.resolveError.set('');
    this.submittingResolve.set(true);

    const payload: ResolveDisputePayload = {
      action,
      resolution,
    };
    const note = this.resolutionNote().trim();
    if (note) payload.resolutionNote = note;

    this.disputeApi.resolveAdminDispute(dispute.id, payload).subscribe({
      next: (res) => {
        this.submittingResolve.set(false);
        if (res.success) {
          this.notify.success('تم تسجيل القرار وإبلاغ الطرفين');
          this.showResolveForm.set(false);
          this.resolveAction.set(null);
          this.resolutionText.set('');
          this.resolutionNote.set('');
          this.confirmingResolve.set(false);
          this.reload('');
        } else {
          this.resolveError.set(res.message || 'تعذر تحديث حالة النزاع، حاول مرة أخرى');
          this.confirmingResolve.set(false);
        }
      },
      error: (err) => {
        this.submittingResolve.set(false);
        this.confirmingResolve.set(false);
        handleAdminError(this.host.nativeElement, err, { fallback: 'تعذر تحديث حالة النزاع، حاول مرة أخرى', resolve: { resolution: 'dp-resolution', resolutionNote: 'dp-resolution-note' } }, (m) => this.resolveError.set(m));
      },
    });
  }

  canChangeStatus(status: DisputeStatus): boolean {
    return status === 'OPEN' || status === 'UNDER_REVIEW';
  }

  canResolve(status: DisputeStatus): boolean {
    return status !== 'RESOLVED' && status !== 'REJECTED';
  }

  shortId(id: string): string {
    return id.length > 8 ? id.slice(0, 8) + '…' : id;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return formatWsText(new Date(value), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', });
  }
}
