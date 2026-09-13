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

  plansInd: Plan[] = [
    {
      name: 'مبتدئ',
      icon: 'user',
      iconColor: 'teal',
      desc: 'للمقدمين الجدد على وسيط في مرحلة بناء السمعة والتقييمات الأولى',
      commission: '٪18',
      commissionSub: 'تُحسم تلقائياً عند تحرير المدفوعات',
      ctaLabel: 'سجّل مجاناً',
      features: [
        { text: 'نشر حتى 3 خدمات في السوق', included: true },
        { text: 'ملف مهني معتمد عام', included: true },
        { text: 'دعم فني عبر البريد', included: true },
        { text: 'AI Trust Score ابتدائي', included: true },
        { text: 'ظهور مميز في البحث', included: false },
        { text: 'تخفيض العمولة بالأداء', included: false }
      ]
    },
    {
      name: 'محترف',
      icon: 'provider',
      iconColor: 'blue',
      desc: 'للمقدمين النشطين بتقييمات جيدة وسجل حافل من المشاريع المكتملة',
      commission: '٪13',
      commissionSub: 'تتحسن تلقائياً مع ارتفاع AI Trust Score',
      featured: true,
      badge: 'الأكثر شيوعاً',
      ctaLabel: 'ابدأ الآن',
      features: [
        { text: 'نشر خدمات غير محدود', included: true },
        { text: 'ملف مهني معتمد + بادج محترف', included: true },
        { text: 'دعم فني أولوية', included: true },
        { text: 'AI Trust Score متقدم', included: true },
        { text: 'ظهور مميز في البحث والنتائج', included: true },
        { text: 'تخفيض العمولة بالأداء', included: true }
      ]
    },
    {
      name: 'خبير',
      icon: 'star',
      iconColor: 'ai',
      desc: 'للمقدمين ذوي AI Trust Score العالي والسجل الاستثنائي من الإنجازات',
      commission: '٪8',
      commissionSub: 'يُمنح تلقائياً بعد تحقيق معايير الجودة',
      ctaLabel: 'سجّل وابدأ',
      features: [
        { text: 'كل مزايا محترف', included: true },
        { text: 'بادج خبير بارز في ملفك', included: true },
        { text: 'أولوية قصوى في ترتيب النتائج', included: true },
        { text: 'أقل نسبة عمولة في السوق', included: true },
        { text: 'دعم مخصص مع مدير حساب', included: true },
        { text: 'تحليلات AI تفصيلية لخدماتك', included: true }
      ]
    }
  ];

  plansCo: Plan[] = [
    {
      name: 'شركة — مبتدئة',
      icon: 'building',
      iconColor: 'teal',
      desc: 'للشركات الجديدة في المرحلة الأولى من بناء ملف الشركة واعتماد فريقها',
      commission: '٪16',
      commissionSub: 'تُحسم تلقائياً عند تحرير المدفوعات',
      ctaLabel: 'سجّل مجاناً',
      features: [
        { text: 'ملف شركة معتمد', included: true },
        { text: 'إدارة حتى 3 أعضاء فريق', included: true },
        { text: 'نشر حتى 5 خدمات', included: true },
        { text: 'فواتير رسمية مؤسسية', included: true },
        { text: 'فريق غير محدود', included: false }
      ]
    },
    {
      name: 'شركة — نشطة',
      icon: 'building',
      iconColor: 'blue',
      desc: 'للشركات ذات النشاط المستمر وفريق العمل المتخصص المتعدد',
      commission: '٪11',
      commissionSub: 'تتحسن مع ارتفاع تقييم الشركة',
      featured: true,
      badge: 'الأنسب للشركات',
      ctaLabel: 'ابدأ الآن',
      features: [
        { text: 'كل مزايا الباقة المبتدئة', included: true },
        { text: 'فريق غير محدود + صلاحيات متدرجة', included: true },
        { text: 'نشر خدمات غير محدود', included: true },
        { text: 'تقارير أداء الشركة', included: true },
        { text: 'ظهور مميز في البحث', included: true }
      ]
    },
    {
      name: 'شركة — رائدة',
      icon: 'star',
      iconColor: 'ai',
      desc: 'للشركات ذات AI Trust Score المتميز وسجل استثنائي من المشاريع الناجحة',
      commission: '٪7',
      commissionSub: 'يُمنح تلقائياً بمعايير الجودة الشركاتية',
      ctaLabel: 'سجّل وابدأ',
      features: [
        { text: 'كل مزايا الشركة النشطة', included: true },
        { text: 'أقل عمولة في فئة الشركات', included: true },
        { text: 'بادج شركة رائدة في الملف', included: true },
        { text: 'مدير حساب مخصص', included: true },
        { text: 'أولوية قصوى في نتائج البحث', included: true }
      ]
    }
  ];

  faqs: FaqItem[] = [
    { q: 'هل التسجيل مجاني؟', a: 'نعم، التسجيل مجاني تماماً. لا تدفع أي شيء حتى تُكمل مشروعاً ويعتمده الطالب. العمولة تُحسم فقط عند تحرير المدفوعات.' },
    { q: 'متى تتحسن نسبة العمولة تلقائياً؟', a: 'يراقب AI Trust Score عدة معايير: معدل التسليم في الوقت المحدد، متوسط تقييمات الطالبين، ومعدل إكمال المشاريع. عند بلوغ معايير المستوى التالي تتحول تلقائياً بدون طلب.' },
    { q: 'هل يوجد حد أدنى لسحب الأرباح؟', a: 'السحب متاح في أي وقت من محفظتك في اللوحة، لا يوجد حد أدنى للسحب، والتحويل يتم خلال 1-3 أيام عمل.' },
    { q: 'ما الفرق بين حساب الفرد والشركة؟', a: 'حساب الفرد للمتخصص المستقل — ملف مهني شخصي وسحب أرباح شخصي. حساب الشركة يضيف إدارة الفريق وصلاحيات متدرجة وفواتير رسمية مؤسسية وسحب على مستوى الشركة.' },
    { q: 'هل تتغير العمولة على المشاريع الجارية؟', a: 'لا — العمولة المطبقة هي التي كانت سارية يوم بدأ المشروع. أي تحسن في مستواك يُطبق على المشاريع الجديدة فقط.' }
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
