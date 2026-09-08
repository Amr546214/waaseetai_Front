import { Component, inject, computed, OnInit, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { CheckoutService } from '../../../../core/services/checkout.service';
import { CheckoutApiService } from '../../../../core/services/checkout-api.service';
import { mapOrder, BackendOrderResponse } from '../../../../core/services/checkout-mappers';
import { AuthStore } from '../../../../core/store/auth.store';

@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './success.html',
  styleUrl: './success.css',
})
export class CheckoutSuccessComponent implements OnInit {
  private checkoutService = inject(CheckoutService);
  private checkoutApi = inject(CheckoutApiService);
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private isRedirecting = false;

  isRehydrating = signal(false);
  currentOrder = this.checkoutService.currentOrder;
  user = this.authStore.currentUser;

  hasOrder = computed(() => !!this.currentOrder());
  showFallback = computed(() => !this.currentOrder() && !this.isRehydrating());
  orderNumber = computed(() => this.currentOrder()?.orderNumber || '');
  orderTotal = computed(() => this.currentOrder()?.total || 0);
  orderStatus = computed(() => this.currentOrder()?.status || '');
  orderDate = computed(() => {
    const created = this.currentOrder()?.createdAt;
    if (!created) return '';
    return new Date(created).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });
  itemCount = computed(() => this.currentOrder()?.items.length || 0);
  orderItems = computed(() => this.currentOrder()?.items || []);
  userEmail = computed(() => this.user()?.email || '');

  // Design next steps (P-BF-005.html)
  nextSteps = [
    { num: 1, title: 'تفعيل المشروع', sub: 'تم إنشاء مشروعك تلقائياً في لوحة التحكم وبدأ العد التنازلي للتسليم' },
    { num: 2, title: 'تواصل المقدم', sub: 'سيراسلك المقدمون خلال 24 ساعة للتفاصيل والمتطلبات عبر لوحتك' },
    { num: 3, title: 'التسليم والتقييم', sub: 'بعد اعتماد التسليم تحرر المدفوعات للمقدم ويمكنك تقييم التجربة' },
  ];

  formatPrice(value: number): string {
    return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }

  ngOnInit(): void {
    history.replaceState({ checkoutFinal: true }, '', window.location.href);
    history.pushState({ checkoutFinal: true }, '', window.location.href);

    if (!this.currentOrder()) {
      const orderId = this.route.snapshot.queryParamMap.get('orderId');
      if (orderId) {
        this.isRehydrating.set(true);
        this.checkoutApi.getOrder(orderId).subscribe({
          next: (res: any) => {
            const data = res?.data ?? res;
            const order = mapOrder(data as BackendOrderResponse);
            this.checkoutService.hydrateOrder(order);
            this.isRehydrating.set(false);
          },
          error: (err: any) => {
            console.error('[CheckoutSuccess] Failed to rehydrate order:', err);
            this.isRehydrating.set(false);
          },
        });
      }
    }
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event: PopStateEvent): void {
    if (this.isRedirecting) return;
    this.isRedirecting = true;
    setTimeout(() => {
      this.router.navigate(['/marketplace'], { replaceUrl: true });
    }, 0);
  }
}
