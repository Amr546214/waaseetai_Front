// MOCK data for the super-admin business models list + detail page. There is
// no backend endpoint for provider business models yet; both SaBusinessModels
// (list) and SaBusinessModelDetail (routed `business-models/:id` page) read
// from this shared array.

export type ModelStatus = 'pending' | 'approved' | 'rejected' | 'revision';

export interface PricingPackage {
  name: string;
  price: string;
  delivery: string;
  features: string;
  featured?: boolean;
}

export interface BusinessModel {
  id: string;
  name: string;
  provider: string;
  avatar: string;
  avatarBg: string;
  specialty: string;
  type: string;
  price: string;
  aiScore: number;
  date: string;
  status: ModelStatus;
  accountType: string;
  usersCount: number;
  createdAt: string;
  acceptanceRate: number;
  avgRating: number;
  completionRate: number;
  aiNotes: string[];
  pricing: PricingPackage[];
}

export const BUSINESS_MODELS: BusinessModel[] = [
  {
    id: 'MDL-089', name: 'خطة تسويق رقمي شاملة لشركات ناشئة', provider: 'سارة القحطاني', avatar: 'س', avatarBg: 'linear-gradient(135deg,#59C1F5,#5DA0FF)',
    specialty: 'تسويق', type: 'خطة عمل', price: '250 $', aiScore: 94, date: '15 يوليو 2026', status: 'pending',
    accountType: 'مقدم فرد', usersCount: 0, createdAt: 'يوليو 2026', acceptanceRate: 0, avgRating: 0, completionRate: 0,
    aiNotes: ['النموذج يغطي كل مراحل التسويق الرقمي بخطة زمنية واضحة — جودة عالية (94/100)', 'لا مخالفات محتوى أو ادعاءات مبالغ فيها'],
    pricing: [
      { name: 'أساسي', price: '250 $', delivery: 'تسليم 5 أيام', features: 'خطة شهر واحد · تقرير PDF' },
      { name: 'Pro', price: '650 $', delivery: 'تسليم 7 أيام', features: 'خطة 3 أشهر · تقرير + جدول تنفيذ', featured: true },
      { name: 'Premium', price: '1,400 $', delivery: 'تسليم 10 أيام', features: 'خطة سنوية كاملة + استشارة مباشرة' },
    ],
  },
  {
    id: 'MDL-088', name: 'نموذج عقد تطوير تطبيق iOS متكامل', provider: 'هيثم القرني', avatar: 'هـ', avatarBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
    specialty: 'برمجة', type: 'نموذج عقد', price: '150 $', aiScore: 88, date: '14 يوليو 2026', status: 'pending',
    accountType: 'مقدم فرد', usersCount: 0, createdAt: 'يوليو 2026', acceptanceRate: 0, avgRating: 0, completionRate: 0,
    aiNotes: ['بنود العقد متوافقة مع أنظمة العمل الحر ولا تحتوي شروطاً تعسفية', 'يُنصح بمراجعة بند الملكية الفكرية قبل الاعتماد'],
    pricing: [
      { name: 'أساسي', price: '150 $', delivery: 'فوري', features: 'عقد بسيط صفحة واحدة' },
      { name: 'Pro', price: '350 $', delivery: 'فوري', features: 'عقد شامل + ملاحق فنية', featured: true },
    ],
  },
  {
    id: 'MDL-087', name: 'دراسة جدوى تجارية للمشاريع الصغيرة', provider: 'نورة السهلي', avatar: 'ن', avatarBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)',
    specialty: 'استشارات', type: 'دراسة جدوى', price: '350 $', aiScore: 91, date: '13 يوليو 2026', status: 'pending',
    accountType: 'مقدم فرد', usersCount: 0, createdAt: 'يوليو 2026', acceptanceRate: 0, avgRating: 0, completionRate: 0,
    aiNotes: ['منهجية الدراسة تتبع معايير معتمدة وتتضمن تحليل مالي وتحليل مخاطر واضح'],
    pricing: [
      { name: 'أساسي', price: '350 $', delivery: 'تسليم 7 أيام', features: 'دراسة مختصرة 10 صفحات' },
      { name: 'Pro', price: '750 $', delivery: 'تسليم 12 يوم', features: 'دراسة كاملة + نموذج مالي Excel', featured: true },
    ],
  },
  {
    id: 'MDL-086', name: 'قالب تقرير إداري شهري احترافي', provider: 'أحمد الزهراني', avatar: 'أ', avatarBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
    specialty: 'استشارات', type: 'قالب تقرير', price: '80 $', aiScore: 76, date: '12 يوليو 2026', status: 'pending',
    accountType: 'مقدم فرد', usersCount: 0, createdAt: 'يوليو 2026', acceptanceRate: 0, avgRating: 0, completionRate: 0,
    aiNotes: ['القالب قياسي وواضح، جودة متوسطة نسبة للنماذج المشابهة (76/100)', 'يُقترح إضافة رسوم بيانية تفاعلية لرفع الجودة'],
    pricing: [{ name: 'أساسي', price: '80 $', delivery: 'فوري', features: 'قالب Word + PowerPoint' }],
  },
  {
    id: 'MDL-084', name: 'نموذج عقد تصميم هوية بصرية', provider: 'سارة القحطاني', avatar: 'س', avatarBg: 'linear-gradient(135deg,#59C1F5,#5DA0FF)',
    specialty: 'تصميم', type: 'نموذج عقد', price: '120 $', aiScore: 92, date: '11 يوليو 2026', status: 'pending',
    accountType: 'مقدم فرد', usersCount: 0, createdAt: 'يوليو 2026', acceptanceRate: 0, avgRating: 0, completionRate: 0,
    aiNotes: ['بنود واضحة لمراحل التسليم والمراجعات — جودة عالية (92/100)'],
    pricing: [{ name: 'أساسي', price: '120 $', delivery: 'فوري', features: 'عقد شامل + بند حقوق الاستخدام' }],
  },
  {
    id: 'MDL-079', name: 'تصميم الجرافيك — مقدم فرد', provider: 'خالد المالكي', avatar: 'خ', avatarBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
    specialty: 'تصميم', type: 'خطة عمل', price: '450 $', aiScore: 95, date: '8 يوليو 2026', status: 'approved',
    accountType: 'مقدم فرد', usersCount: 248, createdAt: 'مارس 2024', acceptanceRate: 78, avgRating: 4.7, completionRate: 94,
    aiNotes: ['النموذج يحقق أعلى نسبة تحويل بين نماذج التصميم (78%) — يُوصى بالإبقاء', 'باقة Pro الأكثر اختياراً (64%) — يُقترح رفع سعرها 15%'],
    pricing: [
      { name: 'أساسي', price: '150 $', delivery: 'تسليم 3 أيام', features: 'شعار واحد · مصدر PNG' },
      { name: 'Pro ⭐ الأكثر اختياراً', price: '450 $', delivery: 'تسليم 5 أيام', features: '3 مفاهيم · مصدر AI+PNG', featured: true },
      { name: 'Premium', price: '1,200 $', delivery: 'تسليم 7 أيام', features: 'هوية كاملة · كل الصيغ' },
    ],
  },
  {
    id: 'MDL-078', name: 'قالب تقرير SEO شهري', provider: 'نورة السهلي', avatar: 'ن', avatarBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)',
    specialty: 'تسويق', type: 'قالب تقرير', price: '99 $', aiScore: 89, date: '7 يوليو 2026', status: 'approved',
    accountType: 'مقدم فرد', usersCount: 142, createdAt: 'يناير 2025', acceptanceRate: 71, avgRating: 4.8, completionRate: 96,
    aiNotes: ['أداء ثابت ومرتفع منذ الإطلاق — لا حاجة لأي تعديل'],
    pricing: [{ name: 'أساسي', price: '99 $', delivery: 'فوري', features: 'قالب Google Sheets تفاعلي' }],
  },
  {
    id: 'MDL-077', name: 'نموذج استشارة قانونية أعمال', provider: 'خالد المالكي', avatar: 'خ', avatarBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
    specialty: 'استشارات', type: 'نموذج عقد', price: '180 $', aiScore: 56, date: '5 يوليو 2026', status: 'rejected',
    accountType: 'مقدم فرد', usersCount: 0, createdAt: 'يوليو 2026', acceptanceRate: 0, avgRating: 0, completionRate: 0,
    aiNotes: ['بعض البنود تتعارض مع نظام العمل السعودي — رُفض الطلب لحين تصحيحها'],
    pricing: [{ name: 'أساسي', price: '180 $', delivery: 'فوري', features: 'عقد استشارة قانونية عام' }],
  },
];
