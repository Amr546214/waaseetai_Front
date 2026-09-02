import { Component, inject, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CheckoutService } from '../../../../core/services/checkout.service';

@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './success.html',
  styleUrl: './success.css',
})
export class CheckoutSuccessComponent implements OnInit {
  private checkoutService = inject(CheckoutService);
  private router = inject(Router);
  private isRedirecting = false;

  currentOrder = this.checkoutService.currentOrder;

  hasOrder = computed(() => !!this.currentOrder());
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

  nextSteps = [
    { icon: 'check', title: 'تم تأكيد الدفع', desc: 'تم استلام الدفعة وتأكيد الطلب' },
    { icon: 'shield', title: 'تم حفظ المبلغ في حساب الضمان', desc: 'المبلغ محفوظ بأمان حتى اكتمال الخدمة' },
    { icon: 'chat', title: 'سيتم فتح مساحة العمل / المحادثة', desc: 'يمكنك التواصل مع مقدم الخدمة مباشرة' },
    { icon: 'dashboard', title: 'تابع المشروع من لوحة التحكم', desc: 'تابع تقدم المشروع من صفحة مشاريعك' },
  ];

  formatPrice(value: number): string {
    return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }

  ngOnInit(): void {
    history.replaceState({ checkoutFinal: true }, '', window.location.href);
    history.pushState({ checkoutFinal: true }, '', window.location.href);
  }

  @HostListener('window:popstate', ['$event'])
  onPopState(event: PopStateEvent): void {
    if (this.isRedirecting) return;
    this.isRedirecting = true;
    this.router.navigate(['/marketplace'], { replaceUrl: true });
  }
}
