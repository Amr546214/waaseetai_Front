import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { ProviderCouponService } from '../../../../../core/services/provider-coupon.service';
import { CompanyTeamService } from '../../../../../core/services/company-team.service';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { MarketingCenterService } from '../../../../../core/services/marketing-center.service';
import { CouponDiscountType, CreateCouponPayload, ProviderCoupon, UpdateCouponPayload } from '../../../../../core/models/marketing.model';
import { CompanyTeamMember } from '../../../../../core/models/company-team.model';
import { MarketingAssignPicker } from '../assign-picker/assign-picker';
import {
  COMPANY_APPROVAL_THRESHOLD, ProviderModelOption, couponNeedsApproval, dateInputToIso, httpErrorMessage, isoToDateInput,
  mapProviderModels, todayInput,
} from '../marketing-utils';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { SubmitGuard, focusInvalidControls, reportBackendError } from '../../../../../shared/forms/form-error-focus';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { WsCurrencyPipe } from '../../../../../shared/money/money.pipe';

const CODE_RE = /^[A-Za-z0-9_-]{3,50}$/;
const MAX_SCOPE = 50;

interface CouponForm {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number | null;
  minimumAmount: number | null;
  startAt: string;
  expiresAt: string;
  maxUses: number | null;
  maxUsesPerUser: number | null;
  scopeMode: 'all' | 'specific';
  serviceIds: string[];
  excludedServiceIds: string[];
  internalNote: string;
  assignedToTeamMemberId: string | null;
}

type Errors = Partial<Record<keyof CouponForm, string>>;

/** P-PR-040-إنشاء / P-CO-MK-006-إنشاء — create (2-step wizard) and edit a coupon. */
@Component({
  selector: 'app-marketing-coupon-form',
  standalone: true,
  imports: [WsCurrencyPipe, CommonModule, FormsModule, RouterLink, MarketingAssignPicker],
  templateUrl: './coupon-form.html',
  styleUrls: ['../marketing-shared.css'],
})
export class MarketingCouponForm implements OnInit {
  private authStore = inject(AuthStore);
  private notify = inject(UiNotificationService);
  private couponApi = inject(ProviderCouponService);
  private teamApi = inject(CompanyTeamService);
  private modelsApi = inject(NewProjectService);
  private centerApi = inject(MarketingCenterService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private guard = new SubmitGuard();

  isCompanyMode = computed<boolean>(() => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY);
  readonly threshold = COMPANY_APPROVAL_THRESHOLD;

  editId = signal<string | null>(null);
  original = signal<ProviderCoupon | null>(null);
  loading = signal(false);
  loadError = signal<string | null>(null);
  saving = signal(false);
  step = signal<1 | 2>(1);

  models = signal<ProviderModelOption[]>([]);
  modelsLoading = signal(true);
  team = signal<CompanyTeamMember[]>([]);

  form = signal<CouponForm>(this.emptyForm());
  errors = signal<Errors>({});
  submitted1 = signal(false);
  submitted2 = signal(false);
  /** Honest message for failures that belong to no field (network, 429, 5xx, 403, 409...). Never marked on a field. */
  formError = signal<string | null>(null);

  needsApproval = computed(() => {
    const f = this.form();
    return this.isCompanyMode() && couponNeedsApproval({ discountType: f.discountType, discountValue: f.discountValue, maxUses: f.maxUses });
  });

  approvalReason = computed(() => {
    const f = this.form();
    const reasons: string[] = [];
    if (f.discountType === 'percentage' && (f.discountValue ?? 0) > COMPANY_APPROVAL_THRESHOLD) reasons.push(`الخصم يتجاوز ${COMPANY_APPROVAL_THRESHOLD}%`);
    if (!f.maxUses) reasons.push('لا يوجد حد أقصى لمرات الاستخدام');
    return reasons.join(' و');
  });

  scopeTooLarge = computed(() => this.models().length > MAX_SCOPE);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);

    this.modelsApi.getMyMarketModels().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.models.set(mapProviderModels(res));
        this.modelsLoading.set(false);
        this.syncScopeMode();
      },
      error: () => {
        this.models.set([]);
        this.modelsLoading.set(false);
      },
    });

    if (this.isCompanyMode()) {
      this.teamApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res => this.team.set(res.data ?? []),
        error: () => this.team.set([]),
      });
    }

    if (id) {
      this.loading.set(true);
      this.couponApi.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res => {
          this.original.set(res.data);
          this.form.set(this.fromCoupon(res.data));
          this.syncScopeMode();
          this.loading.set(false);
        },
        error: err => {
          this.loadError.set(httpErrorMessage(err, 'تعذر تحميل الكوبون'));
          this.loading.set(false);
        },
      });
    }
  }

  private emptyForm(): CouponForm {
    return {
      code: '', discountType: 'percentage', discountValue: null, minimumAmount: null,
      startAt: todayInput(), expiresAt: '', maxUses: null, maxUsesPerUser: null,
      scopeMode: 'all', serviceIds: [], excludedServiceIds: [], internalNote: '', assignedToTeamMemberId: null,
    };
  }

  private fromCoupon(c: ProviderCoupon): CouponForm {
    return {
      code: c.code, discountType: c.discountType, discountValue: c.discountValue, minimumAmount: c.minimumAmount,
      startAt: isoToDateInput(c.startAt), expiresAt: isoToDateInput(c.expiresAt), maxUses: c.maxUses,
      maxUsesPerUser: c.maxUsesPerUser, scopeMode: 'specific', serviceIds: [...c.serviceIds],
      excludedServiceIds: [...c.excludedServiceIds], internalNote: c.internalNote ?? '', assignedToTeamMemberId: c.assignedToTeamMemberId,
    };
  }

  /** In edit mode, a coupon whose scope covers every model is shown as «كل نماذجي». */
  private syncScopeMode(): void {
    const models = this.models();
    const c = this.original();
    if (!c || !models.length) return;
    const all = models.every(m => c.serviceIds.includes(m.id));
    this.patch({ scopeMode: all ? 'all' : 'specific' });
  }

  patch(p: Partial<CouponForm>): void {
    this.form.update(f => ({ ...f, ...p }));
    if (this.submitted1() || this.submitted2()) this.errors.set(this.validate());
  }

  // --- scope chips ------------------------------------------------------
  toggleService(id: string): void {
    const ids = this.form().serviceIds;
    this.patch({ serviceIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] });
  }

  toggleExcluded(id: string): void {
    const ids = this.form().excludedServiceIds;
    this.patch({ excludedServiceIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id] });
  }

  setScopeMode(mode: 'all' | 'specific'): void {
    this.patch({ scopeMode: mode, excludedServiceIds: mode === 'specific' ? [] : this.form().excludedServiceIds });
  }

  // --- validation (mirrors createCouponSchema) ---------------------------
  private validate(): Errors {
    const f = this.form();
    const e: Errors = {};
    if (!this.editId()) {
      if (!f.code.trim()) e.code = 'كود الكوبون مطلوب';
      else if (!CODE_RE.test(f.code.trim())) e.code = 'من 3 إلى 50 حرفاً: حروف وأرقام إنجليزية و - _ فقط بدون مسافات';
    }
    if (f.discountValue === null || f.discountValue === undefined || !(Number(f.discountValue) > 0)) e.discountValue = 'أدخل قيمة خصم أكبر من صفر';
    else if (f.discountType === 'percentage' && Number(f.discountValue) > 100) e.discountValue = 'النسبة يجب أن تكون بين 1 و100';
    if (f.minimumAmount !== null && f.minimumAmount !== undefined && Number(f.minimumAmount) < 0) e.minimumAmount = 'الحد الأدنى لا يمكن أن يكون سالباً';
    if (f.maxUses !== null && f.maxUses !== undefined && (!Number.isInteger(Number(f.maxUses)) || Number(f.maxUses) <= 0)) e.maxUses = 'عدد صحيح أكبر من صفر';
    if (f.maxUsesPerUser === null || f.maxUsesPerUser === undefined || (f.maxUsesPerUser as unknown) === '') e.maxUsesPerUser = 'أدخل عدد المرات المسموحة للعميل الواحد';
    else if (!Number.isInteger(Number(f.maxUsesPerUser)) || Number(f.maxUsesPerUser) <= 0) e.maxUsesPerUser = 'عدد صحيح أكبر من صفر';
    else if (f.maxUses && Number(f.maxUsesPerUser) > Number(f.maxUses)) e.maxUsesPerUser = 'لا يتجاوز الحد الأقصى الكلي';
    if (!f.startAt) e.startAt = 'تاريخ البداية مطلوب';
    if (f.expiresAt) {
      if (f.startAt && f.expiresAt < f.startAt) e.expiresAt = 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية';
      else if (!this.editId() && f.expiresAt < todayInput()) e.expiresAt = 'تاريخ الانتهاء في الماضي';
    }
    const scope = this.effectiveServiceIds();
    if (!scope.length) e.serviceIds = 'اختر نموذجاً واحداً على الأقل';
    else if (f.scopeMode === 'specific' && scope.length > MAX_SCOPE) e.serviceIds = `الحد الأقصى ${MAX_SCOPE} نموذجاً`;
    if (f.internalNote.length > 2000) e.internalNote = 'الملاحظة طويلة جداً (2000 حرف كحد أقصى)';
    return e;
  }

  private step1Keys: (keyof CouponForm)[] = ['code', 'discountValue', 'minimumAmount', 'startAt', 'expiresAt', 'maxUses', 'maxUsesPerUser'];

  /** Control id of each validated field (the DOM order of the form). */
  private static readonly FIELD_IDS: Partial<Record<keyof CouponForm, string>> = {
    code: 'cp-code', discountValue: 'cp-val', minimumAmount: 'cp-min', startAt: 'cp-start', expiresAt: 'cp-end',
    maxUses: 'cp-max', maxUsesPerUser: 'cp-per', serviceIds: 'cp-scope', internalNote: 'cp-note',
  };

  /** Opens the step that holds the first problem, then focuses the first invalid control below the sticky header. */
  private focusProblems(e: Errors): Promise<unknown> {
    const order: (keyof CouponForm)[] = [...this.step1Keys, 'serviceIds', 'internalNote'];
    const missing = order.filter(k => e[k]).map(k => ({ path: MarketingCouponForm.FIELD_IDS[k]!, message: e[k]!, key: k }));
    const stepOf = (path: string) => (path === 'cp-scope' || path === 'cp-note' ? 2 : 1);
    return focusInvalidControls(this.host.nativeElement, missing, { openStep: s => this.step.set(Number(s) as 1 | 2), stepOf });
  }

  goStep2(): void {
    this.submitted1.set(true);
    const e = this.validate();
    this.errors.set(e);
    if (this.step1Keys.some(k => e[k])) {
      void this.focusProblems(Object.fromEntries(this.step1Keys.filter(k => e[k]).map(k => [k, e[k]])) as Errors);
      return;
    }
    this.step.set(2);
  }

  private effectiveServiceIds(): string[] {
    const f = this.form();
    if (f.scopeMode === 'all') return this.models().slice(0, MAX_SCOPE).map(m => m.id);
    return f.serviceIds;
  }

  private buildPayload(): CreateCouponPayload {
    const f = this.form();
    const num = (v: number | null) => (v === null || v === undefined || (v as unknown) === '' ? null : Number(v));
    return {
      code: f.code.trim().toUpperCase(),
      discountType: f.discountType,
      discountValue: Number(f.discountValue),
      serviceIds: this.effectiveServiceIds(),
      minimumAmount: num(f.minimumAmount),
      maxUses: num(f.maxUses),
      maxUsesPerUser: Number(f.maxUsesPerUser) || 1,
      startAt: dateInputToIso(f.startAt) ?? undefined,
      expiresAt: dateInputToIso(f.expiresAt, true),
      excludedServiceIds: f.scopeMode === 'all' ? f.excludedServiceIds : [],
      internalNote: f.internalNote.trim() || null,
      assignedToTeamMemberId: this.isCompanyMode() ? f.assignedToTeamMemberId : null,
    };
  }

  save(): void {
    this.submitted1.set(true);
    this.submitted2.set(true);
    const e = this.validate();
    this.errors.set(e);
    if (Object.keys(e).length) {
      this.notify.warning('راجع الحقول المطلوبة');
      void this.focusProblems(e);
      return;
    }
    // A second click / Enter while the request is in flight does nothing (one request only).
    if (!this.guard.enter()) return;
    this.formError.set(null);
    const payload = this.buildPayload();
    const id = this.editId();
    this.saving.set(true);

    const req = id ? this.couponApi.update(id, this.diffForUpdate(payload)) : this.couponApi.create(payload);
    req.subscribe({
      next: res => {
        this.saving.set(false);
        if (this.isCompanyMode()) this.centerApi.refreshPendingCount();
        this.router.navigate(['/provider-overview/marketing/coupons', res.data.id]);
      },
      error: err => {
        this.saving.set(false);
        this.guard.release();
        void this.onSaveError(err);
      },
    });
  }

  /** 400/422 with field names -> at the field (opening its step); everything else stays a generic honest message. */
  private async onSaveError(err: unknown): Promise<void> {
    const mapped = mapHttpError(err, { fallback: 'تعذر حفظ الكوبون' });
    const steps: Record<string, number> = { serviceIds: 2, internalNote: 2 };
    for (const k of this.step1Keys) steps[k] = 1;
    const res = await reportBackendError(this.host.nativeElement, mapped, {
      resolve: { serviceIds: 'cp-scope', internalNote: 'cp-note' }, steps, openStep: s => this.step.set(Number(s) as 1 | 2),
    });
    if (res.handled && !Object.keys(res.unresolved).length) return;
    const unresolved = Object.values(res.unresolved);
    this.formError.set(unresolved.length ? `${mapped.message}: ${unresolved.join('، ')}` : mapped.message);
    this.notify.error(mapped.message);
  }

  /**
   * Edit: only send fields that actually changed. Important for company
   * accounts — the backend re-evaluates the approval threshold whenever
   * discountType/discountValue/maxUses are present in the body, so resending
   * unchanged values would bounce an approved coupon back to PENDING.
   */
  private diffForUpdate(payload: CreateCouponPayload): UpdateCouponPayload {
    const orig = this.original();
    if (!orig) return payload;
    const origForm = this.fromCoupon(orig);
    const saved = this.form();
    this.form.set({ ...origForm, scopeMode: 'specific' });
    const before = { ...this.buildPayload(), excludedServiceIds: [...orig.excludedServiceIds] };
    this.form.set(saved);
    const out: Record<string, unknown> = {};
    const same = (a: unknown, b: unknown) => {
      if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && [...a].sort().join() === [...b].sort().join();
      return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    };
    for (const key of Object.keys(payload) as (keyof CreateCouponPayload)[]) {
      if (key === 'code') continue;
      if (!same(payload[key], before[key])) out[key] = payload[key];
    }
    return out as UpdateCouponPayload;
  }
}
