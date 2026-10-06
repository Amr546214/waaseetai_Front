import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type AccountTab = 'client-ind' | 'client-co' | 'provider-ind' | 'provider-co' | 'affiliate';

interface Package {
  name: string;
  desc: string;
  price: string;
  period: string;
  color: string;
  active: boolean;
  subscribers: number;
  featured?: boolean;
  features: string[];
}

interface PlatformFee {
  label: string;
  value: string;
  color: string;
  desc: string;
}

interface AccountRevenueRow {
  type: string;
  color: string;
  plan: string;
  subscribers: string;
  revenue: string;
  churn: string;
}

@Component({
  selector: 'app-sa-fees',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-fees.html',
  styleUrl: './sa-fees.css',
})
export class SaFees {
  activeTab = signal<AccountTab>('client-ind');
  editingFee = signal<PlatformFee | null>(null);
  editValue = signal('');
  toast = signal('');

  readonly tabs: { key: AccountTab; label: string }[] = [
    { key: 'client-ind', label: 'طالب فرد' },
    { key: 'client-co', label: 'طالب شركة' },
    { key: 'provider-ind', label: 'مقدم فرد' },
    { key: 'provider-co', label: 'مقدم شركة' },
    { key: 'affiliate', label: 'وسيط تسويقي' },
  ];

  platformFees = signal<PlatformFee[]>([
    { label: 'رسوم إتمام الصفقة', value: '10%', color: '#2BD4C7', desc: 'من قيمة كل مشروع مكتمل' },
    { label: 'حد السحب الأدنى', value: '200 $', color: '#FFB400', desc: 'أدنى مبلغ مسموح بسحبه' },
    { label: 'مدة احتجاز الضمان', value: '72 ساعة', color: '#5DA0FF', desc: 'من قبول التسليم حتى الإفراج' },
    { label: 'رسوم السحب', value: '0%', color: '#6B7699', desc: 'بدون رسوم تحويل للبنك' },
    { label: 'تعزيز الظهور (Boost)', value: '49 $', color: '#0FA99A', desc: 'ظهور مميز لمدة 7 أيام' },
    { label: 'نسبة الكاش باك', value: '2%', color: '#59C1F5', desc: 'لطالبي الخدمة على كل مشروع' },
  ]);

  readonly packagesByTab: Record<AccountTab, Package[]> = {
    'client-ind': [
      { name: 'مجاني', desc: 'للمبتدئين', price: '0', period: 'شهرياً', color: '#6B7699', active: true, subscribers: 4120, features: ['5 طلبات/شهر', 'مراسلة مقدمي الخدمة', 'دعم عبر المساعد AI'] },
      { name: 'Plus', desc: 'للمحترفين', price: '79', period: 'شهرياً', color: '#2BD4C7', active: true, subscribers: 890, featured: true, features: ['طلبات غير محدودة', 'أولوية في المطابقة', 'كاش باك 3%', 'دعم مباشر'] },
      { name: 'Premium', desc: 'للشركات الصغيرة', price: '199', period: 'شهرياً', color: '#D98A0B', active: true, subscribers: 420, features: ['كل مميزات Plus', 'تقارير متقدمة', 'مدير حساب مخصص', 'كاش باك 5%'] },
    ],
    'client-co': [
      { name: 'Business', desc: 'للشركات الناشئة', price: '399', period: 'شهرياً', color: '#5DA0FF', active: true, subscribers: 280, features: ['5 موظفين', 'طلبات غير محدودة', 'لوحة إدارة الفريق', 'تقارير مالية'] },
      { name: 'Enterprise', desc: 'للشركات الكبيرة', price: '999', period: 'شهرياً', color: '#D98A0B', active: true, subscribers: 120, featured: true, features: ['موظفون غير محدودون', 'API مباشر', 'مدير حساب VIP', 'تقارير مخصصة', 'SLA مضمون'] },
      { name: 'Enterprise+', desc: 'للمؤسسات الكبرى', price: 'تفاوضي', period: '', color: '#94B8CC', active: true, subscribers: 18, features: ['كل مميزات Enterprise', 'نشر خاص', 'دعم 24/7', 'تكاملات مخصصة'] },
    ],
    'provider-ind': [
      { name: 'مجاني', desc: 'للمبتدئين', price: '0', period: 'شهرياً', color: '#6B7699', active: true, subscribers: 2280, features: ['5 عروض/شهر', 'ملف مهني أساسي', 'دعم AI'] },
      { name: 'Starter', desc: 'للمحترفين', price: '99', period: 'شهرياً', color: '#2BD4C7', active: true, subscribers: 620, features: ['20 عرض/شهر', 'أولوية متوسطة', 'شارة Starter', 'دعم مباشر'] },
      { name: 'Pro', desc: 'للمحترفين المتقدمين', price: '299', period: 'شهرياً', color: '#D98A0B', active: true, subscribers: 1240, featured: true, features: ['عروض غير محدودة', 'أولوية قصوى', 'شارة Pro', 'تعزيز × 3/شهر', 'دعم VIP'] },
    ],
    'provider-co': [
      { name: 'Business', desc: 'للشركات الصغيرة', price: '499', period: 'شهرياً', color: '#5DA0FF', active: true, subscribers: 180, features: ['10 مقدمين', 'لوحة إدارة الفريق', 'تقارير الأداء', 'دعم مباشر'] },
      { name: 'Enterprise', desc: 'للشركات الكبيرة', price: '1,299', period: 'شهرياً/شركة', color: '#D98A0B', active: true, subscribers: 67, featured: true, features: ['مقدمون غير محدودون', 'API مباشر', 'مدير حساب مخصص', 'تقارير مخصصة'] },
    ],
    affiliate: [
      { name: 'مجاني', desc: 'للوسطاء الجدد', price: '0', period: '', color: '#6B7699', active: true, subscribers: 280, features: ['روابط إحالة أساسية', 'عمولة 8% على المستوى 1', 'تقارير أساسية'] },
      { name: 'Pro', desc: 'للوسطاء النشطين', price: '49', period: 'شهرياً', color: '#0FA99A', active: true, subscribers: 82, featured: true, features: ['عمولة محسّنة +1%', '15 رابط إحالة', 'تقارير تفصيلية', 'أولوية في الدعم'] },
    ],
  };

  packagesState = signal(this.packagesByTab);

  currentPackages = computed(() => this.packagesState()[this.activeTab()] || []);

  topPackage = computed(() => {
    const pkgs = this.currentPackages();
    return pkgs.reduce((a, b) => (b.subscribers > a.subscribers ? b : a), pkgs[0]);
  });

  totalSubscribers = computed(() => this.currentPackages().reduce((s, p) => s + p.subscribers, 0));

  readonly accountRevenue: AccountRevenueRow[] = [
    { type: 'طالب فرد', color: '#2BD4C7', plan: 'أساسي 99 $', subscribers: '2,841', revenue: '281K $', churn: '3.2%' },
    { type: 'طالب شركة', color: '#FFB400', plan: 'شركات 499 $', subscribers: '1,240', revenue: '619K $', churn: '1.8%' },
    { type: 'مقدم فرد', color: '#5DA0FF', plan: 'مهني 199 $', subscribers: '3,480', revenue: '692K $', churn: '2.4%' },
    { type: 'مقدم شركة', color: '#59C1F5', plan: 'شركة 999 $', subscribers: '742', revenue: '741K $', churn: '1.2%' },
  ];

  setTab(tab: AccountTab) {
    this.activeTab.set(tab);
  }

  togglePackage(pkg: Package) {
    this.packagesState.update((state) => {
      const next = { ...state };
      next[this.activeTab()] = next[this.activeTab()].map((p) => (p === pkg ? { ...p, active: !p.active } : p));
      return next;
    });
  }

  openEditFee(fee: PlatformFee) {
    this.editingFee.set(fee);
    this.editValue.set(fee.value);
  }

  closeEditFee() {
    this.editingFee.set(null);
    this.editValue.set('');
  }

  saveFee() {
    const fee = this.editingFee();
    if (!fee) return;
    const newValue = this.editValue().trim();
    if (!newValue) return;
    this.platformFees.update((fees) => fees.map((f) => (f === fee ? { ...f, value: newValue } : f)));
    this.showToast(`تم تحديث "${fee.label}" إلى ${newValue}`);
    this.closeEditFee();
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
