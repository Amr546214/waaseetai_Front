import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { ProviderCouponService } from '../../../../../core/services/provider-coupon.service';
import { ProviderSpecialOfferService } from '../../../../../core/services/provider-special-offer.service';
import { MarketingCenterService } from '../../../../../core/services/marketing-center.service';
import { CompanyTeamService } from '../../../../../core/services/company-team.service';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { ProviderCoupon, ProviderSpecialOffer } from '../../../../../core/models/marketing.model';
import { CompanyTeamMember } from '../../../../../core/models/company-team.model';
import {
  COMPANY_APPROVAL_THRESHOLD, Flash, ProviderModelOption, couponNeedsApproval, describeOffer, formatNumber, httpErrorMessage,
  mapProviderModels, offerNeedsApproval, relativeTime,
} from '../marketing-utils';

type ApprovalTab = 'pending' | 'approved' | 'rejected';

interface ApprovalItem {
  kind: 'COUPON' | 'OFFER';
  id: string;
  title: string;
  tag: string;
  meta: string;
  memberId: string | null;
  memberVerb: string;
  body: string;
  rejectionReason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  link: string[];
}

/**
 * P-CO-MK-008 — طلبات الموافقة (company only). There is no combined backend
 * endpoint: coupons and special offers are fetched separately and merged.
 * "معتمَدة" lists APPROVED tools that meet the approval threshold (i.e. ones
 * that could only have gone live through an explicit approval), not every
 * auto-approved tool.
 */
@Component({
  selector: 'app-marketing-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './approvals.html',
  styleUrls: ['../marketing-shared.css'],
})
export class MarketingApprovals implements OnInit {
  private authStore = inject(AuthStore);
  private couponApi = inject(ProviderCouponService);
  private offerApi = inject(ProviderSpecialOfferService);
  private centerApi = inject(MarketingCenterService);
  private teamApi = inject(CompanyTeamService);
  private modelsApi = inject(NewProjectService);
  private destroyRef = inject(DestroyRef);

  isCompanyMode = computed<boolean>(() => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY);
  readonly threshold = COMPANY_APPROVAL_THRESHOLD;
  readonly rel = relativeTime;
  readonly flash = new Flash();

  coupons = signal<ProviderCoupon[]>([]);
  offers = signal<ProviderSpecialOffer[]>([]);
  models = signal<ProviderModelOption[]>([]);
  team = signal<CompanyTeamMember[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  tab = signal<ApprovalTab>('pending');
  busyKey = signal<string | null>(null);
  rejectingKey = signal<string | null>(null);
  rejectReason = '';

  private teamMap = computed(() => new Map(this.team().map(m => [m.id, m])));

  items = computed<ApprovalItem[]>(() => {
    const names = new Map(this.models().map(m => [m.id, m.title]));
    const allModels = this.models();
    const out: ApprovalItem[] = [];

    for (const c of this.coupons()) {
      if (c.approvalStatus === 'NONE') continue;
      if (c.approvalStatus === 'APPROVED' && !couponNeedsApproval(c)) continue;
      const high = c.discountType === 'percentage' && c.discountValue > COMPANY_APPROVAL_THRESHOLD;
      const uncapped = c.maxUses === null;
      const disc = c.discountType === 'percentage' ? `${c.discountValue}%` : `${formatNumber(c.discountValue)} ريال`;
      const covered = c.serviceIds.filter(id => !c.excludedServiceIds.includes(id));
      const scope = allModels.length && allModels.every(m => c.serviceIds.includes(m.id))
        ? 'كل نماذج الشركة'
        : covered.map(id => names.get(id) ?? '—').slice(0, 3).join('، ') + (covered.length > 3 ? ` +${covered.length - 3}` : '');
      const reasons: string[] = [];
      if (high) reasons.push(`تجاوز الكوبون حد الخصم المسموح تلقائياً (${COMPANY_APPROVAL_THRESHOLD}%)`);
      if (uncapped) reasons.push('ليس له حد أقصى لمرات الاستخدام وقد يستهلك السقف الشهري بسرعة');
      const limits = `${c.maxUses ? `الحد الأقصى للاستخدام: ${c.maxUses} مرة` : 'بلا حد أقصى للاستخدام'}، ${c.minimumAmount ? `حد أدنى للطلب ${formatNumber(c.minimumAmount)} ريال` : 'بدون حد أدنى لقيمة الطلب'}.`;
      out.push({
        kind: 'COUPON', id: c.id, title: `كوبون ${c.code}`,
        tag: high ? `خصم ${disc}` : uncapped ? 'بلا حد استخدام' : `خصم ${disc}`,
        meta: `يشمل: ${scope || '—'}`,
        memberId: c.createdByTeamMemberId ?? c.assignedToTeamMemberId,
        memberVerb: c.createdByTeamMemberId ? 'أنشأه' : 'مُسنَد لـ',
        body: `${reasons.join('، و')} — يحتاج اعتمادك قبل ظهوره في السوق. خصم ${disc}؛ ${limits}`,
        rejectionReason: c.rejectionReason, status: c.approvalStatus, createdAt: c.createdAt, updatedAt: c.updatedAt,
        link: ['/provider-overview/marketing/coupons', c.id],
      });
    }

    for (const o of this.offers()) {
      if (o.approvalStatus === 'NONE') continue;
      if (o.approvalStatus === 'APPROVED' && !offerNeedsApproval(o)) continue;
      const d = describeOffer(o, names);
      out.push({
        kind: 'OFFER', id: o.id, title: `عرض «${o.name}»`,
        tag: o.type === 'BUNDLE' ? 'باقة مرتبطة' : 'خصم مباشر',
        meta: d.meta.split(' · ').slice(1).join(' · '),
        memberId: o.createdByTeamMemberId ?? o.assignedToTeamMemberId,
        memberVerb: o.createdByTeamMemberId ? 'أنشأه' : 'مُسنَد لـ',
        body: `خصم ${o.discountValue}% — يتجاوز الحد المسموح تلقائياً (${COMPANY_APPROVAL_THRESHOLD}%). ${d.description}`,
        rejectionReason: o.rejectionReason, status: o.approvalStatus, createdAt: o.createdAt, updatedAt: o.updatedAt,
        link: ['/provider-overview/marketing/offers', o.id],
      });
    }
    return out;
  });

  byTab = computed(() => {
    const status = this.tab() === 'pending' ? 'PENDING' : this.tab() === 'approved' ? 'APPROVED' : 'REJECTED';
    const key = this.tab() === 'pending' ? 'createdAt' : 'updatedAt';
    return this.items().filter(i => i.status === status).sort((a, b) => b[key].localeCompare(a[key]));
  });

  kpis = computed(() => {
    const now = new Date();
    const thisMonth = (iso: string) => {
      const d = new Date(iso);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    const items = this.items();
    return {
      pending: items.filter(i => i.status === 'PENDING').length,
      approvedMonth: items.filter(i => i.status === 'APPROVED' && thisMonth(i.updatedAt)).length,
      rejectedMonth: items.filter(i => i.status === 'REJECTED' && thisMonth(i.updatedAt)).length,
    };
  });

  memberName(id: string | null): string | null {
    return id ? this.teamMap().get(id)?.name ?? null : null;
  }

  ngOnInit(): void {
    if (!this.isCompanyMode()) {
      this.loading.set(false);
      return;
    }
    this.load();
    this.modelsApi.getMyMarketModels().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => this.models.set(mapProviderModels(res)),
      error: () => this.models.set([]),
    });
    this.teamApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => this.team.set(res.data ?? []),
      error: () => this.team.set([]),
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ coupons: this.couponApi.list(), offers: this.offerApi.list() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ coupons, offers }) => {
        this.coupons.set(coupons.data ?? []);
        this.offers.set(offers.data ?? []);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(httpErrorMessage(err, 'تعذر تحميل طلبات الموافقة'));
        this.loading.set(false);
      },
    });
  }

  key(i: ApprovalItem): string {
    return `${i.kind}:${i.id}`;
  }

  startReject(i: ApprovalItem): void {
    this.rejectReason = '';
    this.rejectingKey.set(this.key(i));
  }

  decide(i: ApprovalItem, decision: 'APPROVED' | 'REJECTED'): void {
    if (decision === 'REJECTED' && !this.rejectReason.trim()) {
      this.flash.show('يجب توضيح سبب الرفض', true);
      return;
    }
    const payload = { decision, rejectionReason: decision === 'REJECTED' ? this.rejectReason.trim() : null };
    this.busyKey.set(this.key(i));
    const onError = (err: unknown) => {
      this.busyKey.set(null);
      this.flash.show(httpErrorMessage(err, 'تعذر تسجيل القرار'), true);
    };
    const done = () => {
      this.busyKey.set(null);
      this.rejectingKey.set(null);
      this.centerApi.refreshPendingCount();
      this.flash.show(decision === 'APPROVED' ? `تم اعتماد ${i.title}` : `تم رفض ${i.title}`);
    };
    if (i.kind === 'COUPON') {
      this.couponApi.decideApproval(i.id, payload).subscribe({
        next: res => {
          this.coupons.update(list => list.map(c => (c.id === i.id ? res.data : c)));
          done();
        },
        error: onError,
      });
    } else {
      this.offerApi.decideApproval(i.id, payload).subscribe({
        next: res => {
          this.offers.update(list => list.map(o => (o.id === i.id ? res.data : o)));
          done();
        },
        error: onError,
      });
    }
  }
}
