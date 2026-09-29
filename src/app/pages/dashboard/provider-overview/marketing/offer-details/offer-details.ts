import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { ProviderSpecialOfferService } from '../../../../../core/services/provider-special-offer.service';
import { MarketingCenterService } from '../../../../../core/services/marketing-center.service';
import { CompanyTeamService } from '../../../../../core/services/company-team.service';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { ProviderSpecialOffer, SpecialOfferStats } from '../../../../../core/models/marketing.model';
import { CompanyTeamMember } from '../../../../../core/models/company-team.model';
import {
  Flash, ProviderModelOption, STATUS_LABELS, STATUS_PILL, avatarGradient, describeOffer, formatDay, formatMoney, formatNumber, httpErrorMessage,
  initials, isToggleable, mapProviderModels, offerStatus, relativeTime, validityLabel,
} from '../marketing-utils';

/** P-PR-041-تفاصيل / P-CO-MK-007-تفاصيل — special offer stats & details. */
@Component({
  selector: 'app-marketing-offer-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './offer-details.html',
  styleUrls: ['../marketing-shared.css'],
})
export class MarketingOfferDetails implements OnInit {
  private authStore = inject(AuthStore);
  private offerApi = inject(ProviderSpecialOfferService);
  private centerApi = inject(MarketingCenterService);
  private teamApi = inject(CompanyTeamService);
  private modelsApi = inject(NewProjectService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  isCompanyMode = computed<boolean>(() => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY);

  readonly statusLabels = STATUS_LABELS;
  readonly statusPill = STATUS_PILL;
  readonly fmt = formatNumber;
  readonly day = formatDay;
  readonly money = formatMoney;
  readonly rel = relativeTime;
  readonly initials = initials;
  readonly avatarBg = avatarGradient;
  readonly flash = new Flash();

  offer = signal<ProviderSpecialOffer | null>(null);
  stats = signal<SpecialOfferStats | null>(null);
  statsLoading = signal(true);
  statsError = signal<string | null>(null);
  readonly pageSize = 10;
  models = signal<ProviderModelOption[]>([]);
  team = signal<CompanyTeamMember[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  busy = signal(false);

  rejecting = signal(false);
  rejectReason = '';

  status = computed(() => (this.offer() ? offerStatus(this.offer()!) : null));
  canToggle = computed(() => (this.status() ? isToggleable(this.status()!) : false));
  names = computed(() => new Map(this.models().map(m => [m.id, m.title])));
  described = computed(() => (this.offer() ? describeOffer(this.offer()!, this.names()) : { meta: '', description: '' }));
  modelName = (id: string | null) => (id ? this.names().get(id) ?? 'نموذج غير منشور حالياً' : '—');

  assignee = computed(() => {
    const id = this.offer()?.assignedToTeamMemberId;
    return id ? this.team().find(m => m.id === id) ?? null : null;
  });

  subtitle = computed(() => {
    const o = this.offer();
    if (!o) return '';
    return `${this.described().meta} (خصم ${o.discountValue}%) · ${validityLabel(o.startAt, o.expiresAt)}`;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.load(id);
    this.modelsApi.getMyMarketModels().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => this.models.set(mapProviderModels(res)),
      error: () => this.models.set([]),
    });
    if (this.isCompanyMode()) {
      this.teamApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res => this.team.set(res.data ?? []),
        error: () => this.team.set([]),
      });
    }
    this.loadStats(id, 1);
  }

  /** GET /provider/special-offers/:id/stats — works for every offer, not only top performers. */
  loadStats(id: string, page: number): void {
    this.statsLoading.set(true);
    this.statsError.set(null);
    this.offerApi.getStats(id, page, this.pageSize).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.stats.set(res.data);
        this.statsLoading.set(false);
      },
      error: err => {
        this.statsError.set(httpErrorMessage(err, 'تعذر تحميل إحصائيات العرض'));
        this.statsLoading.set(false);
      },
    });
  }

  goToPage(page: number): void {
    const o = this.offer();
    const s = this.stats();
    if (!o || !s || page < 1 || page > s.redemptions.totalPages) return;
    this.loadStats(o.id, page);
  }

  /** Weekly usage bars ("آخر 6 أسابيع"), same CSS bar chart as the marketing center. */
  weekBars = computed(() => {
    const trend = this.stats()?.weeklyTrend ?? [];
    const max = Math.max(1, ...trend.map(w => w.usageCount));
    return trend.map((w, i) => ({
      key: w.weekEnd,
      label: formatDay(w.weekEnd),
      value: w.usageCount,
      height: Math.round((w.usageCount / max) * 100),
      current: i === trend.length - 1,
    }));
  });

  /** Formatted stats figures, '—' while stats are unavailable. */
  statText = computed(() => {
    const s = this.stats();
    const t = s?.totals;
    const conv = s?.bundle?.conversionRate;
    return {
      discountedValue: t ? formatNumber(t.discountedValue) : '—',
      discountedServiceRevenue: t ? formatNumber(t.discountedServiceRevenue) : '—',
      conversion: conv != null ? `${conv}%` : '—',
      primaryCustomers: s?.bundle ? formatNumber(s.bundle.primaryCustomers) : '—',
      convertedCustomers: s?.bundle ? formatNumber(s.bundle.convertedCustomers) : '—',
    };
  });

  load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.offerApi.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.offer.set(res.data);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(httpErrorMessage(err, 'تعذر تحميل العرض'));
        this.loading.set(false);
      },
    });
  }


  toggleActive(ev: Event): void {
    const o = this.offer();
    if (!o) return;
    const input = ev.target as HTMLInputElement;
    const next = input.checked;
    this.busy.set(true);
    this.offerApi.setActive(o.id, next).subscribe({
      next: res => {
        this.offer.set(res.data);
        this.busy.set(false);
        this.flash.show(res.data.active ? 'تم تفعيل العرض' : 'تم إيقاف العرض');
      },
      error: err => {
        input.checked = !next;
        this.busy.set(false);
        this.flash.show(httpErrorMessage(err, 'تعذر تحديث حالة العرض'), true);
      },
    });
  }

  decide(decision: 'APPROVED' | 'REJECTED'): void {
    const o = this.offer();
    if (!o) return;
    if (decision === 'REJECTED' && !this.rejectReason.trim()) {
      this.flash.show('يجب توضيح سبب الرفض', true);
      return;
    }
    this.busy.set(true);
    this.offerApi.decideApproval(o.id, { decision, rejectionReason: decision === 'REJECTED' ? this.rejectReason.trim() : null }).subscribe({
      next: res => {
        this.offer.set(res.data);
        this.busy.set(false);
        this.rejecting.set(false);
        this.centerApi.refreshPendingCount();
        this.flash.show(decision === 'APPROVED' ? 'تم اعتماد العرض' : 'تم رفض العرض');
      },
      error: err => {
        this.busy.set(false);
        this.flash.show(httpErrorMessage(err, 'تعذر تسجيل القرار'), true);
      },
    });
  }
}
