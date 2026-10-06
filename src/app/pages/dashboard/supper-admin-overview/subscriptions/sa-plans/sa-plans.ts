import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

type Audience = 'client' | 'provider' | 'broker';

interface PlanTier {
  name: string;
  color: string;
  price: string;
  period: string;
  count: number;
  pct: number;
  features: string[];
  featured?: boolean;
  buttonLabel: string;
}

interface PlanKpi {
  label: string;
  value: string;
  unit: string;
  sub: string;
  color: string;
  subColor: string;
}

@Component({
  selector: 'app-sa-plans',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-plans.html',
  styleUrl: './sa-plans.css',
})
export class SaPlans {
  audience = signal<Audience>('client');

  readonly audiences: { key: Audience; label: string }[] = [
    { key: 'client', label: 'طالب الخدمة' },
    { key: 'provider', label: 'مقدم الخدمة' },
    { key: 'broker', label: 'الوسيط' },
  ];

  readonly kpis: PlanKpi[] = [
    { label: 'إجمالي المشتركين', value: '4,821', unit: 'مشترك نشط', sub: '+124 هذا الشهر', color: '#2BD4C7', subColor: '#0FA99A' },
    { label: 'إيرادات الاشتراكات', value: '2.96M', unit: 'دولار — 2026', sub: '20% من إجمالي الإيرادات', color: '#0FA99A', subColor: '#6B7699' },
    { label: 'الباقة الأشهر', value: 'Pro', unit: 'الأكثر اشتراكاً', sub: '1,842 مشترك (38%)', color: '#FFB400', subColor: '#6B7699' },
    { label: 'معدل التجديد', value: '87%', unit: 'من الاشتراكات', sub: 'أعلى من المعيار', color: '#5DA0FF', subColor: '#0FA99A' },
  ];

  private readonly plansByAudience: Record<Audience, PlanTier[]> = {
    client: [
      { name: 'مجاني', color: '#6B7699', price: '0', period: 'دائماً', count: 1241, pct: 26, features: ['3 طلبات شهرياً', 'دعم أساسي', 'ملف شخصي'], buttonLabel: 'الحالي' },
      { name: 'أساسي', color: '#5DA0FF', price: '99', period: '/شهر', count: 892, pct: 18, features: ['20 طلباً شهرياً', 'دعم أولوية', 'إحصاءات أساسية', 'شارة مُعتمد'], buttonLabel: 'تعديل' },
      { name: 'Pro', color: '#2BD4C7', price: '299', period: '/شهر', count: 1842, pct: 38, features: ['طلبات غير محدودة', 'دعم 24/7', 'تحليلات متقدمة', 'ظهور أولوية', 'شارة Pro'], featured: true, buttonLabel: 'الأشهر' },
      { name: 'Business', color: '#59C1F5', price: '699', period: '/شهر', count: 612, pct: 13, features: ['كل مزايا Pro', 'مدير حساب', 'تقارير مخصصة', 'API وصول'], buttonLabel: 'تعديل' },
      { name: 'Enterprise', color: '#FF8C69', price: 'مخصص', period: '', count: 234, pct: 5, features: ['سعر خاص', 'كل المزايا', 'SLA مضمون', 'تكامل مخصص'], buttonLabel: 'تواصل' },
    ],
    provider: [
      { name: 'مجاني', color: '#6B7699', price: '0', period: 'دائماً', count: 3104, pct: 41, features: ['5 عروض شهرياً', 'دعم أساسي', 'ملف عام'], buttonLabel: 'الحالي' },
      { name: 'أساسي', color: '#5DA0FF', price: '129', period: '/شهر', count: 1680, pct: 22, features: ['30 عرضاً شهرياً', 'دعم أولوية', 'شارة مُعتمد'], buttonLabel: 'تعديل' },
      { name: 'Pro', color: '#2BD4C7', price: '349', period: '/شهر', count: 2210, pct: 29, features: ['عروض غير محدودة', 'ظهور أولوية في البحث', 'تحليلات أداء', 'شارة Pro'], featured: true, buttonLabel: 'الأشهر' },
      { name: 'Business', color: '#59C1F5', price: '799', period: '/شهر', count: 480, pct: 6, features: ['فريق حتى 5 أعضاء', 'مدير حساب', 'تقارير مخصصة'], buttonLabel: 'تعديل' },
      { name: 'Enterprise', color: '#FF8C69', price: 'مخصص', period: '', count: 140, pct: 2, features: ['سعر خاص', 'API وصول', 'SLA مضمون'], buttonLabel: 'تواصل' },
    ],
    broker: [
      { name: 'مجاني', color: '#6B7699', price: '0', period: 'دائماً', count: 210, pct: 33, features: ['وساطة محدودة', 'دعم أساسي'], buttonLabel: 'الحالي' },
      { name: 'أساسي', color: '#5DA0FF', price: '199', period: '/شهر', count: 168, pct: 26, features: ['عمولة مخفضة', 'دعم أولوية'], buttonLabel: 'تعديل' },
      { name: 'Pro', color: '#2BD4C7', price: '449', period: '/شهر', count: 190, pct: 29, features: ['وساطة غير محدودة', 'تحليلات متقدمة', 'شارة Pro'], featured: true, buttonLabel: 'الأشهر' },
      { name: 'Business', color: '#59C1F5', price: '899', period: '/شهر', count: 62, pct: 10, features: ['فريق وسطاء', 'مدير حساب'], buttonLabel: 'تعديل' },
      { name: 'Enterprise', color: '#FF8C69', price: 'مخصص', period: '', count: 12, pct: 2, features: ['سعر خاص', 'تكامل مخصص'], buttonLabel: 'تواصل' },
    ],
  };

  plans = computed(() => this.plansByAudience[this.audience()]);

  selectAudience(key: Audience): void {
    this.audience.set(key);
  }
}
