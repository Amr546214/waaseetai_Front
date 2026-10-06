import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type AccountType = 'ind' | 'co';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  icon: string;
  iconColor: 'teal' | 'blue' | 'ai';
  desc: string;
  commission: string;
  commissionSub: string;
  featured?: boolean;
  badge?: string;
  features: PlanFeature[];
  ctaLabel: string;
}

interface FaqItem {
  q: string;
  a: string;
}

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pricing.html',
  styleUrl: './pricing.css'
})
export class Pricing {
  accountType = signal<AccountType>('ind');
  openFaq = signal<number | null>(0);

  // Provider levels come from a fixed 15-level ladder (points + completed projects + client rating); the commission/fee model
  // is NOT yet decided, so no percentage or reduction promise is published here (details live in the dashboard + payments policy).
  plansInd: Plan[] = [
    {
      name: 'المستويات الأولى',
      icon: 'user',
      iconColor: 'teal',
      desc: 'للمقدمين الجدد على وسيط: تبدأ من المستوى الأول وترتقي بالنقاط والمشاريع المكتملة وتقييمات الطالبين',
      commission: 'تفاصيل العمولة داخل لوحة التحكم',
      commissionSub: 'حسب مستوى الحساب',
      ctaLabel: 'سجّل مجاناً',
      features: [
        { text: 'نشر خدماتك في السوق بعد الاعتماد', included: true },
        { text: 'ملف مهني معتمد عام', included: true },
        { text: 'حماية مستحقاتك عبر حساب الضمان', included: true },
        { text: 'ترقية تلقائية للمستوى التالي عند بلوغ شروطه', included: true }
      ]
    },
    {
      name: 'المستويات المتوسطة',
      icon: 'provider',
      iconColor: 'blue',
      desc: 'للمقدمين النشطين بتقييمات جيدة وسجل متنامٍ من المشاريع المكتملة',
      commission: 'تفاصيل العمولة داخل لوحة التحكم',
      commissionSub: 'حسب مستوى الحساب وفق قواعد المنصة المعتمدة',
      featured: true,
      ctaLabel: 'ابدأ الآن',
      features: [
        { text: 'كل مزايا المستويات الأولى', included: true },
        { text: 'مستوى يظهر في ملفك العام', included: true },
        { text: 'تفاصيل العمولة والرسوم داخل لوحة التحكم', included: true }
      ]
    },
    {
      name: 'المستويات العليا',
      icon: 'star',
      iconColor: 'ai',
      desc: 'للمقدمين ذوي السجل المتميز من المشاريع المكتملة والتقييمات المرتفعة',
      commission: 'تفاصيل العمولة داخل لوحة التحكم',
      commissionSub: 'تُعرض عند بدء التعاملات أو داخل لوحة التحكم',
      ctaLabel: 'سجّل وابدأ',
      features: [
        { text: 'كل مزايا المستويات المتوسطة', included: true },
        { text: 'تفاصيل العمولة والرسوم داخل لوحة التحكم', included: true },
        { text: 'مستوى متقدم يظهر في ملفك العام', included: true }
      ]
    }
  ];

  // Companies use the same level ladder; the company tab only adds the account-type features.
  plansCo: Plan[] = [
    {
      name: 'شركة — المستويات الأولى',
      icon: 'building',
      iconColor: 'teal',
      desc: 'للشركات الجديدة في المرحلة الأولى من بناء ملف الشركة',
      commission: 'تفاصيل العمولة داخل لوحة التحكم',
      commissionSub: 'حسب مستوى الحساب',
      ctaLabel: 'سجّل مجاناً',
      features: [
        { text: 'ملف شركة معتمد', included: true },
        { text: 'نشر خدمات الشركة في السوق بعد الاعتماد', included: true },
        { text: 'فواتير رسمية مؤسسية', included: true },
        { text: 'ترقية تلقائية للمستوى التالي عند بلوغ شروطه', included: true }
      ]
    },
    {
      name: 'شركة — المستويات المتوسطة',
      icon: 'building',
      iconColor: 'blue',
      desc: 'للشركات ذات النشاط المستمر وسجل متنامٍ من المشاريع المكتملة',
      commission: 'تفاصيل العمولة داخل لوحة التحكم',
      commissionSub: 'حسب مستوى الحساب وفق قواعد المنصة المعتمدة',
      featured: true,
      ctaLabel: 'ابدأ الآن',
      features: [
        { text: 'كل مزايا المستويات الأولى', included: true },
        { text: 'تفاصيل العمولة والرسوم داخل لوحة التحكم', included: true },
        { text: 'مستوى يظهر في ملف الشركة العام', included: true }
      ]
    },
    {
      name: 'شركة — المستويات العليا',
      icon: 'star',
      iconColor: 'ai',
      desc: 'للشركات ذات السجل المتميز من المشاريع المكتملة والتقييمات المرتفعة',
      commission: 'تفاصيل العمولة داخل لوحة التحكم',
      commissionSub: 'تُعرض عند بدء التعاملات أو داخل لوحة التحكم',
      ctaLabel: 'سجّل وابدأ',
      features: [
        { text: 'كل مزايا المستويات المتوسطة', included: true },
        { text: 'تفاصيل العمولة والرسوم داخل لوحة التحكم', included: true }
      ]
    }
  ];

  faqs: FaqItem[] = [
    { q: 'هل التسجيل مجاني؟', a: 'نعم، التسجيل مجاني تماماً. تُوضَّح العمولة والرسوم في سياسة المدفوعات.' },
    { q: 'كيف يُحسب مستوى حسابي؟', a: 'يحسب النظام مستواك تلقائياً من نقاطك وعدد مشاريعك المكتملة ومتوسط تقييمات الطالبين. ولا ننشر نسباً رقمية قبل اعتماد نموذج العمولة النهائي.' },
    { q: 'هل يوجد حد أدنى لسحب الأرباح؟', a: 'السحب متاح في أي وقت من محفظتك في اللوحة، لا يوجد حد أدنى للسحب، والتحويل يتم خلال 1-3 أيام عمل.' },
    { q: 'ما الفرق بين حساب الفرد والشركة؟', a: 'حساب الفرد للمتخصص المستقل — ملف مهني شخصي وسحب أرباح شخصي. حساب الشركة يضيف إدارة الفريق وصلاحيات متدرجة وفواتير رسمية مؤسسية وسحب على مستوى الشركة.' },
    { q: 'أين أرى نسبة عمولتي الحالية؟', a: 'تُعرض تفاصيل العمولة والرسوم داخل لوحة التحكم وسياسة المدفوعات، وقد تختلف حسب مستوى الحساب وفق قواعد المنصة المعتمدة.' }
  ];

  get plans(): Plan[] {
    return this.accountType() === 'ind' ? this.plansInd : this.plansCo;
  }

  setAccountType(type: AccountType): void {
    this.accountType.set(type);
  }

  toggleFaq(index: number): void {
    this.openFaq.set(this.openFaq() === index ? null : index);
  }
}
