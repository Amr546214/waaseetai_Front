import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { ProviderSpecialOfferService } from '../../../../../core/services/provider-special-offer.service';
import { CompanyTeamService } from '../../../../../core/services/company-team.service';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { MarketingCenterService } from '../../../../../core/services/marketing-center.service';
import { CreateSpecialOfferPayload, ProviderSpecialOffer, SpecialOfferType, UpdateSpecialOfferPayload } from '../../../../../core/models/marketing.model';
import { CompanyTeamMember } from '../../../../../core/models/company-team.model';
import { MarketingAssignPicker } from '../assign-picker/assign-picker';
import {
  COMPANY_APPROVAL_THRESHOLD, Flash, ProviderModelOption, dateInputToIso, httpErrorMessage, isoToDateInput, mapProviderModels,
  offerNeedsApproval, todayInput,
} from '../marketing-utils';

interface OfferForm {
  type: SpecialOfferType;
  name: string;
  discountValue: number | null;
  primaryServiceId: string;
  beneficiaryServiceId: string;
  validityDays: number | null;
  targetServiceId: string;
  startAt: string;
  expiresAt: string;
  badgeText: string;
  customerMessage: string;
  internalNote: string;
  assignedToTeamMemberId: string | null;
}

type Errors = Partial<Record<keyof OfferForm, string>>;

const SHAPE_KEYS: (keyof CreateSpecialOfferPayload)[] = ['type', 'primaryServiceId', 'beneficiaryServiceId', 'validityDays', 'targetServiceId'];

/** P-PR-041-إنشاء / P-CO-MK-007-إنشاء — create (single page) and edit a special offer. */
@Component({
  selector: 'app-marketing-offer-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MarketingAssignPicker],
  templateUrl: './offer-form.html',
  styleUrls: ['../marketing-shared.css'],
})
export class MarketingOfferForm implements OnInit {
  private authStore = inject(AuthStore);
  private offerApi = inject(ProviderSpecialOfferService);
  private teamApi = inject(CompanyTeamService);
  private modelsApi = inject(NewProjectService);
  private centerApi = inject(MarketingCenterService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  isCompanyMode = computed<boolean>(() => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY);
  readonly threshold = COMPANY_APPROVAL_THRESHOLD;
  readonly flash = new Flash();

  editId = signal<string | null>(null);
  original = signal<ProviderSpecialOffer | null>(null);
  loading = signal(false);
  loadError = signal<string | null>(null);
  saving = signal(false);
  submitted = signal(false);

  models = signal<ProviderModelOption[]>([]);
  modelsLoading = signal(true);
  team = signal<CompanyTeamMember[]>([]);

  form = signal<OfferForm>(this.emptyForm());
  errors = signal<Errors>({});
  /** Until the user edits the badge text by hand, it follows the offer type / discount. */
  private badgeTouched = false;

  needsApproval = computed(() => this.isCompanyMode() && offerNeedsApproval({ discountValue: this.form().discountValue }));

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.editId.set(id);

    this.modelsApi.getMyMarketModels().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.models.set(mapProviderModels(res));
        this.modelsLoading.set(false);
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
      this.badgeTouched = true;
      this.offerApi.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res => {
          this.original.set(res.data);
          this.form.set(this.fromOffer(res.data));
          this.loading.set(false);
        },
        error: err => {
          this.loadError.set(httpErrorMessage(err, 'تعذر تحميل العرض'));
          this.loading.set(false);
        },
      });
    }
  }

  private emptyForm(): OfferForm {
    return {
      type: 'BUNDLE', name: '', discountValue: null, primaryServiceId: '', beneficiaryServiceId: '', validityDays: 14,
      targetServiceId: '', startAt: todayInput(), expiresAt: '', badgeText: 'عرض باقة', customerMessage: '', internalNote: '',
      assignedToTeamMemberId: null,
    };
  }

  private fromOffer(o: ProviderSpecialOffer): OfferForm {
    return {
      type: o.type, name: o.name, discountValue: o.discountValue, primaryServiceId: o.primaryServiceId ?? '',
      beneficiaryServiceId: o.beneficiaryServiceId ?? '', validityDays: o.validityDays, targetServiceId: o.targetServiceId ?? '',
      startAt: isoToDateInput(o.startAt), expiresAt: isoToDateInput(o.expiresAt), badgeText: o.badgeText,
      customerMessage: o.customerMessage ?? '', internalNote: o.internalNote ?? '', assignedToTeamMemberId: o.assignedToTeamMemberId,
    };
  }

  private autoBadge(f: OfferForm): string {
    if (f.type === 'BUNDLE') return 'عرض باقة';
    return f.discountValue ? `خصم ${f.discountValue}%` : 'خصم خاص';
  }

  patch(p: Partial<OfferForm>): void {
    this.form.update(f => {
      const next = { ...f, ...p };
      if (!this.badgeTouched && !('badgeText' in p)) next.badgeText = this.autoBadge(next);
      return next;
    });
    if (this.submitted()) this.errors.set(this.validate());
  }

  onBadgeInput(v: string): void {
    this.badgeTouched = true;
    this.patch({ badgeText: v });
  }

  // --- validation (mirrors createSpecialOfferSchema + specialOfferShapeIssues) ---
  private validate(): Errors {
    const f = this.form();
    const e: Errors = {};
    if (!f.name.trim()) e.name = 'اسم العرض مطلوب';
    else if (f.name.trim().length > 100) e.name = '100 حرف كحد أقصى';
    const d = Number(f.discountValue);
    if (f.discountValue === null || f.discountValue === undefined || !(d > 0)) e.discountValue = 'أدخل نسبة خصم أكبر من صفر';
    else if (d > 100) e.discountValue = 'النسبة يجب أن تكون بين 1 و100';
    if (f.type === 'BUNDLE') {
      if (!f.primaryServiceId) e.primaryServiceId = 'اختر النموذج الأساسي';
      if (!f.beneficiaryServiceId) e.beneficiaryServiceId = 'اختر النموذج المستفيد';
      else if (f.beneficiaryServiceId === f.primaryServiceId) e.beneficiaryServiceId = 'النموذج المستفيد يجب أن يختلف عن النموذج الأساسي';
      const v = Number(f.validityDays);
      if (f.validityDays === null || f.validityDays === undefined || !Number.isInteger(v) || v <= 0 || v > 365) e.validityDays = 'عدد أيام صحيح بين 1 و365';
    } else if (!f.targetServiceId) {
      e.targetServiceId = 'اختر النموذج المستهدف';
    }
    if (!f.startAt) e.startAt = 'تاريخ البداية مطلوب';
    if (f.expiresAt) {
      if (f.startAt && f.expiresAt < f.startAt) e.expiresAt = 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية';
      else if (!this.editId() && f.expiresAt < todayInput()) e.expiresAt = 'تاريخ الانتهاء في الماضي';
    }
    if (!f.badgeText.trim()) e.badgeText = 'نص الشارة مطلوب';
    else if (f.badgeText.trim().length > 50) e.badgeText = '50 حرفاً كحد أقصى';
    if (f.customerMessage.length > 2000) e.customerMessage = '2000 حرف كحد أقصى';
    if (f.internalNote.length > 2000) e.internalNote = '2000 حرف كحد أقصى';
    return e;
  }

  private buildPayload(f: OfferForm = this.form()): CreateSpecialOfferPayload {
    const bundle = f.type === 'BUNDLE';
    return {
      type: f.type,
      name: f.name.trim(),
      discountValue: Number(f.discountValue),
      primaryServiceId: bundle ? f.primaryServiceId || null : null,
      beneficiaryServiceId: bundle ? f.beneficiaryServiceId || null : null,
      validityDays: bundle ? Number(f.validityDays) : null,
      targetServiceId: bundle ? null : f.targetServiceId || null,
      startAt: dateInputToIso(f.startAt) ?? undefined,
      expiresAt: dateInputToIso(f.expiresAt, true),
      badgeText: f.badgeText.trim(),
      customerMessage: f.customerMessage.trim() || null,
      internalNote: f.internalNote.trim() || null,
      assignedToTeamMemberId: this.isCompanyMode() ? f.assignedToTeamMemberId : null,
    };
  }

  /**
   * Edit: send only changed fields (the backend re-evaluates company approval
   * whenever discountValue is present). A type switch sends the full shape
   * so the other type's fields are explicitly cleared.
   */
  private diffForUpdate(payload: CreateSpecialOfferPayload): UpdateSpecialOfferPayload {
    const orig = this.original();
    if (!orig) return payload;
    const before = this.buildPayload(this.fromOffer(orig));
    const out: Record<string, unknown> = {};
    const typeChanged = payload.type !== before.type;
    for (const key of Object.keys(payload) as (keyof CreateSpecialOfferPayload)[]) {
      const changed = JSON.stringify(payload[key] ?? null) !== JSON.stringify(before[key] ?? null);
      if (changed || (typeChanged && SHAPE_KEYS.includes(key))) out[key] = payload[key];
    }
    return out as UpdateSpecialOfferPayload;
  }

  save(): void {
    this.submitted.set(true);
    const e = this.validate();
    this.errors.set(e);
    if (Object.keys(e).length) {
      this.flash.show('راجع الحقول المطلوبة', true);
      return;
    }
    const payload = this.buildPayload();
    const id = this.editId();
    this.saving.set(true);
    const req = id ? this.offerApi.update(id, this.diffForUpdate(payload)) : this.offerApi.create(payload);
    req.subscribe({
      next: res => {
        this.saving.set(false);
        if (this.isCompanyMode()) this.centerApi.refreshPendingCount();
        this.router.navigate(['/provider-overview/marketing/offers', res.data.id]);
      },
      error: err => {
        this.saving.set(false);
        this.flash.show(httpErrorMessage(err, 'تعذر حفظ العرض'), true);
      },
    });
  }
}
