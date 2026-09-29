// MOCK data for the super-admin specialty accreditation requests list + detail
// page. There is no backend endpoint for these requests yet; both
// SaSpecialtiesAccreditation (list) and SaSpecialtyAccreditationDetail
// (routed `specialties-accreditation/:id` page) read from this shared array.

export type ReqStatus = 'pending' | 'approved' | 'rejected';
export type AiRec = 'accept' | 'review' | 'weak';

export interface OtherPendingRequest {
  specialty: string;
  status: string;
}

export interface AccreditationRequest {
  id: string;
  userId: string;
  provider: string;
  avatar: string;
  avatarBg: string;
  specialty: string;
  accountType: string;
  subCategory: string;
  yearsExperience: number;
  currentRating: number;
  projects: number;
  docsCount: number;
  docsOk: boolean;
  aiRec: AiRec;
  aiScore: number;
  date: string;
  status: ReqStatus;
  memberSince: string;
  priorReports: number;
  aiNotes: string[];
  portfolio: { emoji: string; label: string }[];
  documents: string[];
  otherPending: OtherPendingRequest[];
}

export const AI_REC_LABELS: Record<AiRec, string> = {
  accept: 'يُنصح بالقبول',
  review: 'مراجعة يدوية',
  weak: 'ضعيف',
};

export const ACCREDITATION_REQUESTS: AccreditationRequest[] = [
  {
    id: 'AC-081', userId: 'U-4021', provider: 'سارة القحطاني', avatar: 'س', avatarBg: 'linear-gradient(135deg,#59C1F5,#5DA0FF)',
    specialty: 'موشن جرافيك', accountType: 'مقدم خدمة فرد', subCategory: 'إنتاج فيديو ورسوم متحركة', yearsExperience: 5,
    currentRating: 4.9, projects: 23, docsCount: 3, docsOk: true, aiRec: 'accept', aiScore: 94,
    date: '15 يوليو 2026', status: 'pending', memberSince: 'يناير 2025', priorReports: 0,
    aiNotes: [
      'جودة المحفظة عالية — 3 نماذج تتوافق مع معايير وسيط AI (درجة: 91/100)',
      'خبرة موثّقة 5 سنوات مع تقييمات إيجابية · يُوصى بالقبول',
      'الطلب مستوفٍ لجميع متطلبات الاعتماد — لا ملاحظات سلبية',
    ],
    portfolio: [{ emoji: '🎬', label: 'إعلان تجاري' }, { emoji: '🎞️', label: 'موشن جرافيك' }, { emoji: '📱', label: 'محتوى سوشيال' }],
    documents: ['شهادة خبرة من استوديو الإبداع', 'شهادة Adobe After Effects Certified'],
    otherPending: [
      { specialty: 'تصميم جرافيك', status: 'مراجعة' },
      { specialty: 'إدارة سوشيال ميديا', status: 'مراجعة' },
    ],
  },
  {
    id: 'AC-080', userId: 'U-3987', provider: 'ريم الحربي', avatar: 'ر', avatarBg: 'linear-gradient(135deg,#FFB400,#59C1F5)',
    specialty: 'تصميم UX/UI', accountType: 'مقدم خدمة فرد', subCategory: 'تصميم تطبيقات الجوال', yearsExperience: 4,
    currentRating: 4.8, projects: 18, docsCount: 4, docsOk: true, aiRec: 'accept', aiScore: 91,
    date: '15 يوليو 2026', status: 'pending', memberSince: 'مارس 2025', priorReports: 0,
    aiNotes: [
      'محفظة قوية بـ 4 مشاريع تطبيقات كاملة — درجة جودة 89/100',
      'اجتاز اختبار Figma الداخلي بتقييم ممتاز',
    ],
    portfolio: [{ emoji: '📱', label: 'تطبيق توصيل' }, { emoji: '🎨', label: 'هوية تطبيق' }],
    documents: ['شهادة UX Design من Google', 'شهادة Figma Professional'],
    otherPending: [],
  },
  {
    id: 'AC-079', userId: 'U-4102', provider: 'هيثم القرني', avatar: 'هـ', avatarBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
    specialty: 'الذكاء الاصطناعي', accountType: 'مقدم خدمة فرد', subCategory: 'نماذج تعلم آلي', yearsExperience: 2,
    currentRating: 4.7, projects: 12, docsCount: 2, docsOk: false, aiRec: 'review', aiScore: 68,
    date: '14 يوليو 2026', status: 'pending', memberSince: 'يونيو 2026', priorReports: 0,
    aiNotes: [
      'وثيقتان فقط مرفوعتان وإحداهما غير واضحة — يلزم مراجعة يدوية',
      'خبرة عملية محدودة (سنتان) مقارنة بمتوسط المتخصصين في هذا المجال',
    ],
    portfolio: [{ emoji: '🤖', label: 'نموذج تصنيف' }],
    documents: ['شهادة دورة تعلم آلي (جودة الصورة منخفضة)'],
    otherPending: [],
  },
  {
    id: 'AC-078', userId: 'U-3766', provider: 'أحمد الزهراني', avatar: 'أ', avatarBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
    specialty: 'هوية بصرية', accountType: 'مقدم خدمة فرد', subCategory: 'تصميم الجرافيك', yearsExperience: 4,
    currentRating: 4.7, projects: 34, docsCount: 5, docsOk: true, aiRec: 'accept', aiScore: 89,
    date: '14 يوليو 2026', status: 'pending', memberSince: 'يناير 2025', priorReports: 0,
    aiNotes: ['جودة المحفظة عالية — 3 نماذج تتوافق مع معايير وسيط AI (درجة: 87/100)', 'خبرة موثّقة 4 سنوات مع تقييمات إيجابية · يُوصى بالقبول'],
    portfolio: [{ emoji: '🎨', label: 'هوية بصرية' }, { emoji: '🖼️', label: 'شعار شركة' }, { emoji: '📱', label: 'سوشيال ميديا' }],
    documents: ['شهادة خبرة من شركة الأفق التقنية', 'شهادة Adobe Certified Professional'],
    otherPending: [
      { specialty: 'تصوير منتجات', status: 'مراجعة' },
    ],
  },
  {
    id: 'AC-075', userId: 'U-4180', provider: 'خالد المالكي', avatar: 'خ', avatarBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
    specialty: 'الاستشارات القانونية', accountType: 'مقدم خدمة فرد', subCategory: 'عقود تجارية', yearsExperience: 1,
    currentRating: 4.5, projects: 8, docsCount: 2, docsOk: false, aiRec: 'weak', aiScore: 42,
    date: '12 يوليو 2026', status: 'pending', memberSince: 'يوليو 2026', priorReports: 1,
    aiNotes: ['لا توجد شهادة ترخيص مزاولة مهنة قانونية مرفقة', 'بلاغ سابق واحد بخصوص استشارة غير دقيقة — يُنصح بالرفض أو طلب مستندات إضافية'],
    portfolio: [{ emoji: '📄', label: 'نموذج عقد' }],
    documents: ['بطاقة عمل (غير كافية كإثبات ترخيص)'],
    otherPending: [],
  },
  {
    id: 'AC-070', userId: 'U-3512', provider: 'نورة السهلي', avatar: 'ن', avatarBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)',
    specialty: 'تحسين محركات البحث', accountType: 'مقدم خدمة فرد', subCategory: 'SEO تقني', yearsExperience: 6,
    currentRating: 4.9, projects: 28, docsCount: 3, docsOk: true, aiRec: 'accept', aiScore: 96,
    date: '10 يوليو 2026', status: 'approved', memberSince: 'نوفمبر 2024', priorReports: 0,
    aiNotes: ['أعلى درجة جودة محفظة هذا الشهر (96/100)', 'اعتمد المراجع الطلب بعد تأكيد النتائج المرفقة'],
    portfolio: [{ emoji: '📈', label: 'تقرير نمو عضوي' }, { emoji: '🔍', label: 'تدقيق SEO' }],
    documents: ['شهادة Google Analytics', 'شهادة SEMrush SEO Toolkit'],
    otherPending: [],
  },
  {
    id: 'AC-066', userId: 'U-3299', provider: 'محمد الشمراني', avatar: 'م', avatarBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
    specialty: 'إنتاج الفيديو', accountType: 'مقدم خدمة فرد', subCategory: 'مونتاج احترافي', yearsExperience: 3,
    currentRating: 4.2, projects: 6, docsCount: 1, docsOk: false, aiRec: 'weak', aiScore: 38,
    date: '5 يوليو 2026', status: 'rejected', memberSince: 'أبريل 2026', priorReports: 2,
    aiNotes: ['نماذج المحفظة غير أصلية — تطابق جزئي مع أعمال منشورة لمقدمين آخرين', 'رفض المراجع الطلب لعدم استيفاء شرط الأصالة'],
    portfolio: [{ emoji: '🎬', label: 'مونتاج فيديو' }],
    documents: ['ملف سيرة ذاتية بدون شهادات داعمة'],
    otherPending: [],
  },
];
