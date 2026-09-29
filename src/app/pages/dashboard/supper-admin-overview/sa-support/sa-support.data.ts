// MOCK data for the super-admin support tickets list + ticket detail page.
// There is no support-tickets backend endpoint yet; both SaSupport (list) and
// SaSupportDetail (routed `support/:id` page) read from this shared array.

export type TicketStatus = 'open' | 'pending' | 'escalated' | 'resolved';

export interface TicketMessage {
  from: 'user' | 'admin';
  text: string;
  time: string;
}

export interface TicketNote {
  author: string;
  time: string;
  text: string;
}

export interface RelatedTicket {
  id: string;
  label: string;
  status: string;
}

export interface Ticket {
  id: string;
  subject: string;
  user: string;
  userId: string;
  userAv: string;
  userBg: string;
  userType: string;
  category: string;
  status: TicketStatus;
  priority: 'high' | 'medium' | 'low';
  time: string;
  openedAt: string;
  openSince: string;
  assignedAgent: string;
  responseHours: number;
  slaTargetHours: number;
  aiSuggestion: { issue: string; solution: string };
  messages: TicketMessage[];
  notes: TicketNote[];
  relatedTickets: RelatedTicket[];
}

export const SUPPORT_AGENTS: string[] = ['هيثم القرني', 'ريم الحربي', 'نورة العتيبي', 'خالد الدوسري', 'فهد العنزي'];

export const SUPPORT_TICKETS: Ticket[] = [
  {
    id: 'TK-2841', subject: 'لم يصلني المبلغ بعد إغلاق المشروع', user: 'محمد العمري', userId: 'USR-4821', userAv: 'م', userBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
    userType: 'مقدم فرد', category: 'الدفع والمالية', status: 'open', priority: 'high', time: 'قبل 2 ساعة',
    openedAt: '27 سبتمبر 2026 · 10:00 ص', openSince: '31 ساعة', assignedAgent: 'هيثم القرني', responseHours: 7, slaTargetHours: 4,
    aiSuggestion: {
      issue: 'المشكلة شائعة — المبلغ محجوز في الضمان (Escrow) لأن الطالب أغلق المشروع لكن لم يتم تأكيد الإفراج عن الدفعة تلقائياً.',
      solution: 'الحل المقترح: التحقق من حالة معاملة الضمان لمشروع PR-1285 من لوحة المالية، وتنفيذ إفراج يدوي عن المبلغ إذا اكتمل التسليم.',
    },
    messages: [
      { from: 'user', text: 'أكملت المشروع قبل يومين وأغلقه الطالب لكن لم يصلني أي مبلغ.', time: 'اليوم 10:00 ص' },
      { from: 'admin', text: 'نتحقق من ذلك الآن. هل يمكنك مشاركة رقم المشروع؟', time: 'اليوم 10:15 ص' },
      { from: 'user', text: 'رقم المشروع PR-1285.', time: 'اليوم 10:20 ص' },
    ],
    notes: [
      { author: 'هيثم القرني', time: '28 سبتمبر', text: 'تم التواصل مع فريق المالية للتحقق من حالة الضمان الخاص بـ PR-1285.' },
      { author: 'ريم الحربي', time: '28 سبتمبر', text: 'المستخدم لديه سجل تذاكر متكرر حول التأخر في الإفراج، يفضّل تسريع المعالجة.' },
    ],
    relatedTickets: [
      { id: 'TK-2779', label: 'نفس المستخدم · تأخر إفراج سابق', status: 'محلولة' },
      { id: 'TK-2830', label: 'نفس التصنيف · خطأ فاتورة', status: 'بانتظار رد' },
    ],
  },
  {
    id: 'TK-2838', subject: 'مشكلة في رفع ملف التسليم', user: 'سارة القحطاني', userId: 'USR-4790', userAv: 'س', userBg: 'linear-gradient(135deg,#59C1F5,#5DA0FF)',
    userType: 'مقدم فرد', category: 'التقنية', status: 'open', priority: 'medium', time: 'قبل 4 ساعات',
    openedAt: '29 سبتمبر 2026 · 8:30 ص', openSince: '4 ساعات', assignedAgent: 'فهد العنزي', responseHours: 3, slaTargetHours: 6,
    aiSuggestion: {
      issue: 'رسالة الخطأ تشير إلى أن حجم ملف PSD تجاوز الحد الأقصى المسموح به لرفع ملفات التسليم (25MB).',
      solution: 'الحل المقترح: توجيه المستخدمة لضغط الملف أو رفعه عبر رابط تخزين سحابي مؤقت، مع تحديث حد الرفع في الإعدادات إن تكرر الأمر.',
    },
    messages: [{ from: 'user', text: 'عندما أحاول رفع ملف PSD تظهر رسالة خطأ ولا يكتمل الرفع.', time: 'اليوم 8:30 ص' }],
    notes: [
      { author: 'فهد العنزي', time: '29 سبتمبر', text: 'طلبت من المستخدمة إرسال لقطة شاشة لرسالة الخطأ لتأكيد السبب.' },
    ],
    relatedTickets: [
      { id: 'TK-2790', label: 'نفس التصنيف · خطأ رفع ملفات', status: 'محلولة' },
    ],
  },
  {
    id: 'TK-2835', subject: 'الطالب لا يستجيب منذ أسبوع', user: 'أحمد الزهراني', userId: 'USR-4712', userAv: 'أ', userBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
    userType: 'مقدم فرد', category: 'العقود', status: 'escalated', priority: 'high', time: 'قبل يوم',
    openedAt: '26 سبتمبر 2026 · 3:00 م', openSince: '55 ساعة', assignedAgent: 'ريم الحربي', responseHours: 10, slaTargetHours: 4,
    aiSuggestion: {
      issue: 'حالة تكرر معها عدم استجابة الطرف الآخر بعد توقيع العقد — قد تحتاج إلى تدخل إداري لإنهاء النزاع.',
      solution: 'الحل المقترح: تفعيل بروتوكول النزاعات (Dispute) رسمياً وإخطار الطالب عبر جميع القنوات المتاحة قبل التصعيد النهائي.',
    },
    messages: [
      { from: 'user', text: 'وقّعت العقد منذ أسبوع والطالب لا يرد على الرسائل ولا يُفرِج عن الضمان.', time: 'أمس 3:00 م' },
      { from: 'admin', text: 'سنراجع الحالة وسنتواصل مع الطالب مباشرة.', time: 'أمس 4:00 م' },
    ],
    notes: [
      { author: 'ريم الحربي', time: '28 سبتمبر', text: 'المستخدم يصر على رفع الموضوع لمدير أعلى، جرى تصعيد الحالة.' },
      { author: 'هيثم القرني', time: '27 سبتمبر', text: 'جرّبنا التواصل الهاتفي مع الطالب، لم يتم الرد.' },
    ],
    relatedTickets: [
      { id: 'TK-2801', label: 'نفس المستخدم · نزاع سابق', status: 'محلولة' },
    ],
  },
  {
    id: 'TK-2830', subject: 'خطأ في فاتورة الاشتراك', user: 'شركة الخليج التقنية', userId: 'USR-4655', userAv: 'خ', userBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
    userType: 'طالب شركة', category: 'الدفع والمالية', status: 'pending', priority: 'low', time: 'قبل يومين',
    openedAt: '25 سبتمبر 2026 · 9:00 ص', openSince: '3 أيام', assignedAgent: 'نورة العتيبي', responseHours: 5, slaTargetHours: 12,
    aiSuggestion: {
      issue: 'الفرق في المبلغ ناتج عن احتساب ضريبة القيمة المضافة إضافة لرسوم ترقية الباقة منتصف الشهر.',
      solution: 'الحل المقترح: إرسال كشف تفصيلي للفاتورة يوضح بند الترقية والضريبة منفصلين لتوضيح الفرق للعميل.',
    },
    messages: [{ from: 'user', text: 'الفاتورة الشهرية أكبر من المبلغ المتفق عليه عند الاشتراك.', time: '2 يوليو 2026' }],
    notes: [
      { author: 'نورة العتيبي', time: '27 سبتمبر', text: 'تم إعداد كشف تفصيلي للفاتورة بانتظار مراجعة فريق المالية قبل الإرسال.' },
    ],
    relatedTickets: [
      { id: 'TK-2841', label: 'نفس التصنيف · تأخر إفراج مبلغ', status: 'مفتوحة' },
    ],
  },
  {
    id: 'TK-2825', subject: 'لا أستطيع الدخول لحسابي', user: 'نواف الحربي', userId: 'USR-4590', userAv: 'ن', userBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
    userType: 'طالب فرد', category: 'الحسابات', status: 'open', priority: 'medium', time: 'قبل 3 أيام',
    openedAt: '12 يوليو 2026 · 11:00 ص', openSince: '3 أيام', assignedAgent: 'خالد الدوسري', responseHours: 2, slaTargetHours: 6,
    aiSuggestion: {
      issue: 'محاولات الدخول المتكررة الفاشلة أدت على الأرجح إلى قفل مؤقت للحساب لأسباب أمنية.',
      solution: 'الحل المقترح: إرسال رابط إعادة تعيين كلمة المرور والتحقق من رقم الجوال المسجل لإلغاء القفل المؤقت.',
    },
    messages: [{ from: 'user', text: 'حاولت تسجيل الدخول بالبريد والرقم السري لكن يقول بيانات غير صحيحة.', time: '12 يوليو 2026' }],
    notes: [
      { author: 'خالد الدوسري', time: '12 يوليو', text: 'تحققت من سجل الدخول، هناك 6 محاولات فاشلة أدت لقفل مؤقت.' },
    ],
    relatedTickets: [],
  },
  {
    id: 'TK-2810', subject: 'استفسار عن رسوم العمولة', user: 'ريم البلوي', userId: 'USR-4433', userAv: 'ر', userBg: 'linear-gradient(135deg,#FFB400,#59C1F5)',
    userType: 'مقدم فرد', category: 'أخرى', status: 'resolved', priority: 'low', time: 'قبل أسبوع',
    openedAt: '5 يوليو 2026 · 1:00 م', openSince: 'مغلقة', assignedAgent: 'هيثم القرني', responseHours: 1, slaTargetHours: 12,
    aiSuggestion: {
      issue: 'استفسار معلوماتي عام حول نسبة عمولة المنصة، لا يتطلب تدخلاً تقنياً.',
      solution: 'الحل المقترح: الرد المباشر بنسبة العمولة الحالية وإرفاق رابط صفحة الباقات والرسوم لمزيد من التفاصيل.',
    },
    messages: [
      { from: 'user', text: 'ما هي نسبة عمولة المنصة على المشاريع؟', time: '5 يوليو 2026' },
      { from: 'admin', text: 'العمولة 10% من قيمة المشروع، وتقل مع ارتفاع مستوى العضوية.', time: '5 يوليو 2026' },
    ],
    notes: [],
    relatedTickets: [],
  },
];
