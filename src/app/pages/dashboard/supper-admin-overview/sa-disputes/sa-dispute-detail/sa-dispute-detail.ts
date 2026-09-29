import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DisputeApiService } from '../../../../../core/services/dispute-api.service';
import { Dispute, DisputeStatus, DisputeAction, ResolveDisputePayload, DisputeAiSummary } from '../../../../../core/models/dispute.model';

@Component({
  selector: 'app-sa-dispute-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-dispute-detail.html',
  styleUrls: ['../sa-disputes.css', './sa-dispute-detail.css'],
})
export class SaDisputeDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private disputeApi = inject(DisputeApiService);

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

  // Advisory-only AI summary — entirely separate from the manual
  // resolve/reject state above. Never pre-fills resolutionText/resolutionNote.
  aiSummary = signal<DisputeAiSummary | null>(null);
  aiSummaryLoading = signal(false);
  aiSummaryError = signal('');

  // Interactive escrow-split control. There is no dedicated "apply split"
  // backend endpoint (see DisputeApiService's documented gaps), so this
  // slider feeds the one real write endpoint that exists — resolveAdminDispute
  // — by generating the resolution text/note from the chosen split and
  // opening the existing manual resolve form pre-filled with it.
  splitClaimantPct = signal(50);

  // ── Local, deterministic display-only enrichment ──────────────────────
  // The admin dispute API (see DisputeApiService) does not return
  // client/provider identity, an escrow/dispute amount, per-evidence party
  // attribution, a step-by-step activity log, or similar-case precedents.
  // Sibling admin pages in this module (sa-requests.ts, sa-contracts.ts)
  // hardcode mock identity/amount fields the same way pending a real
  // backend contract — this follows that established pattern. Everything
  // below is seeded off the real dispute.id so a given dispute always shows
  // the same mock party/amount on repeat opens (not re-randomized), but
  // none of it is persisted or sent to the backend. See
  // BACKEND_BLOCKED_ISSUES.md for the tracked gap.
  private readonly mockClaimantNames = ['شركة الخليج التقنية', 'مؤسسة النور للتسويق', 'عبدالله المطيري', 'شركة رواد الأعمال', 'نورة العتيبي'];
  private readonly mockRespondentNames = ['سعد الغامدي', 'خالد الحربي', 'مؤسسة الإبداع الرقمي', 'ريم القحطاني', 'فهد الدوسري'];
  private readonly mockRespondentDefenses = [
    'التأخير سببه تعديلات إضافية طلبها الطرف الآخر خارج نطاق الاتفاق الأصلي',
    'تم تسليم العمل حسب المتفق عليه، والملاحظات المطروحة تقييمية وليست أخطاء فعلية',
    'لم يتم تزويدي بكامل المتطلبات في الوقت المناسب مما أثّر على الجدول الزمني',
    'العمل المنجز مطابق للبريف الأصلي المرسل قبل بدء التنفيذ',
  ];
  private readonly mockSimilarCases = [
    { summary: 'تأخر تسليم + رسوم إضافية — تصميم ويب', outcome: 'حُلَّ: 30% للطالب', color: '#0FA99A' },
    { summary: 'عدم مطابقة التسليم للمواصفات — برمجة ويب', outcome: 'حُلَّ: 50/50', color: '#5DA0FF' },
    { summary: 'تعديلات خارج نطاق العقد — Frontend', outcome: 'حُلَّ: للمقدم 70%', color: '#FFB400' },
    { summary: 'نزاع على جودة التسليم النهائي — تصميم جرافيك', outcome: 'حُلَّ: للمقدم بالكامل', color: '#2BD4C7' },
    { summary: 'تأخر التواصل وتوقف التنفيذ — تسويق رقمي', outcome: 'حُلَّ: 40% للطالب', color: '#0FA99A' },
  ];

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
    this.selectedDispute.set(null);
    this.aiSummary.set(null);
    this.aiSummaryError.set('');
    this.splitClaimantPct.set(50);
    this.resolveSuccess.set('');
    this.cancelResolveForm();
    this.disputeApi.getAdminDispute(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.selectedDispute.set(res.data);
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

  private seedHash(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h;
  }

  /** MOCK — no backend field for this yet. See class-level note above. */
  mockDisputeAmount(d: Dispute): number {
    const seed = this.seedHash(d.id);
    return 2000 + (seed % 18) * 1000;
  }

  /** MOCK claimant/respondent identity. `claimText` for the claimant is the
   *  real `d.reason`; the respondent's defense text is fully mock since the
   *  API has no provider-response field. */
  partyInfo(d: Dispute, role: 'claimant' | 'respondent'): { name: string; initials: string; avBg: string; roleLabel: string; claimText: string; isMockClaim: boolean } {
    const seed = this.seedHash(d.id + role);
    if (role === 'claimant') {
      const name = this.mockClaimantNames[seed % this.mockClaimantNames.length];
      return {
        name,
        initials: name.trim().charAt(0),
        avBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
        roleLabel: 'الطرف المدّعي (طالب)',
        claimText: d.reason || 'لم يُسجَّل سبب صريح للادعاء',
        isMockClaim: false,
      };
    }
    const name = this.mockRespondentNames[seed % this.mockRespondentNames.length];
    return {
      name,
      initials: name.trim().charAt(0),
      avBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)',
      roleLabel: 'الطرف المدّعى عليه (مقدم)',
      claimText: this.mockRespondentDefenses[seed % this.mockRespondentDefenses.length],
      isMockClaim: true,
    };
  }

  /** Real evidence URLs from the API; the "submitted by" attribution is a
   *  placeholder (alternating by upload order) since the API doesn't carry
   *  a party association per evidence item. */
  evidenceParty(index: number): 'claimant' | 'respondent' {
    return index % 2 === 0 ? 'claimant' : 'respondent';
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

  /** Activity log — only the "opened" and "resolved/rejected" entries carry
   *  real API timestamps (createdAt/resolvedAt). The intermediate entries
   *  are approximate placeholders (no per-event audit trail exists in the
   *  API yet) and are explicitly marked "غير مؤرَّخ من الـ API". */
  activityLog(d: Dispute): { label: string; dateLabel: string; dotColor: string; approx: boolean }[] {
    const events: { label: string; dateLabel: string; dotColor: string; approx: boolean }[] = [];
    events.push({
      label: `فتح النزاع بواسطة ${this.partyInfo(d, 'claimant').name}`,
      dateLabel: this.formatDate(d.createdAt),
      dotColor: '#FFB400',
      approx: false,
    });
    if (d.evidence && d.evidence.length > 0) {
      events.push({
        label: `إرفاق ${d.evidence.length} ${d.evidence.length === 1 ? 'دليل' : 'أدلة'} على النزاع`,
        dateLabel: 'تاريخ الرفع غير مسجَّل لكل ملف على حدة',
        dotColor: '#5DA0FF',
        approx: true,
      });
    }
    if (d.status === 'UNDER_REVIEW' || d.status === 'RESOLVED' || d.status === 'REJECTED') {
      events.push({
        label: 'انتقل النزاع إلى حالة قيد المراجعة',
        dateLabel: 'غير مؤرَّخ من الـ API',
        dotColor: '#A56BE0',
        approx: true,
      });
    }
    if (d.status === 'RESOLVED' || d.status === 'REJECTED') {
      events.push({
        label: d.status === 'RESOLVED' ? 'تم حل النزاع' + (d.resolution ? ` — ${d.resolution}` : '') : 'تم رفض النزاع' + (d.resolution ? ` — ${d.resolution}` : ''),
        dateLabel: this.formatDate(d.resolvedAt),
        dotColor: d.status === 'RESOLVED' ? '#0FA99A' : '#FF8C69',
        approx: false,
      });
    }
    return events;
  }

  /** MOCK — no "similar disputes" endpoint exists yet. Picks 3 of 5 static
   *  illustrative examples, deterministic per dispute.id. */
  similarCases(d: Dispute): { id: string; summary: string; outcome: string; color: string }[] {
    const seed = this.seedHash(d.id + 'similar');
    const pool = this.mockSimilarCases;
    const start = seed % pool.length;
    const picks = [pool[start], pool[(start + 1) % pool.length], pool[(start + 2) % pool.length]];
    return picks.map((p, i) => ({ id: `D-${100 + (seed % 800) + i * 7}`, ...p }));
  }

  splitClaimantAmount(d: Dispute): number {
    return Math.round((this.mockDisputeAmount(d) * this.splitClaimantPct()) / 100);
  }

  splitRespondentAmount(d: Dispute): number {
    return this.mockDisputeAmount(d) - this.splitClaimantAmount(d);
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
      const amt = this.splitClaimantAmount(d);
      const amt2 = this.splitRespondentAmount(d);
      this.resolutionText.set(`PARTIAL_REFUND`);
      this.resolutionNote.set(`تقسيم الضمان: ${pct}% للطرف المدّعي (${amt.toLocaleString('ar-SA')} ر.س) و${100 - pct}% للطرف المدّعى عليه (${amt2.toLocaleString('ar-SA')} ر.س)`);
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
    this.showResolveForm.set(true);
  }

  cancelResolveForm() {
    this.showResolveForm.set(false);
    this.resolveAction.set(null);
    this.resolutionText.set('');
    this.resolutionNote.set('');
    this.resolveError.set('');
  }

  selectPreset(preset: string) {
    this.resolutionText.set(preset);
  }

  submitResolve() {
    const dispute = this.selectedDispute();
    const action = this.resolveAction();
    if (!dispute || !action) return;
    if (this.submittingResolve()) return;

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
          this.resolveSuccess.set('تم تحديث حالة النزاع بنجاح');
          this.showResolveForm.set(false);
          this.resolveAction.set(null);
          this.resolutionText.set('');
          this.resolutionNote.set('');
          if (res.data) {
            this.selectedDispute.set(res.data);
          } else {
            this.disputeApi.getAdminDispute(dispute.id).subscribe({
              next: (detail) => {
                if (detail.success && detail.data) {
                  this.selectedDispute.set(detail.data);
                }
              },
              error: () => {},
            });
          }
        } else {
          this.resolveError.set(res.message || 'تعذر تحديث حالة النزاع، حاول مرة أخرى');
        }
      },
      error: (err) => {
        this.submittingResolve.set(false);
        this.resolveError.set(err?.error?.message || 'تعذر تحديث حالة النزاع، حاول مرة أخرى');
      },
    });
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
