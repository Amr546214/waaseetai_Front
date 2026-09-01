import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CheckoutService } from '../../../../core/services/checkout.service';

@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './success.html',
  styleUrl: './success.css',
})
export class CheckoutSuccessComponent {
  private checkoutService = inject(CheckoutService);

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
}
