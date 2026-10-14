import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccreditationApiService } from '../../../../../core/services/accreditation-api.service';
import { AccreditationSample, AssessmentFlagCode, AssessmentReviewData } from '../../../../../core/models/accreditation.model';
import { providerProfileLink, sampleStatusClass, sampleStatusLabel } from '../accreditation-status';

@Component({
  selector: 'app-sa-accreditation-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-accreditation-detail.html',
  styleUrls: ['../sa-accreditations.css', './sa-accreditation-detail.css'],
})
export class SaAccreditationDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private accreditationApi = inject(AccreditationApiService);

  selected = signal<AccreditationSample | null>(null);
  loading = signal(true);
  notFound = signal(false);
  error = signal('');

  showRejectForm = signal(false);
  rejectionReason = signal('');
  submittingAction = signal(false);
  actionError = signal('');
  actionSuccess = signal('');

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
    return sample.providerSpecialty?.status !== 'APPROVED';
  }

  canReject(sample: AccreditationSample): boolean {
    return sample.status !== 'REJECTED';
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
    if (!sample || this.submittingAction()) return;
    this.actionError.set('');
    this.submittingAction.set(true);
    this.accreditationApi.approveSample(sample.id).subscribe({
      next: (res) => {
        this.submittingAction.set(false);
        this.showApproveConfirm.set(false);
        if (res.success) {
          this.actionSuccess.set('تم اعتماد نموذج الاعتماد بنجاح');
          if (res.data) this.selected.update((cur) => (cur ? { ...cur, ...res.data } : cur));
        } else {
          this.actionError.set(res.message || 'تعذر اعتماد النموذج، حاول مرة أخرى');
        }
      },
      error: (err) => {
        this.submittingAction.set(false);
        this.showApproveConfirm.set(false);
        this.actionError.set(err?.error?.message || 'تعذر اعتماد النموذج، حاول مرة أخرى');
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
    if (!sample || this.submittingAction()) return;
    const reason = this.rejectionReason().trim();
    if (reason.length < 2) {
      this.actionError.set('يرجى كتابة سبب الرفض (حرفان على الأقل)');
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
          if (res.data) this.selected.update((cur) => (cur ? { ...cur, ...res.data } : cur));
        } else {
          this.actionError.set(res.message || 'تعذر رفض النموذج، حاول مرة أخرى');
        }
      },
      error: (err) => {
        this.submittingAction.set(false);
        this.actionError.set(err?.error?.message || 'تعذر رفض النموذج، حاول مرة أخرى');
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
    return new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  shortId(id: string): string {
    return id.length > 8 ? id.slice(0, 8) + '…' : id;
  }

  /** Presence facts read straight from the sample (nothing is checked or simulated here). */
  attachmentName(url: string, index: number): string {
    const raw = url.split('/').pop() || `مرفق-${index + 1}`;
    try { return decodeURIComponent(raw.split('?')[0]); } catch { return raw.split('?')[0]; }
  }

  /** Only http(s) links are rendered as clickable links. */
  isWebUrl(url: string | null | undefined): boolean {
    return !!url && /^https?:\/\//i.test(url);
  }
}
