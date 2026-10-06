// Mock data — no backend endpoint exists for service requests yet; shared by
// the list (sa-requests) and the routed detail page (sa-request-detail).

export type ReqStatus = 'open' | 'in-progress' | 'completed' | 'cancelled' | 'flagged';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface RequestOffer {
  id: string;
  provider: string;
  providerAv: string;
  providerBg: string;
  level: string;
  price: string;
  priceValue: number;
  duration: string;
  projectsCount: number;
  disputeRate: string;
  completionRate: string;
  accepted: boolean;
  aiTop: boolean;
}

export interface ActivityLogEntry {
  text: string;
  date: string;
  dotColor: string;
}

export interface ClientStats {
  id: string;
  type: string;
  risk: RiskLevel;
  pastProjects: number;
  rating: number;
  totalSpend: string;
  memberSince: string;
}

export interface ServiceRequest {
  id: string;
  title: string;
  client: string;
  clientAv: string;
  clientBg: string;
  spec: string;
  budget: string;
  offers: number;
  date: string;
  status: ReqStatus;
  aiClean: boolean;
  description: string;
  requirements: string[];
  durationRange: string;
  linkedContract?: string;
  linkedProject?: string;
  aiScore: number;
  offersList: RequestOffer[];
  activityLog: ActivityLogEntry[];
  clientStats: ClientStats;
}

export interface TimelineStep {
  label: string;
  note: string;
  done: boolean;
}

export const REQ_STATUS_LABELS: Record<ReqStatus, string> = {
  open: 'مفتوح',
  'in-progress': 'جارٍ',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  flagged: 'مُبلَّغ عنه',
};

export const REQ_STATUS_CLASSES: Record<ReqStatus, string> = {
  open: 'rq-st-open',
  'in-progress': 'rq-st-progress',
  completed: 'rq-st-completed',
  cancelled: 'rq-st-cancelled',
  flagged: 'rq-st-flagged',
};

export const SERVICE_REQUESTS: ServiceRequest[] = [
  {
    id: 'RQ-1301', title: 'تصميم بنرات إعلانية × 10', client: 'شركة الخليج التقنية',
    clientAv: 'خ', clientBg: 'linear-gradient(135deg,#FFB400,#FF8C69)', spec: 'تصميم',
    budget: '3,500 $', offers: 7, date: '2026-09-08', status: 'in-progress', aiClean: true,
    description: 'تصميم 10 بنرات إعلانية رقمية بأحجام متعددة لمنصات التواصل الاجتماعي.',
    requirements: ['بنرات بمقاسات إنستغرام وتويتر ولينكدإن', 'ملفات مصدر PSD', 'هوية بصرية موحدة'],
    durationRange: '5-7 أيام', linkedContract: 'CO-1301', linkedProject: 'PR-1301',
    aiScore: 94,
    offersList: [
      { id: 'OF-1301-1', provider: 'سارة القحطاني', providerAv: 'س', providerBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)', level: 'Platinum · 4.9★', price: '3,400 $', priceValue: 3400, duration: '6 أيام', projectsCount: 52, disputeRate: '0%', completionRate: '100%', accepted: true, aiTop: true },
      { id: 'OF-1301-2', provider: 'عبدالله الحربي', providerAv: 'ع', providerBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', level: 'Gold · 4.6★', price: '2,900 $', priceValue: 2900, duration: '8 أيام', projectsCount: 28, disputeRate: '3.1%', completionRate: '96%', accepted: false, aiTop: false },
      { id: 'OF-1301-3', provider: 'استوديو لمسة', providerAv: 'ل', providerBg: 'linear-gradient(135deg,#A56BE0,#FF8C69)', level: 'مقدم شركة · 4.7★', price: '4,200 $', priceValue: 4200, duration: '5 أيام', projectsCount: 61, disputeRate: '1.5%', completionRate: '98%', accepted: false, aiTop: false },
      { id: 'OF-1301-4', provider: 'منى العنزي', providerAv: 'م', providerBg: 'linear-gradient(135deg,#FFB400,#FF8C69)', level: 'Silver · 4.3★', price: '2,600 $', priceValue: 2600, duration: '9 أيام', projectsCount: 14, disputeRate: '4.8%', completionRate: '91%', accepted: false, aiTop: false },
      { id: 'OF-1301-5', provider: 'خالد الدوسري', providerAv: 'خ', providerBg: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', level: 'Gold · 4.5★', price: '3,100 $', priceValue: 3100, duration: '7 أيام', projectsCount: 33, disputeRate: '2.2%', completionRate: '95%', accepted: false, aiTop: false },
      { id: 'OF-1301-6', provider: 'وكالة إبداع الرقمية', providerAv: 'إ', providerBg: 'linear-gradient(135deg,#5DA0FF,#2B7FFF)', level: 'مقدم شركة · 4.8★', price: '4,800 $', priceValue: 4800, duration: '5 أيام', projectsCount: 77, disputeRate: '0.9%', completionRate: '99%', accepted: false, aiTop: false },
      { id: 'OF-1301-7', provider: 'ريم الشمري', providerAv: 'ر', providerBg: 'linear-gradient(135deg,#FF8C69,#FFB400)', level: 'Bronze · 4.0★', price: '2,300 $', priceValue: 2300, duration: '10 أيام', projectsCount: 6, disputeRate: '6.7%', completionRate: '85%', accepted: false, aiTop: false },
    ],
    activityLog: [
      { text: 'أُفرج عن دفعة جزئية 1,200 $ بعد اكتمال المرحلة الأولى', date: '2026-09-12', dotColor: '#0FA99A' },
      { text: 'وُقّع العقد CO-1301 وبدأ تنفيذ المشروع PR-1301', date: '2026-09-10', dotColor: '#2BD4C7' },
      { text: 'قبلت شركة الخليج التقنية عرض سارة القحطاني (3,400 $)', date: '2026-09-10', dotColor: '#A56BE0' },
      { text: 'وردت 7 عروض من مقدمي خدمة مختلفين', date: '2026-09-08 — 2026-09-09', dotColor: '#5DA0FF' },
      { text: 'نُشر الطلب وفُحص تلقائياً بواسطة AI — النتيجة: نظيف', date: '2026-09-08', dotColor: '#2BD4C7' },
    ],
    clientStats: { id: 'USR-2031', type: 'طالب شركة', risk: 'medium', pastProjects: 41, rating: 4.2, totalSpend: '385,000 $', memberSince: 'يناير 2023' },
  },
  {
    id: 'RQ-1298', title: 'تطوير تطبيق جوال iOS', client: 'مؤسسة النور',
    clientAv: 'ن', clientBg: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', spec: 'برمجة',
    budget: '28,000 $', offers: 7, date: '2026-09-07', status: 'open', aiClean: true,
    description: 'تطوير تطبيق جوال متكامل لنظام iOS لإدارة طلبات متجر النور.',
    requirements: ['واجهة Swift UI حديثة', 'ربط مع بوابة دفع', 'نظام إشعارات فوري'],
    durationRange: '45-60 يوم',
    aiScore: 91,
    offersList: [
      { id: 'OF-1298-1', provider: 'تِك رواد', providerAv: 'ت', providerBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', level: 'مقدم شركة · 4.8★', price: '25,500 $', priceValue: 25500, duration: '50 يوم', projectsCount: 46, disputeRate: '1.1%', completionRate: '97%', accepted: false, aiTop: true },
      { id: 'OF-1298-2', provider: 'عبدالعزيز الغامدي', providerAv: 'ع', providerBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)', level: 'Platinum · 4.6★', price: '27,000 $', priceValue: 27000, duration: '55 يوم', projectsCount: 39, disputeRate: '2.0%', completionRate: '95%', accepted: false, aiTop: false },
      { id: 'OF-1298-3', provider: 'شركة كودكس السعودية', providerAv: 'ك', providerBg: 'linear-gradient(135deg,#FFB400,#FF8C69)', level: 'مقدم شركة · 4.7★', price: '31,000 $', priceValue: 31000, duration: '45 يوم', projectsCount: 58, disputeRate: '1.4%', completionRate: '96%', accepted: false, aiTop: false },
      { id: 'OF-1298-4', provider: 'فيصل آل سعيد', providerAv: 'ف', providerBg: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', level: 'Gold · 4.4★', price: '24,800 $', priceValue: 24800, duration: '60 يوم', projectsCount: 21, disputeRate: '3.5%', completionRate: '92%', accepted: false, aiTop: false },
      { id: 'OF-1298-5', provider: 'لجين العتيبي', providerAv: 'ل', providerBg: 'linear-gradient(135deg,#5DA0FF,#2B7FFF)', level: 'Gold · 4.5★', price: '26,200 $', priceValue: 26200, duration: '52 يوم', projectsCount: 19, disputeRate: '2.8%', completionRate: '94%', accepted: false, aiTop: false },
      { id: 'OF-1298-6', provider: 'تطبيقات الواحة', providerAv: 'و', providerBg: 'linear-gradient(135deg,#A56BE0,#FF8C69)', level: 'مقدم شركة · 4.3★', price: '29,500 $', priceValue: 29500, duration: '48 يوم', projectsCount: 27, disputeRate: '4.0%', completionRate: '90%', accepted: false, aiTop: false },
      { id: 'OF-1298-7', provider: 'ماجد السبيعي', providerAv: 'م', providerBg: 'linear-gradient(135deg,#FF8C69,#FFB400)', level: 'Silver · 4.1★', price: '23,900 $', priceValue: 23900, duration: '65 يوم', projectsCount: 11, disputeRate: '5.5%', completionRate: '88%', accepted: false, aiTop: false },
    ],
    activityLog: [
      { text: 'وردت 7 عروض من مقدمي خدمة مؤهلين خلال 3 أيام', date: '2026-09-07 — 2026-09-09', dotColor: '#5DA0FF' },
      { text: 'نُشر الطلب وفُحص تلقائياً بواسطة AI — النتيجة: نظيف', date: '2026-09-07', dotColor: '#2BD4C7' },
    ],
    clientStats: { id: 'USR-1876', type: 'طالب مؤسسة', risk: 'low', pastProjects: 18, rating: 4.6, totalSpend: '142,000 $', memberSince: 'مارس 2024' },
  },
  {
    id: 'RQ-1295', title: 'كتابة محتوى تسويقي لموقع', client: 'محمد العمري',
    clientAv: 'م', clientBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', spec: 'كتابة',
    budget: '1,200 $', offers: 11, date: '2026-09-06', status: 'open', aiClean: true,
    description: 'كتابة محتوى تسويقي احترافي لصفحات موقع خدمي جديد.',
    requirements: ['8 صفحات محتوى', 'تحسين محركات البحث SEO', 'أسلوب تسويقي مقنع'],
    durationRange: '3-5 أيام',
    aiScore: 89,
    offersList: [
      { id: 'OF-1295-1', provider: 'هند الزهراني', providerAv: 'ه', providerBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)', level: 'Platinum · 4.9★', price: '1,150 $', priceValue: 1150, duration: '3 أيام', projectsCount: 88, disputeRate: '0%', completionRate: '100%', accepted: false, aiTop: true },
      { id: 'OF-1295-2', provider: 'عمر البلوي', providerAv: 'ع', providerBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', level: 'Gold · 4.6★', price: '980 $', priceValue: 980, duration: '4 أيام', projectsCount: 42, disputeRate: '1.8%', completionRate: '97%', accepted: false, aiTop: false },
      { id: 'OF-1295-3', provider: 'سلمى إدريس', providerAv: 'س', providerBg: 'linear-gradient(135deg,#FFB400,#FF8C69)', level: 'Gold · 4.5★', price: '1,050 $', priceValue: 1050, duration: '3 أيام', projectsCount: 35, disputeRate: '2.3%', completionRate: '95%', accepted: false, aiTop: false },
      { id: 'OF-1295-4', provider: 'وكالة الحرف', providerAv: 'ح', providerBg: 'linear-gradient(135deg,#5DA0FF,#2B7FFF)', level: 'مقدم شركة · 4.7★', price: '1,600 $', priceValue: 1600, duration: '2 أيام', projectsCount: 64, disputeRate: '1.0%', completionRate: '98%', accepted: false, aiTop: false },
      { id: 'OF-1295-5', provider: 'بندر الشهري', providerAv: 'ب', providerBg: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', level: 'Silver · 4.2★', price: '850 $', priceValue: 850, duration: '5 أيام', projectsCount: 17, disputeRate: '3.9%', completionRate: '93%', accepted: false, aiTop: false },
      { id: 'OF-1295-6', provider: 'نجلاء الحارثي', providerAv: 'ن', providerBg: 'linear-gradient(135deg,#A56BE0,#FF8C69)', level: 'Gold · 4.4★', price: '1,100 $', priceValue: 1100, duration: '4 أيام', projectsCount: 29, disputeRate: '2.6%', completionRate: '94%', accepted: false, aiTop: false },
      { id: 'OF-1295-7', provider: 'تركي المطيري', providerAv: 'ت', providerBg: 'linear-gradient(135deg,#FF8C69,#FFB400)', level: 'Bronze · 3.9★', price: '700 $', priceValue: 700, duration: '6 أيام', projectsCount: 8, disputeRate: '7.2%', completionRate: '84%', accepted: false, aiTop: false },
      { id: 'OF-1295-8', provider: 'رغد الشمري', providerAv: 'ر', providerBg: 'linear-gradient(135deg,#5DA0FF,#A56BE0)', level: 'Silver · 4.3★', price: '990 $', priceValue: 990, duration: '4 أيام', projectsCount: 22, disputeRate: '3.1%', completionRate: '92%', accepted: false, aiTop: false },
      { id: 'OF-1295-9', provider: 'محتوى برو', providerAv: 'ح', providerBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', level: 'مقدم شركة · 4.6★', price: '1,400 $', priceValue: 1400, duration: '3 أيام', projectsCount: 51, disputeRate: '1.6%', completionRate: '96%', accepted: false, aiTop: false },
      { id: 'OF-1295-10', provider: 'أنس القرني', providerAv: 'أ', providerBg: 'linear-gradient(135deg,#FFB400,#FF8C69)', level: 'Gold · 4.5★', price: '1,020 $', priceValue: 1020, duration: '3 أيام', projectsCount: 31, disputeRate: '2.4%', completionRate: '95%', accepted: false, aiTop: false },
      { id: 'OF-1295-11', provider: 'جود العصيمي', providerAv: 'ج', providerBg: 'linear-gradient(135deg,#A56BE0,#2B7FFF)', level: 'Silver · 4.1★', price: '880 $', priceValue: 880, duration: '5 أيام', projectsCount: 13, disputeRate: '4.5%', completionRate: '90%', accepted: false, aiTop: false },
    ],
    activityLog: [
      { text: 'وردت 11 عرضاً من كتّاب محتوى مختلفين', date: '2026-09-06 — 2026-09-08', dotColor: '#5DA0FF' },
      { text: 'نُشر الطلب وفُحص تلقائياً بواسطة AI — النتيجة: نظيف', date: '2026-09-06', dotColor: '#2BD4C7' },
    ],
    clientStats: { id: 'USR-3390', type: 'طالب فرد', risk: 'low', pastProjects: 6, rating: 4.5, totalSpend: '9,800 $', memberSince: 'يونيو 2025' },
  },
  {
    id: 'RQ-1290', title: 'تصميم هوية بصرية كاملة', client: 'فهد العتيبي',
    clientAv: 'ف', clientBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)', spec: 'تصميم',
    budget: '8,500 $', offers: 3, date: '2026-09-05', status: 'in-progress', aiClean: true,
    description: 'تصميم هوية بصرية متكاملة تشمل الشعار ودليل الاستخدام.',
    requirements: ['شعار وشعار مصغر', 'دليل استخدام الهوية', 'قوالب سوشيال ميديا'],
    durationRange: '10-14 يوم',
    aiScore: 96,
    offersList: [
      { id: 'OF-1290-1', provider: 'ليان الرشيدي', providerAv: 'ل', providerBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)', level: 'Platinum · 4.9★', price: '8,200 $', priceValue: 8200, duration: '12 يوم', projectsCount: 47, disputeRate: '0.5%', completionRate: '99%', accepted: true, aiTop: true },
      { id: 'OF-1290-2', provider: 'استوديو أثر', providerAv: 'أ', providerBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', level: 'مقدم شركة · 4.7★', price: '9,600 $', priceValue: 9600, duration: '10 يوم', projectsCount: 55, disputeRate: '1.2%', completionRate: '97%', accepted: false, aiTop: false },
      { id: 'OF-1290-3', provider: 'يزيد القحطاني', providerAv: 'ي', providerBg: 'linear-gradient(135deg,#FFB400,#FF8C69)', level: 'Gold · 4.4★', price: '7,800 $', priceValue: 7800, duration: '15 يوم', projectsCount: 24, disputeRate: '3.0%', completionRate: '93%', accepted: false, aiTop: false },
    ],
    activityLog: [
      { text: 'وُقّعت الاتفاقية وبدأ تنفيذ المشروع مع ليان الرشيدي', date: '2026-09-06', dotColor: '#2BD4C7' },
      { text: 'قبل فهد العتيبي عرض ليان الرشيدي (8,200 $)', date: '2026-09-06', dotColor: '#A56BE0' },
      { text: 'وردت 3 عروض من مصممي هوية بصرية', date: '2026-09-05', dotColor: '#5DA0FF' },
      { text: 'نُشر الطلب وفُحص تلقائياً بواسطة AI — النتيجة: نظيف', date: '2026-09-05', dotColor: '#2BD4C7' },
    ],
    clientStats: { id: 'USR-2754', type: 'طالب فرد', risk: 'low', pastProjects: 9, rating: 4.7, totalSpend: '34,500 $', memberSince: 'أغسطس 2024' },
  },
  {
    id: 'RQ-1270', title: 'خدمات مشبوهة — محتوى مخالف', client: 'حساب مجهول',
    clientAv: '؟', clientBg: 'linear-gradient(135deg,#FF8C69,#FFB400)', spec: 'أخرى',
    budget: '500 $', offers: 0, date: '2026-09-03', status: 'flagged', aiClean: false,
    description: 'طلب رصدته منظومة AI باعتباره يحتوي على محتوى مخالف لسياسات المنصة.',
    requirements: ['قيد المراجعة اليدوية من فريق الالتزام'],
    durationRange: '—',
    aiScore: 22,
    offersList: [],
    activityLog: [
      { text: 'أُوقف الطلب تلقائياً ومُنع استقبال عروض جديدة', date: '2026-09-03', dotColor: '#FF8C69' },
      { text: 'رصدت منظومة AI محتوى مخالف لسياسات المنصة — إحالة لفريق الالتزام', date: '2026-09-03', dotColor: '#FF8C69' },
      { text: 'نُشر الطلب', date: '2026-09-03', dotColor: '#6B7699' },
    ],
    clientStats: { id: 'USR-9042', type: 'حساب غير موثّق', risk: 'high', pastProjects: 0, rating: 0, totalSpend: '0 $', memberSince: 'سبتمبر 2026' },
  },
  {
    id: 'RQ-1255', title: 'إعداد خطة أعمال استثمارية', client: 'شركة الأفق',
    clientAv: 'أ', clientBg: 'linear-gradient(135deg,#59C1F5,#2BD4C7)', spec: 'استشارات',
    budget: '9,000 $', offers: 3, date: '2026-08-30', status: 'completed', aiClean: true,
    description: 'إعداد خطة أعمال متكاملة لمشروع استثماري جديد في قطاع التقنية.',
    requirements: ['دراسة جدوى', 'خطة تسويقية', 'توقعات مالية 3 سنوات'],
    durationRange: '14 يوم',
    aiScore: 92,
    offersList: [
      { id: 'OF-1255-1', provider: 'عبدالرحمن الفارس', providerAv: 'ع', providerBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)', level: 'Platinum · 4.8★', price: '8,700 $', priceValue: 8700, duration: '14 يوم', projectsCount: 63, disputeRate: '0.8%', completionRate: '98%', accepted: true, aiTop: true },
      { id: 'OF-1255-2', provider: 'مكتب رؤية للاستشارات', providerAv: 'ر', providerBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', level: 'مقدم شركة · 4.6★', price: '9,900 $', priceValue: 9900, duration: '12 يوم', projectsCount: 40, disputeRate: '1.9%', completionRate: '95%', accepted: false, aiTop: false },
      { id: 'OF-1255-3', provider: 'سعود الحقباني', providerAv: 'س', providerBg: 'linear-gradient(135deg,#FFB400,#FF8C69)', level: 'Gold · 4.3★', price: '8,100 $', priceValue: 8100, duration: '16 يوم', projectsCount: 22, disputeRate: '3.3%', completionRate: '91%', accepted: false, aiTop: false },
    ],
    activityLog: [
      { text: 'أُفرج عن كامل المبلغ للمستشار بعد تسليم الخطة واعتمادها', date: '2026-09-13', dotColor: '#0FA99A' },
      { text: 'أُنجز الطلب وسلّمت خطة الأعمال النهائية', date: '2026-09-13', dotColor: '#0FA99A' },
      { text: 'وُقّع العقد وبدأ تنفيذ الاستشارة مع عبدالرحمن الفارس', date: '2026-08-31', dotColor: '#2BD4C7' },
      { text: 'قبلت شركة الأفق عرض عبدالرحمن الفارس (8,700 $)', date: '2026-08-31', dotColor: '#A56BE0' },
      { text: 'وردت 3 عروض من مستشارين معتمدين', date: '2026-08-30', dotColor: '#5DA0FF' },
      { text: 'نُشر الطلب وفُحص تلقائياً بواسطة AI — النتيجة: نظيف', date: '2026-08-30', dotColor: '#2BD4C7' },
    ],
    clientStats: { id: 'USR-1420', type: 'طالب شركة', risk: 'low', pastProjects: 27, rating: 4.6, totalSpend: '210,000 $', memberSince: 'فبراير 2022' },
  },
];
