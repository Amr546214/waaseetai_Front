import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { ProviderCouponService } from '../../../../../core/services/provider-coupon.service';
import { CompanyTeamService } from '../../../../../core/services/company-team.service';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { ProviderCoupon } from '../../../../../core/models/marketing.model';
import { CompanyTeamMember } from '../../../../../core/models/company-team.model';
import {
  Flash, ProviderModelOption, STATUS_LABELS, STATUS_PILL, ToolDisplayStatus, avatarGradient, couponStatus, formatNumber,
  httpErrorMessage, initials, isToggleable, mapProviderModels, validityLabel,
} from '../marketing-utils';

type StatusFilter = 'all' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'PENDING' | 'REJECTED';

interface CouponRow {
  coupon: ProviderCoupon;
  status: ToolDisplayStatus;
  scope: string;
  assignee: CompanyTeamMember | null;
}

/** P-PR-040 (individual) / P-CO-MK-006 (company) — كوبونات الخصم. */
@Component({
  selector: 'app-marketing-coupons',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './coupons.html',
  styleUrls: ['../marketing-shared.css'],
})
export class MarketingCoupons implements OnInit {
  private authStore = inject(AuthStore);
  private couponApi = inject(ProviderCouponService);
  private teamApi = inject(CompanyTeamService);
  private modelsApi = inject(NewProjectService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  isCompanyMode = computed<boolean>(() => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY);

  readonly statusLabels = STATUS_LABELS;
  readonly statusPill = STATUS_PILL;
  readonly fmt = formatNumber;
  readonly initials = initials;
  readonly avatarBg = avatarGradient;
  readonly validity = validityLabel;
  readonly toggleable = isToggleable;
  readonly flash = new Flash();

  coupons = signal<ProviderCoupon[]>([]);
  models = signal<ProviderModelOption[]>([]);
  team = signal<CompanyTeamMember[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  search = signal('');
  statusFilter = signal<StatusFilter>('all');
  memberFilter = signal<string>('all');
  selected = signal<Set<string>>(new Set());
  busy = signal<Set<string>>(new Set());

  statusChips = computed<{ id: StatusFilter; label: string }[]>(() => {
    const base: { id: StatusFilter; label: string }[] = [
      { id: 'all', label: 'الكل' },
      { id: 'ACTIVE', label: 'نشط' },
      { id: 'PAUSED', label: 'متوقف' },
      { id: 'ENDED', label: 'منتهي/مستهلك' },
    ];
    if (this.isCompanyMode()) base.push({ id: 'PENDING', label: 'بانتظار الموافقة' }, { id: 'REJECTED', label: 'مرفوض' });
    return base;
  });

  rows = computed<CouponRow[]>(() => {
    const models = this.models();
    const allIds = new Set(models.map(m => m.id));
    const names = new Map(models.map(m => [m.id, m.title]));
    const team = new Map(this.team().map(m => [m.id, m]));
    const allLabel = this.isCompanyMode() ? 'كل نماذج الشركة' : 'كل نماذجي';
    return this.coupons().map(c => {
      const covered = c.serviceIds.filter(id => !c.excludedServiceIds.includes(id));
      let scope: string;
      if (allIds.size > 0 && c.serviceIds.length >= allIds.size && [...allIds].every(id => c.serviceIds.includes(id))) {
        scope = allLabel + (c.excludedServiceIds.length ? ` (عدا ${c.excludedServiceIds.length})` : '');
      } else if (covered.length === 1) {
        scope = names.get(covered[0]) ?? 'نموذج واحد';
      } else {
        const first = names.get(covered[0]);
        scope = first ? `${first} +${covered.length - 1}` : `${covered.length} نماذج`;
      }
      return { coupon: c, status: couponStatus(c), scope, assignee: c.assignedToTeamMemberId ? team.get(c.assignedToTeamMemberId) ?? null : null };
    });
  });

  filteredRows = computed(() => {
    const q = this.search().trim().toUpperCase();
    const sf = this.statusFilter();
    const mf = this.memberFilter();
    return this.rows().filter(r => {
      if (q && !r.coupon.code.includes(q)) return false;
      if (sf === 'ENDED' && r.status !== 'EXPIRED' && r.status !== 'CONSUMED') return false;
      if (sf !== 'all' && sf !== 'ENDED' && r.status !== sf) return false;
      if (mf === 'none' && r.coupon.assignedToTeamMemberId) return false;
      if (mf !== 'all' && mf !== 'none' && r.coupon.assignedToTeamMemberId !== mf) return false;
      return true;
    });
  });

  kpis = computed(() => {
    const rows = this.rows();
    return {
      active: rows.filter(r => r.status === 'ACTIVE').length,
      paused: rows.filter(r => r.status === 'PAUSED').length,
      ended: rows.filter(r => r.status === 'EXPIRED' || r.status === 'CONSUMED').length,
      pending: rows.filter(r => r.status === 'PENDING').length,
      totalUses: rows.reduce((a, r) => a + (r.coupon.usedCount || 0), 0),
    };
  });

  selectableVisible = computed(() => this.filteredRows().filter(r => isToggleable(r.status)).map(r => r.coupon.id));
  allVisibleSelected = computed(() => {
    const ids = this.selectableVisible();
    return ids.length > 0 && ids.every(id => this.selected().has(id));
  });

  ngOnInit(): void {
    this.load();
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
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.couponApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.coupons.set(res.data ?? []);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(httpErrorMessage(err, 'تعذر تحميل الكوبونات'));
        this.loading.set(false);
      },
    });
  }

  openDetails(c: ProviderCoupon): void {
    this.router.navigate(['/provider-overview/marketing/coupons', c.id]);
  }

  copyCode(code: string, ev: Event): void {
    ev.stopPropagation();
    navigator.clipboard?.writeText(code).then(() => this.flash.show(`تم نسخ الكود ${code}`), () => undefined);
  }

  // --- selection / bulk (individual design) -----------------------------
  toggleSelect(id: string, ev: Event): void {
    ev.stopPropagation();
    const next = new Set(this.selected());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selected.set(next);
  }

  toggleSelectAll(): void {
    const ids = this.selectableVisible();
    this.selected.set(this.allVisibleSelected() ? new Set() : new Set(ids));
  }

  bulkSetActive(active: boolean): void {
    const ids = [...this.selected()].filter(id => {
      const r = this.rows().find(x => x.coupon.id === id);
      return r && isToggleable(r.status) && r.coupon.active !== active;
    });
    if (!ids.length) {
      this.selected.set(new Set());
      return;
    }
    forkJoin(ids.map(id => this.couponApi.setActive(id, active))).subscribe({
      next: results => {
        this.mergeUpdated(results.map(r => r.data));
        this.selected.set(new Set());
        this.flash.show(active ? `تم تفعيل ${ids.length} كوبون` : `تم إيقاف ${ids.length} كوبون`);
      },
      error: err => {
        this.flash.show(httpErrorMessage(err, 'تعذر تحديث بعض الكوبونات'), true);
        this.load();
      },
    });
  }

  // --- single toggle ----------------------------------------------------
  toggleActive(c: ProviderCoupon, ev: Event): void {
    ev.stopPropagation();
    const input = ev.target as HTMLInputElement;
    const next = input.checked;
    this.setBusy(c.id, true);
    this.couponApi.setActive(c.id, next).subscribe({
      next: res => {
        this.mergeUpdated([res.data]);
        this.setBusy(c.id, false);
        this.flash.show(res.data.active ? `تم تفعيل ${c.code}` : `تم إيقاف ${c.code}`);
      },
      error: err => {
        input.checked = !next;
        this.setBusy(c.id, false);
        this.flash.show(httpErrorMessage(err, 'تعذر تحديث حالة الكوبون'), true);
      },
    });
  }

  private mergeUpdated(updated: ProviderCoupon[]): void {
    const map = new Map(updated.map(u => [u.id, u]));
    this.coupons.update(list => list.map(c => map.get(c.id) ?? c));
  }

  private setBusy(id: string, on: boolean): void {
    const next = new Set(this.busy());
    on ? next.add(id) : next.delete(id);
    this.busy.set(next);
  }

  discountLabel(c: ProviderCoupon): string {
    return c.discountType === 'percentage' ? `${c.discountValue}%` : `${formatNumber(c.discountValue)} دولار`;
  }

  usageLabel(c: ProviderCoupon): string {
    return c.maxUses ? `${c.usedCount} / ${c.maxUses}` : `${c.usedCount} / ∞`;
  }
}
