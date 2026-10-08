import { Component, signal } from '@angular/core';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

interface PlanFeature {
  name: string;
  enabled: boolean;
}

interface StatRow {
  label: string;
  value: string;
  color?: string;
}

@Component({
  selector: 'app-sa-plan-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, WsSelectComponent],
  templateUrl: './sa-plan-details.html',
  styleUrl: './sa-plan-details.css',
})
export class SaPlanDetails {
  planName = signal('Pro');
  planType = signal('client');
  monthlyPrice = signal('260');
  annualPrice = signal('2,340');
  description = signal('باقة Pro المميزة — طلبات غير محدودة، دعم 24/7، تحليلات متقدمة، ظهور أولوية، شارة Pro');

  readonly typeOptions = [
    { value: 'client', label: 'طالب الخدمة' },
    { value: 'provider', label: 'مقدم الخدمة' },
    { value: 'broker', label: 'الوسيط' },
  ];

  features = signal<PlanFeature[]>([
    { name: 'طلبات غير محدودة', enabled: true },
    { name: 'دعم 24/7', enabled: true },
    { name: 'تحليلات متقدمة', enabled: true },
    { name: 'ظهور أولوية في البحث', enabled: true },
    { name: 'شارة Pro', enabled: true },
    { name: 'API وصول', enabled: false },
  ]);

  readonly planStats: StatRow[] = [
    { label: 'المشتركون الحاليون', value: '1,842', color: '#2BD4C7' },
    { label: 'اشتراكات جديدة هذا الشهر', value: '+124', color: '#0FA99A' },
    { label: 'الإيراد الشهري', value: '550,758 $', color: '#0FA99A' },
    { label: 'معدل التجديد', value: '89%', color: '#5DA0FF' },
    { label: 'معدل الإلغاء', value: '1.2%', color: '#FF8C69' },
    { label: 'نسبة من الكل', value: '38%' },
    { label: 'متوسط مدة الاشتراك', value: '4.8 أشهر' },
  ];

  readonly advancedStats: StatRow[] = [
    { label: 'نسخة تجريبية مجانية', value: '7 أيام', color: '#2BD4C7' },
    { label: 'الحد الأقصى للمستخدمين', value: '1 مستخدم' },
    { label: 'الكود الترويجي', value: 'PRO20', color: '#59C1F5' },
  ];

  saved = signal(false);

  toggleFeature(index: number): void {
    this.features.update((list) => list.map((f, i) => (i === index ? { ...f, enabled: !f.enabled } : f)));
  }

  save(): void {
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2500);
  }
}
