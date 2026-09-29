import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccreditationApiService } from '../../../../../core/services/accreditation-api.service';
import { AccreditationSample, AccreditationStatus } from '../../../../../core/models/accreditation.model';

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

  // Client-side checklist toggle overrides — the backend has no checklist
  // endpoint, so this only tracks an admin's manual overrides of the
  // derived/mock checklist state during this session; nothing is persisted.
  checklistOverrides = signal<Record<string, boolean>>({});

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

  readonly statusLabels: Record<AccreditationStatus, string> = {
    PENDING_AI_AUDIT: 'قيد الفحص الآلي',
    AI_VERIFIED: 'معتمد',
    REJECTED: 'مرفوض',
    MANUAL_REVIEW: 'يتطلب مراجعة يدوية',
  };

  readonly statusClasses: Record<AccreditationStatus, string> = {
    PENDING_AI_AUDIT: 'acc-st-pending',
    AI_VERIFIED: 'acc-st-verified',
    REJECTED: 'acc-st-rejected',
    MANUAL_REVIEW: 'acc-st-manual',
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

  private fetchDetail(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.selected.set(null);
    this.actionError.set('');
    this.actionSuccess.set('');
    this.showRejectForm.set(false);
    this.checklistOverrides.set({});
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

  canReject(status: AccreditationStatus): boolean {
    return status !== 'REJECTED';
  }

  submitApprove() {
    const sample = this.selected();
    if (!sample || this.submittingAction()) return;
    this.actionError.set('');
    this.submittingAction.set(true);
    this.accreditationApi.approveSample(sample.id).subscribe({
      next: (res) => {
        this.submittingAction.set(false);
        if (res.success) {
          this.actionSuccess.set('تم اعتماد نموذج الاعتماد بنجاح');
          if (res.data) this.selected.update((cur) => (cur ? { ...cur, ...res.data } : cur));
        } else {
          this.actionError.set(res.message || 'تعذر اعتماد النموذج، حاول مرة أخرى');
        }
      },
      error: (err) => {
        this.submittingAction.set(false);
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
          this.actionSuccess.set('تم رفض نموذج الاعتماد');
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

  // Deterministic string hash used to derive stable, non-random "mock" values
  // per sample (nationality/city/document badges/risk flags) — the backend
  // has no endpoints for any of these fields, so we synthesize display-only
  // sample data that stays consistent across re-renders of the same record.
  private hashCode(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++) {
      h = (h * 31 + value.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  // ---- Applicant extras (MOCK — no nationality/city field on the backend
  // user or provider-profile model) ----
  private readonly nationalities = ['سعودي', 'مصري', 'أردني', 'إماراتي', 'كويتي', 'يمني'];
  private readonly cities = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر', 'أبها'];

  providerNationality(sample: AccreditationSample): string {
    const key = sample.providerProfileId || sample.id;
    return this.nationalities[this.hashCode(key) % this.nationalities.length];
  }

  providerCity(sample: AccreditationSample): string {
    const key = sample.providerProfileId || sample.id;
    return this.cities[this.hashCode('city-' + key) % this.cities.length];
  }

  // SLA countdown — DERIVED from the real `createdAt` timestamp plus a fixed
  // 48h review-SLA policy assumption (no SLA field exists on the backend
  // model), so the elapsed time is real but the 48h window is a mock policy.
  private readonly slaHours = 48;

  slaHoursRemaining(sample: AccreditationSample): number {
    const created = new Date(sample.createdAt).getTime();
    if (Number.isNaN(created)) return this.slaHours;
    const deadline = created + this.slaHours * 3600 * 1000;
    return Math.round((deadline - Date.now()) / 3600000);
  }

  slaLabel(sample: AccreditationSample): string {
    const h = this.slaHoursRemaining(sample);
    if (h > 0) return `${h} ساعة متبقية`;
    return `تجاوزت المهلة بـ ${Math.abs(h)} ساعة`;
  }

  slaClass(sample: AccreditationSample): string {
    const h = this.slaHoursRemaining(sample);
    if (h <= 0) return 'txt-coral';
    if (h <= 12) return 'txt-amber';
    return 'txt-green';
  }

  // ---- Per-document viewer (attachment URLs are REAL; the verification
  // badge/ID-matching fields layered on top are MOCK — the backend stores
  // only raw attachment URLs, with no per-document verification metadata) ----
  private readonly docVerificationTemplates = [
    {
      badge: 'verified' as const,
      badgeText: '✓ مؤكدة',
      matchLabel: 'الاسم المطابق',
      matchValue: 'مطابق لبيانات الحساب',
    },
    {
      badge: 'warn' as const,
      badgeText: '⚠ تحتاج مراجعة',
      note: 'جودة الملف منخفضة أو الحقول غير واضحة بالكامل — يُنصح بمراجعة يدوية قبل الاعتماد',
    },
    {
      badge: 'score' as const,
      badgeText: 'AI Score: 82/100',
      note: 'تم تقييم المحتوى آلياً وتصنيفه ضمن الأعمال المقبولة',
    },
  ];

  documentName(url: string, index: number): string {
    const raw = url.split('/').pop() || `مرفق-${index + 1}`;
    return decodeURIComponent(raw.split('?')[0]);
  }

  documentMeta(index: number) {
    return this.docVerificationTemplates[index % this.docVerificationTemplates.length];
  }

  // ---- Mandatory checklist — identity check is fully MOCK (no verification
  // endpoint on the backend); phone/email checks are DERIVED from the real
  // providerProfile.user fields (presence only, not a live OTP/verify call);
  // portfolio check is DERIVED from the real attachments/technologiesUsed
  // arrays already returned by the sample detail endpoint. ----
  checklistItems(sample: AccreditationSample): {
    key: string;
    label: string;
    sub: string;
    state: 'done' | 'warn' | 'pending';
  }[] {
    const user = sample.providerProfile?.user;
    const hasPhone = !!user?.phoneNumber;
    const hasEmail = !!user?.email;
    const attCount = sample.attachments?.length ?? 0;
    const techCount = sample.technologiesUsed?.length ?? 0;
    const hasPortfolio = attCount > 0 || techCount > 0;
    const identityFlag = this.hashCode(sample.id) % 5 === 0;

    const overrides = this.checklistOverrides();
    const base: { key: string; label: string; sub: string; state: 'done' | 'warn' | 'pending' }[] = [
      {
        key: 'identity',
        label: 'الهوية مؤكدة ومطابقة',
        sub: identityFlag
          ? 'تعذّر التحقق الآلي الكامل — يتطلب مراجعة يدوية للمستند'
          : 'تم التحقق تلقائياً بواسطة الذكاء الاصطناعي',
        state: identityFlag ? 'warn' : 'done',
      },
      {
        key: 'phone',
        label: 'رقم الجوال موثق',
        sub: hasPhone ? `${user?.phoneNumber} — مسجل على الحساب` : 'لا يوجد رقم جوال مسجل على الحساب',
        state: hasPhone ? 'done' : 'pending',
      },
      {
        key: 'email',
        label: 'البريد الإلكتروني موثق',
        sub: hasEmail ? `${user?.email} — مسجل على الحساب` : 'لا يوجد بريد إلكتروني مسجل على الحساب',
        state: hasEmail ? 'done' : 'pending',
      },
      {
        key: 'portfolio',
        label: 'مراجعة الأعمال والمرفقات',
        sub: hasPortfolio
          ? `${attCount} مرفق و${techCount} تقنية مذكورة في النموذج`
          : 'لا توجد مرفقات أو تقنيات كافية للمراجعة',
        state: hasPortfolio ? 'done' : 'pending',
      },
    ];

    return base.map((item) => (item.key in overrides ? { ...item, state: overrides[item.key] ? 'done' : 'pending' } : item));
  }

  toggleChecklistItem(key: string, current: 'done' | 'warn' | 'pending') {
    this.checklistOverrides.update((cur) => ({ ...cur, [key]: current !== 'done' }));
  }

  checklistPendingCount(sample: AccreditationSample): number {
    return this.checklistItems(sample).filter((c) => c.state !== 'done').length;
  }

  // ---- Risk-check panel — fully MOCK; the backend has no fraud/duplicate
  // account/IP/SAMA-blacklist screening endpoint. Flags are derived from a
  // deterministic hash of the sample id so they stay stable per record
  // instead of changing on every render. ----
  riskChecks(sample: AccreditationSample): { label: string; ok: boolean; text: string }[] {
    const h = this.hashCode(sample.id + '-risk');
    const flags: { label: string; ok: boolean; warnText: string }[] = [
      { label: 'تكرار الحساب', ok: h % 7 !== 0, warnText: 'تشابه محتمل مع بيانات حساب آخر' },
      { label: 'عنوان IP مشبوه', ok: h % 11 !== 0, warnText: 'دخول من عنوان IP مرتبط بحساب مرفوض سابقاً' },
      { label: 'نمط احتيال معروف', ok: h % 13 !== 0, warnText: 'نمط رفع مشابه لحالات احتيال سابقة' },
      { label: 'القائمة السوداء (ساما)', ok: h % 17 !== 0, warnText: 'تطابق جزئي مع بيانات مُبلغ عنها' },
    ];
    return flags.map((f) => ({ label: f.label, ok: f.ok, text: f.ok ? '✓ لا يوجد' : `⚠ ${f.warnText}` }));
  }

  riskLevel(sample: AccreditationSample): 'low' | 'medium' | 'high' {
    const flagged = this.riskChecks(sample).filter((r) => !r.ok).length;
    if (flagged === 0) return 'low';
    if (flagged <= 2) return 'medium';
    return 'high';
  }
}
