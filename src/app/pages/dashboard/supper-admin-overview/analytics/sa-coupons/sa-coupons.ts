import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import {
  AdminCoupon, AdminCouponDetail, AdminCouponList, AdminCouponsService, AdminSpecialOffer, AdminPage
} from '../../../../../core/services/admin-coupons.service';

export const COUPON_STATUS_LABEL: Record<string, string> = { active: 'نشط', expired: 'منتهي الصلاحية', exhausted: 'استُنفد', inactive: 'موقوف' };
export const OFFER_TYPE_LABEL: Record<string, string> = { BUNDLE: 'عرض باقة', DIRECT_DISCOUNT: 'خصم مباشر' };

const errMsg = (e: any, fallback: string) => e?.error?.message || fallback;

@Component({
  selector: 'app-sa-coupons',
  standalone: true,
  imports: [CommonModule, FormsModule, WsSelectComponent],
  templateUrl: './sa-coupons.html',
  styleUrl: './sa-coupons.css',
})
export class SaCoupons {
  private api = inject(AdminCouponsService);
  private notify = inject(UiNotificationService);

  readonly statusLabel = COUPON_STATUS_LABEL;
  readonly offerTypeLabel = OFFER_TYPE_LABEL;
  readonly statusFilters = [
    { value: '', label: 'الكل' },
    { value: 'active', label: 'نشط' },
    { value: 'inactive', label: 'موقوف' },
    { value: 'expired', label: 'منتهي' },
    { value: 'exhausted', label: 'مستنفد' },
  ];

  tab = signal<'coupons' | 'offers'>('coupons');

  // ---- coupons list ----
  list = signal<AdminCouponList | null>(null);
  loading = signal(true);
  error = signal('');
  status = signal('');
  q = signal('');
  page = signal(1);

  // ---- detail drawer ----
  detail = signal<AdminCouponDetail | null>(null);
  detailLoading = signal(false);
  detailError = signal('');

  // ---- deactivate / reactivate confirmation ----
  confirmTarget = signal<AdminCoupon | null>(null);
  confirmReason = signal('');
  confirmBusy = signal(false);
  confirmError = signal('');

  // ---- special offers (read-only) ----
  offers = signal<AdminPage<AdminSpecialOffer> | null>(null);
  offersLoading = signal(false);
  offersError = signal('');
  offersLoaded = false;
  offerStatus = signal('');
  offerQ = signal('');
  offerPage = signal(1);

  readonly canConfirm = computed(() => {
    const t = this.confirmTarget();
    if (!t) return false;
    return t.active ? this.confirmReason().trim().length > 0 && !this.confirmBusy() : !this.confirmBusy();
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list({ status: this.status(), q: this.q(), page: this.page(), pageSize: 10 }).subscribe({
      next: (res) => { this.list.set(res.data); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e, 'تعذّر تحميل الكوبونات')); this.loading.set(false); },
    });
  }

  setStatus(v: string): void { this.status.set(v); this.page.set(1); this.load(); }
  search(): void { this.page.set(1); this.load(); }
  goPage(p: number): void { this.page.set(p); this.load(); }

  discountText(c: AdminCoupon): string {
    return c.discountType === 'percentage' ? `${c.discountValue}%` : `${c.discountValue} $`;
  }

  usageText(c: AdminCoupon): string {
    return c.maxUses === null ? `${c.usedCount} / بلا حد` : `${c.usedCount} / ${c.maxUses}`;
  }

  scopeText(c: AdminCoupon): string {
    return c.services.length ? c.services.map((s) => s.title || 'خدمة').join('، ') : 'كل خدمات المقدم';
  }

  // ---- detail ----
  openDetail(c: AdminCoupon): void {
    this.detail.set(null);
    this.detailError.set('');
    this.detailLoading.set(true);
    this.api.get(c.id).subscribe({
      next: (res) => { this.detail.set(res.data); this.detailLoading.set(false); },
      error: (e) => { this.detailError.set(errMsg(e, 'تعذّر تحميل تفاصيل الكوبون')); this.detailLoading.set(false); },
    });
  }
  closeDetail(): void { this.detail.set(null); this.detailError.set(''); this.detailLoading.set(false); }

  // Reactivation of an expired / exhausted coupon is refused by the server;
  // the button is disabled with the reason instead of failing silently.
  toggleBlockedReason(c: AdminCoupon): string {
    if (c.active) return '';
    if (c.status === 'expired') return 'كوبون منتهي الصلاحية — لا يمكن تفعيله';
    if (c.status === 'exhausted') return 'استُنفد عدد الاستخدامات — لا يمكن تفعيله';
    if (c.approvalStatus === 'PENDING' || c.approvalStatus === 'REJECTED') return 'بانتظار موافقة الشركة أو مرفوض — لا يمكن تفعيله';
    return '';
  }

  askToggle(c: AdminCoupon): void {
    if (this.toggleBlockedReason(c)) return;
    this.confirmTarget.set(c);
    this.confirmReason.set('');
    this.confirmError.set('');
  }
  cancelConfirm(): void { if (!this.confirmBusy()) this.confirmTarget.set(null); }

  confirmToggle(): void {
    const t = this.confirmTarget();
    if (!t || !this.canConfirm()) return;
    this.confirmBusy.set(true);
    this.confirmError.set('');
    const next = !t.active;
    this.api.setActive(t.id, next, next ? undefined : this.confirmReason().trim()).subscribe({
      next: () => {
        this.confirmBusy.set(false);
        this.confirmTarget.set(null);
        this.notify.success(next ? `تمت إعادة تفعيل الكوبون ${t.code}` : `تم إيقاف الكوبون ${t.code}`);
        this.load();
        if (this.detail()?.id === t.id) this.openDetail(t);
      },
      error: (e) => { this.confirmBusy.set(false); this.confirmError.set(errMsg(e, 'تعذّر تنفيذ العملية')); },
    });
  }

  // ---- special offers ----
  showTab(t: 'coupons' | 'offers'): void {
    this.tab.set(t);
    if (t === 'offers' && !this.offersLoaded) this.loadOffers();
  }

  loadOffers(): void {
    this.offersLoaded = true;
    this.offersLoading.set(true);
    this.offersError.set('');
    this.api.listSpecialOffers({ status: this.offerStatus(), q: this.offerQ(), page: this.offerPage(), pageSize: 10 }).subscribe({
      next: (res) => { this.offers.set(res.data); this.offersLoading.set(false); },
      error: (e) => { this.offersError.set(errMsg(e, 'تعذّر تحميل العروض الخاصة')); this.offersLoading.set(false); },
    });
  }
  setOfferStatus(v: string): void { this.offerStatus.set(v); this.offerPage.set(1); this.loadOffers(); }
  searchOffers(): void { this.offerPage.set(1); this.loadOffers(); }
  goOfferPage(p: number): void { this.offerPage.set(p); this.loadOffers(); }

  offerScope(o: AdminSpecialOffer): string {
    if (o.type === 'BUNDLE') return `${o.primaryService?.title ?? 'خدمة'} ← ${o.beneficiaryService?.title ?? 'خدمة'}${o.validityDays ? ` خلال ${o.validityDays} يوم` : ''}`;
    return o.targetService?.title ?? 'خدمة';
  }
}
