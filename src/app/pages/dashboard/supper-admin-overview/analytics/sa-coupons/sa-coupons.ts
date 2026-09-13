import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Coupon {
  code: string;
  name: string;
  meta: string;
  discountLabel: string;
  discountUnit: string;
  discountColor: string;
  active: boolean;
  expired?: boolean;
}

@Component({
  selector: 'app-sa-coupons',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-coupons.html',
  styleUrl: './sa-coupons.css',
})
export class SaCoupons {
  readonly kpis = [
    { value: '326', label: 'استخدام هذا الشهر', color: '#2BD4C7' },
    { value: '12,840 ر.س', label: 'قيمة الخصومات', color: '#FF8C69' },
    { value: '68%', label: 'معدل التحويل', color: '#0FA99A' },
    { value: '2', label: 'كوبونات نشطة', color: '#FFB400' },
  ];

  readonly usage = [
    { day: 'الأحد', value: 38 },
    { day: 'الاثنين', value: 52 },
    { day: 'الثلاثاء', value: 44 },
    { day: 'الأربعاء', value: 61 },
    { day: 'الخميس', value: 48 },
    { day: 'الجمعة', value: 72 },
    { day: 'السبت', value: 55 },
  ];
  readonly maxUsage = Math.max(...this.usage.map((u) => u.value));

  coupons = signal<Coupon[]>([
    { code: 'WASEET20', name: 'خصم 20% على أول مشروع', meta: 'استُخدم 284 مرة · صالح حتى 28 فبراير · نشط', discountLabel: '20%', discountUnit: 'خصم', discountColor: '#0FA99A', active: true },
    { code: 'KHALEEJ50', name: '50 ر.س على الباقة الأولى — لشركات', meta: 'استُخدم 42 مرة · صالح حتى 15 مارس · نشط', discountLabel: '50 ر.س', discountUnit: 'ثابت', discountColor: '#5DA0FF', active: true },
    { code: 'RAMADAN24', name: 'خصم رمضان 15%', meta: 'استُخدم 1,284 مرة · منتهي الصلاحية', discountLabel: '15%', discountUnit: '', discountColor: '#6B7699', active: false, expired: true },
  ]);

  newCode = signal('');
  discountType = signal('نسبة مئوية %');
  readonly discountTypes = ['نسبة مئوية %', 'مبلغ ثابت (ر.س)', 'شحن مجاني'];
  discountValue = signal<number | null>(null);
  audience = signal('كل المستخدمين');
  readonly audiences = ['كل المستخدمين', 'طالبو الخدمة فقط', 'مقدمو الخدمة فقط', 'المستخدمون الجدد'];
  expiryDate = signal('');
  maxUsageCount = signal<number | null>(null);
  createdMsg = signal('');

  toggleCoupon(coupon: Coupon): void {
    coupon.active = !coupon.active;
  }

  createCoupon(): void {
    if (!this.newCode().trim()) return;
    this.coupons.update((list) => [
      {
        code: this.newCode().trim().toUpperCase(),
        name: `خصم ${this.discountValue() ?? 0}${this.discountType() === 'نسبة مئوية %' ? '%' : ' ر.س'}`,
        meta: `استُخدم 0 مرة · صالح حتى ${this.expiryDate() || '—'} · نشط`,
        discountLabel: this.discountType() === 'نسبة مئوية %' ? `${this.discountValue() ?? 0}%` : `${this.discountValue() ?? 0} ر.س`,
        discountUnit: this.discountType() === 'نسبة مئوية %' ? 'خصم' : 'ثابت',
        discountColor: '#0FA99A',
        active: true,
      },
      ...list,
    ]);
    this.createdMsg.set('تم إنشاء الكوبون بنجاح');
    this.newCode.set('');
    this.discountValue.set(null);
    this.expiryDate.set('');
    this.maxUsageCount.set(null);
    setTimeout(() => this.createdMsg.set(''), 2500);
  }
}
