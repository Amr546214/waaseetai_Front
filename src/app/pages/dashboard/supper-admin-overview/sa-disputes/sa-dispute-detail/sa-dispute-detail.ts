import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DisputeApiService } from '../../../../../core/services/dispute-api.service';
import { AdminOpsApiService, AdminStaffMember } from '../../../../../core/services/admin-ops-api.service';
import { Dispute, DisputeStatus, DisputeAction, ResolveDisputePayload, DisputeAiSummary } from '../../../../../core/models/dispute.model';

@Component({
  selector: 'app-sa-dispute-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, WsSelectComponent],
  templateUrl: './sa-dispute-detail.html',
  styleUrls: ['../sa-disputes.css', './sa-dispute-detail.css'],
})
export class SaDisputeDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private disputeApi = inject(DisputeApiService);
  private opsApi = inject(AdminOpsApiService);

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
  resolveSuccess = signal('');
  // Two-step resolve: the form first, then an explicit warning/confirmation before anything is sent.
  confirmingResolve = signal(false);

  // Staff operations: assignment, internal notes and the OPEN <-> UNDER_REVIEW switch.
  staff = signal<AdminStaffMember[]>([]);
  staffOptions = computed(() => this.staff().map(s => ({ value: s.id, label: s.name })));
  selectedAssigneeId = signal('');
  noteDraft = signal('');
  opBusy = signal(false);
  opError = signal('');
  opSuccess = signal('');

  readonly noEscalationBackend = 'يحتاج قرار منتج/جدول بيانات غير متوفر';

  // Advisory-only AI summary — entirely separate from the manual
  // resolve/reject state above. Never pre-fills resolutionText/resolutionNote.
  aiSummary = signal<DisputeAiSummary | null>(null);
  aiSummaryLoading = signal(false);
  aiSummaryError = signal('');

  // Split slider: only pre-fills the decision text/note of the manual resolve form. The decision is a record;
  // no money moves (refund/release semantics are a pending product decision).
  splitClaimantPct = signal(50);

  // Parties come from the real dispute (openedBy / againstUser). The admin API returns no respondent defence
  // and no similar-case data, so none of those is shown.

  readonly resolutionPresets = [
    'REFUND_CLIENT',
    'RELEASE_TO_PROVIDER',
    'PARTIAL_REFUND',
    'MUTUAL_CLOSE',
    'REJECTED_INSUFFICIENT_EVIDENCE',
  ];

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
    this.splitClaimantPct.set(50);
    this.resolveSuccess.set('');
    this.opError.set('');
    this.opSuccess.set('');
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
        this.opSuccess.set(successMsg);
      },
      error: () => this.opSuccess.set(`${successMsg} (تعذر تحديث العرض، أعد تحميل الصفحة)`),
    });
  }

  private runOp(call: (id: string) => import('rxjs').Observable<{ success: boolean; message?: string }>, successMsg: string, fail: string, after?: () => void) {
    const dispute = this.selectedDispute();
    if (!dispute || this.opBusy()) return;
    this.opBusy.set(true);
    this.opError.set('');
    this.opSuccess.set('');
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
        this.opError.set(err?.error?.message || fail);
      },
    });
  }

  assign() {
    const assigneeId = this.selectedAssigneeId();
    if (!assigneeId) return;
    this.runOp((id) => this.disputeApi.assignAdminDispute(id, assigneeId), 'تم إسناد النزاع', 'تعذر إسناد النزاع');
  }

  addNote() {
    const body = this.noteDraft().trim();
    if (!body) return;
    this.runOp((id) => this.disputeApi.addAdminDisputeNote(id, body), 'تمت إضافة الملاحظة الداخلية', 'تعذر إضافة الملاحظة', () => this.noteDraft.set(''));
  }

  setStatus(status: 'OPEN' | 'UNDER_REVIEW') {
    this.runOp((id) => this.disputeApi.setAdminDisputeStatus(id, status), status === 'UNDER_REVIEW' ? 'بدأت مراجعة النزاع' : 'أُعيد النزاع إلى المفتوح', 'تعذر تغيير الحالة');
  }

  onSplitInput(value: string) {
    const n = Number(value);
    if (!Number.isNaN(n)) this.splitClaimantPct.set(Math.min(100, Math.max(0, n)));
  }

  /** Applies the chosen quick-verdict preset (and, for a partial split, the
   *  slider's current percentages) by opening the existing manual resolve
   *  form pre-filled — the actual submission still goes through the real
   *  resolveAdminDispute() endpoint via the unchanged submitResolve() flow. */
  applyVerdict(preset: string, d: Dispute) {
    this.openResolveForm('resolve');
    if (preset === 'PARTIAL_REFUND') {
      const pct = this.splitClaimantPct();
      this.resolutionText.set(`PARTIAL_REFUND`);
      this.resolutionNote.set(`تقسيم الضمان: ${pct}% لمقدّم النزاع و${100 - pct}% للطرف الآخر`);
    } else {
      this.selectPreset(preset);
    }
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
    this.resolveSuccess.set('');
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
    if (!this.resolutionText().trim()) {
      this.resolveError.set('يرجى كتابة قرار النزاع');
      return;
    }
    this.resolveError.set('');
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
      this.resolveError.set('يرجى كتابة قرار النزاع');
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
          this.resolveSuccess.set('تم تسجيل القرار وإبلاغ الطرفين');
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
        this.resolveError.set(err?.error?.message || 'تعذر تحديث حالة النزاع، حاول مرة أخرى');
        this.confirmingResolve.set(false);
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
    return new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
}
