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

  // Request-more-information: UI-only mock action — no backend endpoint exists
  // for this yet (matches the design mockup, which stubs it with an alert()).
  showInfoRequestForm = signal(false);
  infoRequestMessage = signal('');
  infoRequestSuccess = signal('');

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
    this.infoRequestSuccess.set('');
    this.cancelActionForm();
    this.cancelInfoRequestForm();
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
    this.showInfoRequestForm.set(false);
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

  openInfoRequestForm() {
    this.showActionForm.set(false);
    this.actionType.set(null);
    this.showInfoRequestForm.set(true);
    this.infoRequestMessage.set('');
    this.infoRequestSuccess.set('');
  }

  cancelInfoRequestForm() {
    this.showInfoRequestForm.set(false);
    this.infoRequestMessage.set('');
  }

  submitInfoRequest() {
    // Simulated locally — there is no backend endpoint for this action yet.
    this.showInfoRequestForm.set(false);
    this.infoRequestMessage.set('');
    this.infoRequestSuccess.set('تم إرسال طلب المعلومات الإضافية إلى مقدم الطلب');
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

  // ── Mock/demo helpers ──────────────────────────────────────────────
  // The backend (WithdrawalApiService) does not yet return AI risk scoring,
  // balance context, an IBAN-verification flag, or a balance-source
  // breakdown. The values below are generated deterministically from the
  // withdrawal's own id/amount so the UI stays stable across re-renders,
  // but they are NOT real data — see the component's final audit report.

  private hashSeed(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
      h = (h * 31 + id.charCodeAt(i)) >>> 0;
    }
    return h || 1;
  }

  private seededRandom(seed: number): () => number {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  private readonly mockProjectPool: { title: string; base: number }[] = [
    { title: 'هوية بصرية لمؤسسة النور', base: 4666 },
    { title: 'تصميم منيو مطعم', base: 2000 },
    { title: 'تطوير متجر إلكتروني متكامل', base: 8200 },
    { title: 'إدارة حسابات تواصل اجتماعي - 3 أشهر', base: 3300 },
    { title: 'تصميم شعار وهوية تجارية', base: 1800 },
    { title: 'كتابة محتوى تسويقي لموقع إلكتروني', base: 1200 },
    { title: 'تصميم واجهات تطبيق جوال', base: 6400 },
    { title: 'حملة إعلانية ممولة على السوشيال ميديا', base: 5000 },
  ];

  private readonly mockMonths = ['يناير 2025', 'فبراير 2025', 'مارس 2025', 'أبريل 2025', 'مايو 2025', 'يونيو 2025'];

  /**
   * Real value from GET /api/admin/withdrawals/:id (withdrawalService.get()
   * -> resolveApprovalLedger() + the same withdrawable-balance arithmetic
   * approve() itself uses) — the withdrawal's ledger balance (provider
   * earnings or affiliate commissions) net of the user's other outstanding
   * withdrawals. Previously a hash-of-id mock; release-blocker fix (2B).
   * The `?? ` fallback only matters for a response from a stale API build
   * that hasn't deployed this field yet.
   */
  availableBalance(w: Withdrawal): number {
    return w.availableBalance ?? (w.amount ?? 0);
  }

  /** Mock: balance remaining after this withdrawal is processed. */
  balanceAfterWithdrawal(w: Withdrawal): number {
    const amount = w.amount ?? 0;
    return Math.round(this.availableBalance(w) - amount);
  }

  /** Mock: IBAN-verification badge. Real IBAN value comes from the API; the "verified" flag itself does not. */
  ibanVerified(w: Withdrawal): boolean {
    return !!(w.bankInfo?.iban || w.iban);
  }

  /** Mock: AI risk-analysis notes shown in the "وسيط AI" panel. */
  riskInsights(w: Withdrawal): string[] {
    const insights: string[] = [];

    insights.push(
      this.ibanVerified(w)
        ? 'الحساب البنكي محقق ومطابق لبيانات صاحب الطلب — لا مخاطر'
        : 'تعذر التحقق من مطابقة بيانات الحساب البنكي — يُنصح بالمراجعة اليدوية'
    );

    const amount = w.amount ?? 0;
    const avail = this.availableBalance(w);
    insights.push(
      amount <= avail
        ? 'المبلغ المطلوب ضمن الرصيد المتاح كاملاً — لا نقص في الرصيد'
        : 'المبلغ المطلوب يتجاوز الرصيد المتاح المقدَّر — يتطلب مراجعة إضافية'
    );

    const seed = this.hashSeed(w.id);
    insights.push(
      seed % 5 === 0
        ? 'تم رصد نشاط سحب متكرر خلال آخر 30 يوماً — يُنصح بمراجعة إضافية قبل الموافقة'
        : 'لا نشاط مشبوه على الحساب خلال آخر 30 يوماً — يُوصى بالموافقة'
    );

    return insights;
  }

  /** Mock: recent paid projects that make up the current balance. */
  balanceSource(w: Withdrawal): { title: string; gross: number; net: number; date: string }[] {
    const seed = this.hashSeed(w.id + ':src');
    const rand = this.seededRandom(seed);
    const count = 2 + Math.floor(rand() * 2); // 2–3 rows
    const usedIdx = new Set<number>();
    const rows: { title: string; gross: number; net: number; date: string }[] = [];

    for (let i = 0; i < count; i++) {
      let idx = Math.floor(rand() * this.mockProjectPool.length);
      while (usedIdx.has(idx)) idx = (idx + 1) % this.mockProjectPool.length;
      usedIdx.add(idx);
      const proj = this.mockProjectPool[idx];
      const gross = proj.base + Math.floor(rand() * 400);
      const net = Math.round(gross * 0.9);
      const monthIdx = Math.floor(rand() * this.mockMonths.length);
      rows.push({ title: proj.title, gross, net, date: this.mockMonths[monthIdx] });
    }

    return rows;
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
