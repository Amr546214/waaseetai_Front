import { formatWsText } from '../../../../../shared/ws-date/ws-date.pipe';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { handleAdminError, reportAdminProblems } from '../../shared/admin-form-report';
import { AccreditationApiService } from '../../../../../core/services/accreditation-api.service';
import { AccreditationSample, AdminProofItem, AssessmentFlagCode, AssessmentReviewData } from '../../../../../core/models/accreditation.model';
import { KycDocumentLink } from '../../../../../sheards/kyc-document-link/kyc-document-link';
import { normalizeProofs, proofFileName, providerProfileLink, sampleActions, sampleStatusClass, sampleStatusLabel, splitAdminDecision } from '../accreditation-status';

@Component({
  selector: 'app-sa-accreditation-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, KycDocumentLink],
  templateUrl: './sa-accreditation-detail.html',
  styleUrls: ['../sa-accreditations.css', './sa-accreditation-detail.css'],
})
export class SaAccreditationDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private accreditationApi = inject(AccreditationApiService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  selected = signal<AccreditationSample | null>(null);
  loading = signal(true);
  notFound = signal(false);
  error = signal('');

  showRejectForm = signal(false);
  rejectionReason = signal('');
  submittingAction = signal(false);
  actionError = signal('');
  actionSuccess = signal('');

  /**
   * A decision (approve / reject) went through. From then on the decision buttons stay gone/disabled until the page is loaded again, so the same
   * request can never be decided twice from this screen.
   */
  decisionDone = signal(false);

  /**
   * A decision was refused with 409 (somebody else, or another tab, decided first) and the page could not re-read the sample yet: what is on screen is
   * known to be stale, so the decision actions are withheld until a re-read succeeds (retryRefresh).
   */
  staleAfterConflict = signal(false);

  /** Confirmation step before the approval is sent (approve is irreversible: it grants the specialty badge). */
  showApproveConfirm = signal(false);

  // Common rejection reasons the admin can quick-pick instead of typing free
  // text (no backend "reason templates" endpoint exists — this is a fixed,
  // curated list of the most frequent rejection reasons for this flow).
  readonly rejectionTemplates: string[] = [
    'المستندات أو الصور المرفقة غير واضحة — يُرجى إعادة رفع نموذج أعمال بجودة أعلى',
    'العمل المعروض لا يعكس مستوى الخبرة المطلوب لاعتماد هذا التخصص',
    'رابط المشروع أو GitHub غير صالح أو لا يمكن الوصول إليه',
    'تم رصد تشابه كبير مع نموذج أعمال مُقدَّم مسبقاً من حساب آخر',
    'الوصف المكتوب لا يتطابق مع محتوى المرفقات المرفوعة',
  ];

  readonly statusLabel = sampleStatusLabel;
  readonly statusClass = sampleStatusClass;
  readonly profileLink = providerProfileLink;

  /** The proofs to show (both shapes, never a null entry). */
  readonly proofs = computed<AdminProofItem[]>(() => normalizeProofs(this.selected()));
  /** The AI evaluation text WITHOUT the admin rejection reason, and that reason on its own. */
  readonly decisionParts = computed(() => { const d = this.selected(); return d ? splitAdminDecision(d) : { aiText: '', reason: '' }; });
  /** Shown as the proof's open access marker for the shared document-link component (the backend already decided it is private). */
  readonly privateAccess = { private: true, legacy: false };

  /** Plain Arabic text for each advisory mark. The thresholds shown come from the review itself (they are configurable on the server). */
  flagText(code: AssessmentFlagCode, review: AssessmentReviewData): string {
    const t = review.thresholds;
    switch (code) {
      case 'TOTAL_TIME_TOO_SHORT': return `أنهى الاختبار في وقت أقل من الحد الأدنى${t ? ` (${t.minTotalSeconds} ثانية)` : ''}`;
      case 'FAST_ANSWERS': return `أجاب عن عدة أسئلة متتالية بأسرع من الحد الأدنى لكل سؤال${t ? ` (${t.minSecondsPerQuestion} ثوانٍ)` : ''}`;
      case 'UNIFORM_ANSWERS': return `اختار الخيار نفسه في نسبة كبيرة من الأسئلة${t ? ` (${Math.round(t.patternRatio * 100)}% أو أكثر)` : ''}`;
      case 'REPEATING_PATTERN': return 'تتبّعت إجاباته نمطًا دوريًا ثابتًا (مثل أ-ب-ج-د ثم تكرار)';
      default: return String(code);
    }
  }

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

  private fetchDetail(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.selected.set(null);
    this.actionError.set('');
    this.actionSuccess.set('');
    this.showRejectForm.set(false);
    this.showApproveConfirm.set(false);
    this.decisionDone.set(false);
    this.accreditationApi.getAdminSample(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.selected.set(res.data);
        } else {
          this.notFound.set(true);
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.notFound.set(true);
        } else {
          this.error.set(err?.error?.message || 'تعذر تحميل تفاصيل نموذج الاعتماد');
        }
      },
    });
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.fetchDetail(id);
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/accreditations']);
  }

  // AI_VERIFIED on the sample itself now only ever means "AI recommends
  // approval, pending final confirmation" — the real "already granted"
  // condition is whether the linked ProviderSpecialty has actually been
  // approved (by a prior explicit admin action), not the sample's own label.
  canApprove(sample: AccreditationSample): boolean {
    return !this.decisionDone() && !this.staleAfterConflict() && sampleActions(sample).approve;
  }

  canReject(sample: AccreditationSample): boolean {
    return !this.decisionDone() && !this.staleAfterConflict() && sampleActions(sample).reject;
  }

  /**
   * 409 = the sample was already decided elsewhere. The page shows the refusal (no success state) and re-reads the sample so the pill, the decision section
   * and the available actions follow the SERVER; if the sample is decided, the actions are gone. A failed re-read keeps the error, withholds the actions
   * (the state is unknown) and offers a retry.
   */
  private resyncAfterConflict(): void {
    const id = this.selected()?.id;
    if (!id) return;
    this.staleAfterConflict.set(true);
    this.accreditationApi.getAdminSample(id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.selected.set(res.data);
          this.staleAfterConflict.set(false);
          const decided = sampleActions(res.data).decided !== null;
          this.decisionDone.set(decided);
          if (decided) { this.showRejectForm.set(false); this.showApproveConfirm.set(false); this.rejectionReason.set(''); }
        }
      },
      error: () => { this.showApproveConfirm.set(false); },
    });
  }

  retryRefresh(): void {
    this.resyncAfterConflict();
  }

  /**
   * After a successful decision the page must show the SERVER state (pill, banner, available actions). The decision response is the bare sample row
   * (no specialty, no history), so it is applied only for the fields it really carries, the linked specialty is moved the way the backend moved it, and
   * the full record is then re-read in the background (the banner stays). A failed re-read keeps what was applied.
   */
  private applyDecision(kind: 'APPROVED' | 'REJECTED', data: Partial<AccreditationSample> | null | undefined): void {
    this.decisionDone.set(true);
    this.selected.update((cur) => {
      if (!cur) return cur;
      const next: AccreditationSample = { ...cur };
      if (data) {
        if (data.status) next.status = data.status;
        if (data.decidedAt !== undefined) next.decidedAt = data.decidedAt;
        if (data.userNote !== undefined) next.userNote = data.userNote;
        if (data.aiFeedbackAr !== undefined) next.aiFeedbackAr = data.aiFeedbackAr;
        if (data.aiAuditedAt !== undefined) next.aiAuditedAt = data.aiAuditedAt;
      }
      if (kind === 'APPROVED') {
        next.status = 'AI_VERIFIED';
        next.providerSpecialty = { ...(cur.providerSpecialty ?? { id: cur.providerSpecialtyId }), status: 'APPROVED', isPassed: true };
      } else {
        next.status = 'REJECTED';
        if (cur.providerSpecialty && cur.providerSpecialty.status !== 'APPROVED') next.providerSpecialty = { ...cur.providerSpecialty, status: 'REJECTED' };
      }
      return next;
    });
    const id = this.selected()?.id;
    if (!id) return;
    this.accreditationApi.getAdminSample(id).subscribe({
      next: (res) => { if (res.success && res.data) this.selected.set(res.data); },
      error: () => { /* keep the state applied above */ },
    });
  }

  openApproveConfirm() {
    this.actionError.set('');
    this.actionSuccess.set('');
    this.showApproveConfirm.set(true);
  }

  cancelApproveConfirm() {
    if (this.submittingAction()) return;
    this.showApproveConfirm.set(false);
  }

  submitApprove() {
    const sample = this.selected();
    if (!sample || this.submittingAction() || this.decisionDone()) return;
    this.actionError.set('');
    this.submittingAction.set(true);
    this.accreditationApi.approveSample(sample.id).subscribe({
      next: (res) => {
        this.submittingAction.set(false);
        this.showApproveConfirm.set(false);
        if (res.success) {
          this.actionSuccess.set('تم اعتماد نموذج الاعتماد بنجاح');
          this.applyDecision('APPROVED', res.data);
        } else {
          this.actionError.set(res.message || 'تعذر اعتماد النموذج، حاول مرة أخرى');
        }
      },
      error: (err) => {
        this.submittingAction.set(false);
        this.showApproveConfirm.set(false);
        handleAdminError(this.host.nativeElement, err, { fallback: 'تعذر اعتماد النموذج، حاول مرة أخرى' }, (m) => this.actionError.set(m));
        if (err?.status === 409) this.resyncAfterConflict();
      },
    });
  }

  openRejectForm() {
    this.rejectionReason.set('');
    this.actionError.set('');
    this.actionSuccess.set('');
    this.showRejectForm.set(true);
  }

  cancelRejectForm() {
    this.showRejectForm.set(false);
    this.rejectionReason.set('');
    this.actionError.set('');
  }

  selectRejectionTemplate(text: string) {
    this.rejectionReason.set(text);
  }

  submitReject() {
    const sample = this.selected();
    if (!sample || this.submittingAction() || this.decisionDone()) return;
    const reason = this.rejectionReason().trim();
    if (reason.length < 2) {
      this.actionError.set('');
      void reportAdminProblems(this.host.nativeElement, [{ field: 'acc-reject-reason', message: reason ? 'سبب الرفض قصير جدًا: اكتب حرفين على الأقل' : 'يرجى كتابة سبب الرفض (حرفان على الأقل)' }]);
      return;
    }
    this.actionError.set('');
    this.submittingAction.set(true);
    this.accreditationApi.rejectSample(sample.id, { rejectionReason: reason }).subscribe({
      next: (res) => {
        this.submittingAction.set(false);
        if (res.success) {
          this.actionSuccess.set('تم رفض نموذج الاعتماد وإشعار مقدم الخدمة بالسبب');
          this.showRejectForm.set(false);
          this.rejectionReason.set('');
          this.applyDecision('REJECTED', res.data);
        } else {
          this.actionError.set(res.message || 'تعذر رفض النموذج، حاول مرة أخرى');
        }
      },
      error: (err) => {
        this.submittingAction.set(false);
        handleAdminError(this.host.nativeElement, err, { fallback: 'تعذر رفض النموذج، حاول مرة أخرى', resolve: { rejectionReason: 'acc-reject-reason' } }, (m) => this.actionError.set(m));
        if (err?.status === 409) this.resyncAfterConflict();
      },
    });
  }

  providerName(sample: AccreditationSample): string {
    const u = sample.providerProfile?.user;
    if (!u) return '—';
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return name || '—';
  }

  specialtyName(sample: AccreditationSample): string {
    return sample.providerSpecialty?.specialty?.nameAr || sample.providerSpecialty?.specialty?.name || '—';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return formatWsText(new Date(value), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', });
  }

  shortId(id: string): string {
    return id.length > 8 ? id.slice(0, 8) + '…' : id;
  }

  /** Display name of a stored attachment value. Null-safe: a bad value gives a generic name instead of an exception. */
  attachmentName(value: unknown, index: number): string {
    return proofFileName(value, index);
  }

  /** Short Arabic file-size text, '' when unknown. */
  sizeText(bytes: number | null | undefined): string {
    if (typeof bytes !== 'number' || !(bytes > 0)) return '';
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} م.ب` : `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
  }

  /** Only http(s) links are rendered as clickable links. */
  isWebUrl(url: string | null | undefined): boolean {
    return !!url && /^https?:\/\//i.test(url);
  }
}
