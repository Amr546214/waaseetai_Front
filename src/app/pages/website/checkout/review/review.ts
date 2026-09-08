import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CheckoutStepper } from '../components/checkout-stepper/checkout-stepper';
import { CartService } from '../../../../core/services/cart.service';
import { CheckoutService } from '../../../../core/services/checkout.service';
import { AuthStore } from '../../../../core/store/auth.store';

@Component({
  selector: 'app-checkout-review',
  standalone: true,
  imports: [CommonModule, CheckoutStepper, RouterLink],
  templateUrl: './review.html',
  styleUrl: './review.css',
})
export class CheckoutReviewComponent {
  step = 2;

  private cartService = inject(CartService);
  private checkoutService = inject(CheckoutService);
  private authStore = inject(AuthStore);
  private router = inject(Router);

  items = this.cartService.items;
  itemCount = this.cartService.itemCount;
  subtotal = this.cartService.subtotal;
  discount = this.cartService.discount;
  total = this.cartService.total;
  coupon = this.cartService.coupon;

  isProcessing = signal(false);
  errorMessage = signal<string | null>(null);

  user = this.authStore.currentUser;

  activeItems = computed(() => this.items().filter(i => !i.savedForLater));

  get fullName(): string {
    const u = this.user();
    if (!u) return '—';
    return [u.firstName, u.lastName].filter(Boolean).join(' ') || '—';
  }

  get email(): string {
    const u = this.user();
    return u?.email || '—';
  }

  get phone(): string {
    const u = this.user();
    if (!u) return '—';
    const cc = u.phoneCountryCode || '';
    const num = u.phoneNumber || '';
    return [cc, num].filter(Boolean).join(' ') || '—';
  }

  get accountTypeLabel(): string {
    const u = this.user();
    if (!u) return '—';
    const map: Record<string, string> = {
      CLIENT_INDIVIDUAL: 'فرد',
      CLIENT_COMPANY: 'شركة',
      PROVIDER_INDIVIDUAL: 'مزود فردي',
      PROVIDER_COMPANY: 'مزود شركة',
    };
    return map[u.accountType] || u.accountType || '—';
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }

  // Fallback deliverables derived from item category/package (no API calls)
  getDeliverables(item: { category?: string; packageName?: string; title: string }): string[] {
    const cat = (item.category || '').toLowerCase();
    if (cat.includes('تصميم') || cat.includes('إبداع')) {
      return ['4 مقترحات للتصميم', 'ملفات PNG وSVG وAI وPSD', 'دليل استخدام الألوان والخطوط', 'تعديلات حسب الباقة والعقد'];
    }
    if (cat.includes('تسويق') || cat.includes('سوشيال')) {
      return ['إدارة 3 منصات اجتماعية', '20 منشور شهرياً', 'تصميم الصور والمحتوى', 'تقرير أداء شهري'];
    }
    return ['تسليم حسب الباقة المختارة', 'ملفات نهائية بجميع الصيغ', 'تعديلات حسب العقد', 'دليل الاستخدام'];
  }

  // Fallback milestones derived from item totalDays (no API calls)
  getMilestones(item: { totalDays: number; packageName?: string }): { label: string; sub: string }[] {
    const days = item.totalDays;
    if (days <= 7) {
      return [
        { label: 'اليوم 1 — بدء العمل', sub: 'مراجعة المتطلبات وبدء التنفيذ' },
        { label: `اليوم 2–${Math.max(3, days - 1)} — المسودة الأولية`, sub: 'تسليم المسودة الأولى للمراجعة' },
        { label: `اليوم ${days} — التسليم النهائي`, sub: 'تطبيق التعديلات وتسليم الملفات الكاملة' },
      ];
    }
    if (days <= 30) {
      return [
        { label: 'الأسبوع 1 — البداية', sub: 'إعداد الخطة والتصاميم' },
        { label: 'الأسبوع 2–4 — التنفيذ', sub: 'التنفيذ والمتابعة المستمرة' },
        { label: 'نهاية الشهر — التسليم', sub: 'التقرير النهائي والتسليمات الكاملة' },
      ];
    }
    return [
      { label: 'المرحلة 1 — البداية', sub: 'مراجعة المتطلبات وبدء العمل' },
      { label: 'المرحلة 2 — التنفيذ', sub: 'التنفيذ والمتابعة' },
      { label: 'المرحلة 3 — التسليم النهائي', sub: 'التسليمات النهائية' },
    ];
  }

  proceedToPayment() {
    if (this.itemCount() === 0 || this.isProcessing()) return;
    this.isProcessing.set(true);
    this.errorMessage.set(null);

    this.checkoutService.createOrder().subscribe({
      next: (result) => {
        if (result.success) {
          this.router.navigate(['/checkout/payment']);
        } else {
          this.errorMessage.set(result.message);
          this.isProcessing.set(false);
        }
      },
      error: () => {
        this.errorMessage.set('حدث خطأ، حاول مرة أخرى');
        this.isProcessing.set(false);
      },
    });
  }
}
