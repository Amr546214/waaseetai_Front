import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { ProviderCouponService } from '../../../../../core/services/provider-coupon.service';
import { MarketingCenterService } from '../../../../../core/services/marketing-center.service';
import { CompanyTeamService } from '../../../../../core/services/company-team.service';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { CouponStats, ProviderCoupon } from '../../../../../core/models/marketing.model';
import { CompanyTeamMember } from '../../../../../core/models/company-team.model';
import {
  Flash, ProviderModelOption, STATUS_LABELS, STATUS_PILL, avatarGradient, couponStatus, formatDay, formatMoney, formatNumber,
  httpErrorMessage, initials, isToggleable, mapProviderModels, relativeTime, validityLabel,
} from '../marketing-utils';

/** P-PR-040-تفاصيل / P-CO-MK-006-تفاصيل — coupon stats & details. */
@Component({
  selector: 'app-marketing-coupon-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './coupon-details.html',
  styleUrls: ['../marketing-shared.css'],
})
export class MarketingCouponDetails implements OnInit {
  private authStore = inject(AuthStore);
  private couponApi = inject(ProviderCouponService);
  private centerApi = inject(MarketingCenterService);
  private teamApi = inject(CompanyTeamService);
  private modelsApi = inject(NewProjectService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  isCompanyMode = computed<boolean>(() => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY);

  readonly statusLabels = STATUS_LABELS;
  readonly statusPill = STATUS_PILL;
  readonly fmt = formatNumber;
  readonly money = formatMoney;
  readonly day = formatDay;
  readonly rel = relativeTime;
  readonly initials = initials;
  readonly avatarBg = avatarGradient;
  readonly flash = new Flash();

  coupon = signal<ProviderCoupon | null>(null);
  stats = signal<CouponStats | null>(null);
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

  status = computed(() => (this.coupon() ? couponStatus(this.coupon()!) : null));
  canToggle = computed(() => (this.status() ? isToggleable(this.status()!) : false));

  consumption = computed(() => {
    const c = this.coupon();
    if (!c || !c.maxUses) return null;
    const pct = Math.min(100, Math.round((c.usedCount / c.maxUses) * 100));
    return { pct, remaining: Math.max(0, c.maxUses - c.usedCount) };
  });

  scopeNames = computed(() => {
    const c = this.coupon();
    if (!c) return { included: [] as string[], excluded: [] as string[] };
    const names = new Map(this.models().map(m => [m.id, m.title]));
    return {
      included: c.serviceIds.map(id => names.get(id) ?? 'نموذج غير منشور حالياً'),
      excluded: c.excludedServiceIds.map(id => names.get(id) ?? 'نموذج غير منشور حالياً'),
    };
  });

  assignee = computed(() => {
    const id = this.coupon()?.assignedToTeamMemberId;
    return id ? this.team().find(m => m.id === id) ?? null : null;
  });

  subtitle = computed(() => {
    const c = this.coupon();
    if (!c) return '';
    const disc = c.discountType === 'percentage' ? `خصم ${c.discountValue}%` : `خصم ${formatNumber(c.discountValue)} دولار`;
    const inc = this.scopeNames().included;
    const scope = inc.length === 1 ? `على ${inc[0]}` : `على ${inc.length} نماذج`;
    return `${disc} ${scope} · ${validityLabel(c.startAt, c.expiresAt)}`;
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

  /** GET /provider/coupons/:id/stats — works for every coupon, not only top performers. */
  loadStats(id: string, page: number): void {
    this.statsLoading.set(true);
    this.statsError.set(null);
    this.couponApi.getStats(id, page, this.pageSize).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.stats.set(res.data);
        this.statsLoading.set(false);
      },
      error: err => {
        this.statsError.set(httpErrorMessage(err, 'تعذر تحميل إحصائيات الكوبون'));
        this.statsLoading.set(false);
      },
    });
  }

  goToPage(page: number): void {
    const c = this.coupon();
    const s = this.stats();
    if (!c || !s || page < 1 || page > s.redemptions.totalPages) return;
    this.loadStats(c.id, page);
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

  load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.couponApi.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.coupon.set(res.data);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(httpErrorMessage(err, 'تعذر تحميل الكوبون'));
        this.loading.set(false);
      },
    });
  }

  /** Formatted stats figures, '—' while stats are unavailable. */
  statText = computed(() => {
    const t = this.stats()?.totals;
    return {
      discountedValue: t ? formatNumber(t.discountedValue) : '—',
      revenue: t ? formatNumber(t.revenue) : '—',
      uniqueCustomers: t ? formatNumber(t.uniqueCustomers) : '—',
      averageOrderValue: t?.averageOrderValue != null ? formatMoney(t.averageOrderValue) : '—',
      repeatNote: !t ? '—' : t.repeatCustomers ? `${t.repeatCustomers} عميل استخدمه أكثر من مرة` : 'لا يوجد عميل استخدمه مرتين',
    };
  });

  copyCode(): void {
    const code = this.coupon()?.code;
    if (code) navigator.clipboard?.writeText(code).then(() => this.flash.show(`تم نسخ الكود ${code}`), () => undefined);
  }

  toggleActive(ev: Event): void {
    const c = this.coupon();
    if (!c) return;
    const input = ev.target as HTMLInputElement;
    const next = input.checked;
    this.busy.set(true);
    this.couponApi.setActive(c.id, next).subscribe({
      next: res => {
        this.coupon.set(res.data);
        this.busy.set(false);
        this.flash.show(res.data.active ? 'تم تفعيل الكوبون' : 'تم إيقاف الكوبون');
      },
      error: err => {
        input.checked = !next;
        this.busy.set(false);
        this.flash.show(httpErrorMessage(err, 'تعذر تحديث حالة الكوبون'), true);
      },
    });
  }

  decide(decision: 'APPROVED' | 'REJECTED'): void {
    const c = this.coupon();
    if (!c) return;
    if (decision === 'REJECTED' && !this.rejectReason.trim()) {
      this.flash.show('يجب توضيح سبب الرفض', true);
      return;
    }
    this.busy.set(true);
    this.couponApi.decideApproval(c.id, { decision, rejectionReason: decision === 'REJECTED' ? this.rejectReason.trim() : null }).subscribe({
      next: res => {
        this.coupon.set(res.data);
        this.busy.set(false);
        this.rejecting.set(false);
        this.centerApi.refreshPendingCount();
        this.flash.show(decision === 'APPROVED' ? 'تم اعتماد الكوبون' : 'تم رفض الكوبون');
      },
      error: err => {
        this.busy.set(false);
        this.flash.show(httpErrorMessage(err, 'تعذر تسجيل القرار'), true);
      },
    });
  }
}
