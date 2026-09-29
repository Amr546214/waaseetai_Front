// Mock data for the super-admin reports (complaints) list + detail pages (no
// backend reports endpoint wired yet — shared by SaReports and SaReportDetail).

export type ReportType = 'fraud' | 'content' | 'behavior';
export type ReportStatus = 'new' | 'investigating' | 'dismissed' | 'actioned';
export type TabKey = 'all' | 'new' | 'investigating' | ReportType;
export type Priority = 'high' | 'medium' | 'low';

export interface Evidence {
  label: string;
  meta: string;
  note: string;
}

export type NetworkStatus = 'suspect' | 'watch' | 'clear';
export interface NetworkAccount {
  id: string;
  name: string;
  av: string;
  avBg: string;
  note: string;
  meta: string;
  status: NetworkStatus;
}

export type IpStatus = 'blocked' | 'normal' | 'shared';
export interface IpEntry {
  ip: string;
  location: string;
  device: string;
  status: IpStatus;
  statusLabel: string;
}

export type ChecklistState = 'done' | 'pending' | 'todo';
export interface ChecklistItem {
  label: string;
  state: ChecklistState;
}

export interface PriorReportEntry {
  id: string;
  reason: string;
  date: string;
  outcome: string;
  current?: boolean;
}

export interface ComplaintReport {
  id: string;
  type: ReportType;
  typeLabel: string;
  reporter: string;
  reporterAv: string;
  reporterBg: string;
  reported: string;
  reportedAv: string;
  reportedBg: string;
  desc: string;
  aiSuggestion: string;
  date: string;
  status: ReportStatus;
  priority: Priority;
  severity: 'خطورة عالية' | 'خطورة متوسطة' | 'خطورة منخفضة';
  aiRiskScore: number;
  disputedAmount: string;
  priorReports: number;
  evidence: Evidence[];
  linkedAccounts: NetworkAccount[];
  ipHistory: IpEntry[];
  checklist: ChecklistItem[];
  priorReportsList: PriorReportEntry[];
}

export const REPORTS: ComplaintReport[] = [
  {
    id: 'FR-098', type: 'fraud', typeLabel: 'احتيال', reporter: 'خالد المطيري', reporterAv: 'خ', reporterBg: 'linear-gradient(135deg,#5DA0FF,#2BD4C7)',
    reported: 'حساب مجهول', reportedAv: '؟', reportedBg: 'linear-gradient(135deg,#FF8C69,#FFB400)',
    desc: 'هذا الحساب يطلب الدفع خارج وسيط AI ويهدد بإلغاء العقد إذا رفضنا', aiSuggestion: 'تعليق فوري',
    date: '15 يوليو 2026', status: 'new', priority: 'high', severity: 'خطورة عالية', aiRiskScore: 87,
    disputedAmount: '8,400 ر.س', priorReports: 3,
    evidence: [
      { label: 'لقطة شاشة محادثة الاتفاق', meta: 'chat-screenshot.png · 1.2 MB', note: 'محادثة تثبت طلب الدفع خارج المنصة مقابل تخفيض العمولة' },
      { label: 'إيصال تحويل بنكي', meta: 'bank-receipt.pdf · 0.4 MB', note: 'إيصال تحويل من حساب المُبلِّغ إلى IBAN المُبلَّغ عنه' },
    ],
    linkedAccounts: [
      { id: 'U-00412', name: 'حساب مجهول (الحساب الرئيسي)', av: '؟', avBg: 'linear-gradient(135deg,#FF8C69,#FFB400)', note: 'موقوف مؤقتاً · 3 بلاغات ضده', meta: 'Risk: 87/100', status: 'suspect' },
      { id: 'U-08241', name: 'زياد المطيري — نفس الجهاز وIP', av: 'ز', avBg: 'linear-gradient(135deg,#A56BE0,#5DA0FF)', note: 'نفس IBAN المُبلَّغ عنه · مسجل منذ أسبوعين', meta: 'حساب نشط', status: 'suspect' },
      { id: 'U-09182', name: 'حساب رابع محتمل — يخضع للفحص', av: '؟', avBg: 'rgba(255,255,255,.1)', note: 'نفس النمط، ثقة AI 74%', meta: 'قيد التحليل', status: 'watch' },
    ],
    ipHistory: [
      { ip: '185.220.101.42', location: 'هولندا · VPN مشبوه', device: 'يُستخدم للتحايل على الحظر الجغرافي', status: 'blocked', statusLabel: 'محجوب' },
      { ip: '197.32.14.88', location: 'الرياض، المملكة · STC', device: 'آخر تسجيل دخول', status: 'normal', statusLabel: 'طبيعي' },
      { ip: '10.0.2.15', location: 'جدة، المملكة · موبايلي', device: 'Samsung Galaxy S23 · Device ID: 9A2F…', status: 'shared', statusLabel: 'مُشترك' },
    ],
    checklist: [
      { label: 'مراجعة الأدلة المرفوعة', state: 'done' },
      { label: 'فحص شبكة الحسابات المرتبطة', state: 'done' },
      { label: 'مطابقة IP والجهاز مع الحسابات الأخرى', state: 'pending' },
      { label: 'التواصل مع المُبلِّغ لتأكيد التفاصيل', state: 'todo' },
      { label: 'اتخاذ القرار النهائي وإغلاق البلاغ', state: 'todo' },
    ],
    priorReportsList: [
      { id: 'FR-061', reason: 'طلب دفع خارج المنصة', date: 'أبريل 2026', outcome: 'أُغلق بتحذير' },
      { id: 'FR-079', reason: 'عدم الرد على العميل لأكثر من أسبوع', date: 'مايو 2026', outcome: 'أُغلق دون إجراء' },
      { id: 'FR-088', reason: 'استخدام حساب بنكي غير موثّق', date: 'يونيو 2026', outcome: 'تحذير رسمي' },
      { id: 'FR-098', reason: 'طلب الدفع خارج وسيط AI والتهديد بإلغاء العقد', date: '15 يوليو 2026', outcome: 'قيد المراجعة', current: true },
    ],
  },
  {
    id: 'FR-097', type: 'behavior', typeLabel: 'مضايقة', reporter: 'سارة القحطاني', reporterAv: 'س', reporterBg: 'linear-gradient(135deg,#59C1F5,#5DA0FF)',
    reported: 'مستخدم غير موثق', reportedAv: 'م', reportedBg: 'linear-gradient(135deg,#FF8C69,#59C1F5)',
    desc: 'يرسل رسائل مسيئة ومضايقة خارج نطاق العمل بشكل متكرر', aiSuggestion: 'تحذير رسمي',
    date: '14 يوليو 2026', status: 'new', priority: 'medium', severity: 'خطورة متوسطة', aiRiskScore: 61,
    disputedAmount: '—', priorReports: 0,
    evidence: [{ label: 'لقطات شاشة رسائل', meta: 'messages.zip · 2.1 MB', note: '6 لقطات لرسائل مسيئة خارج نطاق العمل خلال أسبوع' }],
    linkedAccounts: [
      { id: 'U-05310', name: 'مستخدم غير موثق (الحساب الرئيسي)', av: 'م', avBg: 'linear-gradient(135deg,#FF8C69,#59C1F5)', note: 'حساب نشط · بلاغ واحد فقط', meta: 'Risk: 61/100', status: 'watch' },
    ],
    ipHistory: [
      { ip: '212.11.65.3', location: 'الدمام، المملكة · موبايلي', device: 'iPhone 14 · آخر تسجيل دخول', status: 'normal', statusLabel: 'طبيعي' },
    ],
    checklist: [
      { label: 'مراجعة الأدلة المرفوعة', state: 'done' },
      { label: 'فحص شبكة الحسابات المرتبطة', state: 'pending' },
      { label: 'التواصل مع المُبلَّغ عنه للرد', state: 'todo' },
      { label: 'اتخاذ القرار النهائي وإغلاق البلاغ', state: 'todo' },
    ],
    priorReportsList: [
      { id: 'FR-097', reason: 'يرسل رسائل مسيئة ومضايقة خارج نطاق العمل', date: '14 يوليو 2026', outcome: 'قيد المراجعة', current: true },
    ],
  },
  {
    id: 'FR-096', type: 'content', typeLabel: 'محتوى مخالف', reporter: 'محمد العمري', reporterAv: 'م', reporterBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
    reported: 'طلب #RQ-1270', reportedAv: 'ط', reportedBg: 'linear-gradient(135deg,#6B7699,#A8B2D1)',
    desc: 'الطلب يطلب خدمات تسويق مضلل وادعاءات كاذبة', aiSuggestion: 'رفض الطلب',
    date: '13 يوليو 2026', status: 'new', priority: 'medium', severity: 'خطورة متوسطة', aiRiskScore: 54,
    disputedAmount: '—', priorReports: 0,
    evidence: [{ label: 'نص الطلب المنشور', meta: 'request-RQ-1270.pdf · 0.2 MB', note: 'الطلب يتضمن ادعاءات نتائج مضمونة 100% خلال 24 ساعة' }],
    linkedAccounts: [
      { id: 'U-01187', name: 'طلب #RQ-1270 (صاحب الطلب)', av: 'ط', avBg: 'linear-gradient(135deg,#6B7699,#A8B2D1)', note: 'حساب نشط · لا بلاغات سابقة', meta: 'Risk: 54/100', status: 'watch' },
    ],
    ipHistory: [
      { ip: '5.194.22.90', location: 'جدة، المملكة · STC', device: 'Windows · متصفح Chrome', status: 'normal', statusLabel: 'طبيعي' },
    ],
    checklist: [
      { label: 'مراجعة نص الطلب المنشور', state: 'done' },
      { label: 'مطابقة الادعاءات مع سياسة المحتوى', state: 'pending' },
      { label: 'إشعار صاحب الطلب بالمخالفة إن ثبتت', state: 'todo' },
      { label: 'اتخاذ القرار النهائي وإغلاق البلاغ', state: 'todo' },
    ],
    priorReportsList: [
      { id: 'FR-096', reason: 'طلب يتضمن خدمات تسويق مضلل وادعاءات كاذبة', date: '13 يوليو 2026', outcome: 'قيد المراجعة', current: true },
    ],
  },
  {
    id: 'FR-094', type: 'fraud', typeLabel: 'تزوير', reporter: 'نورة السهلي', reporterAv: 'ن', reporterBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)',
    reported: 'أحمد م.', reportedAv: 'أ', reportedBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
    desc: 'يستخدم صور أعمال الآخرين في ملفه المهني دون إذن', aiSuggestion: 'تحذير رسمي',
    date: '12 يوليو 2026', status: 'investigating', priority: 'medium', severity: 'خطورة متوسطة', aiRiskScore: 68,
    disputedAmount: '—', priorReports: 1,
    evidence: [{ label: 'مقارنة الصور الأصلية', meta: 'comparison.pdf · 0.9 MB', note: 'تطابق 4 من 6 صور محفظة مع أعمال منشورة لمقدم آخر' }],
    linkedAccounts: [
      { id: 'U-03356', name: 'أحمد م. (الحساب الرئيسي)', av: 'أ', avBg: 'linear-gradient(135deg,#FFB400,#FF8C69)', note: 'حساب نشط · بلاغ سابق واحد', meta: 'Risk: 68/100', status: 'watch' },
      { id: 'U-03357', name: 'حساب باسم مستعار — بريد مشابه', av: '؟', avBg: 'rgba(255,255,255,.1)', note: 'أُنشئ بعد أسبوع من هذا البلاغ، لم يُفعَّل بعد', meta: 'قيد التحليل', status: 'watch' },
    ],
    ipHistory: [
      { ip: '41.65.9.203', location: 'مكة المكرمة، المملكة · موبايلي', device: 'Huawei P50 · آخر تسجيل دخول', status: 'normal', statusLabel: 'طبيعي' },
    ],
    checklist: [
      { label: 'مراجعة مقارنة الصور المرفوعة', state: 'done' },
      { label: 'التواصل مع صاحب الأعمال الأصلية للتأكيد', state: 'done' },
      { label: 'فحص الحساب الثانوي المرتبط بنفس البريد', state: 'pending' },
      { label: 'اتخاذ القرار النهائي وإغلاق البلاغ', state: 'todo' },
    ],
    priorReportsList: [
      { id: 'FR-070', reason: 'شكوى مشابهة حول ملكية صور المعرض', date: 'مايو 2026', outcome: 'أُغلق دون دليل كافٍ' },
      { id: 'FR-094', reason: 'استخدام صور أعمال الآخرين في الملف المهني دون إذن', date: '12 يوليو 2026', outcome: 'قيد التحقيق', current: true },
    ],
  },
  {
    id: 'FR-091', type: 'fraud', typeLabel: 'احتيال', reporter: 'شركة الخليج', reporterAv: 'خ', reporterBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
    reported: 'مقدم مجهول', reportedAv: 'م', reportedBg: 'linear-gradient(135deg,#FF8C69,#FFB400)',
    desc: 'قدّم عروضاً وتولى مشاريع ثم اختفى بعد استلام الضمان', aiSuggestion: 'تعليق فوري',
    date: '10 يوليو 2026', status: 'investigating', priority: 'high', severity: 'خطورة عالية', aiRiskScore: 91,
    disputedAmount: '12,000 ر.س', priorReports: 2,
    evidence: [
      { label: 'محادثة الاتفاق على المشروع', meta: 'chat-log.pdf · 1.4 MB', note: 'اتفاق موثق على تسليم المشروع خلال 10 أيام مقابل 12,000 ر.س' },
      { label: 'سجل عدم الاستجابة', meta: 'timeline.pdf · 0.3 MB', note: 'انقطع التواصل تماماً بعد استلام الدفعة المقدمة' },
    ],
    linkedAccounts: [
      { id: 'U-02298', name: 'مقدم مجهول (الحساب الرئيسي)', av: 'م', avBg: 'linear-gradient(135deg,#FF8C69,#FFB400)', note: 'موقوف مؤقتاً · بلاغان سابقان', meta: 'Risk: 91/100', status: 'suspect' },
      { id: 'U-02311', name: 'حساب جديد — نفس رقم الجوال', av: 'ح', avBg: 'linear-gradient(135deg,#FF6B6B,#A56BE0)', note: 'أُنشئ بعد يومين من اختفاء الحساب الرئيسي', meta: 'حساب نشط', status: 'suspect' },
    ],
    ipHistory: [
      { ip: '91.207.174.19', location: 'الإمارات · VPN مشبوه', device: 'يتغيّر باستمرار بين تسجيلات الدخول', status: 'blocked', statusLabel: 'محجوب' },
      { ip: '188.55.10.4', location: 'الرياض، المملكة · Zain', device: 'MacBook Pro · آخر تسجيل دخول قبل الاختفاء', status: 'normal', statusLabel: 'طبيعي' },
    ],
    checklist: [
      { label: 'مراجعة الأدلة المرفوعة', state: 'done' },
      { label: 'فحص شبكة الحسابات المرتبطة', state: 'done' },
      { label: 'تجميد الحساب الرئيسي', state: 'done' },
      { label: 'رصد الحساب الجديد المرتبط بنفس الجوال', state: 'pending' },
      { label: 'إعادة المبلغ المتنازع عليه للمُبلِّغ', state: 'todo' },
    ],
    priorReportsList: [
      { id: 'FR-058', reason: 'تأخر تسليم مشروع سابق دون تبرير', date: 'مارس 2026', outcome: 'تحذير رسمي' },
      { id: 'FR-075', reason: 'اختفاء بعد استلام دفعة مقدمة من عميل آخر', date: 'يونيو 2026', outcome: 'تعليق مؤقت' },
      { id: 'FR-091', reason: 'قدّم عروضاً وتولى مشاريع ثم اختفى بعد استلام الضمان', date: '10 يوليو 2026', outcome: 'قيد التحقيق', current: true },
    ],
  },
  {
    id: 'FR-082', type: 'content', typeLabel: 'محتوى مخالف', reporter: 'فهد العنزي', reporterAv: 'ف', reporterBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
    reported: 'ريان س.', reportedAv: 'ر', reportedBg: 'linear-gradient(135deg,#59C1F5,#FF8C69)',
    desc: 'نشر رابط خارجي مشبوه في وصف الخدمة المعروضة', aiSuggestion: 'رفض البلاغ',
    date: '2 يوليو 2026', status: 'dismissed', priority: 'low', severity: 'خطورة منخفضة', aiRiskScore: 22,
    disputedAmount: '—', priorReports: 0,
    evidence: [{ label: 'لقطة شاشة الوصف', meta: 'listing.png · 0.3 MB', note: 'الرابط تابع لمعرض أعمال شخصي موثوق — لا مخالفة' }],
    linkedAccounts: [
      { id: 'U-04471', name: 'ريان س. (صاحب الخدمة)', av: 'ر', avBg: 'linear-gradient(135deg,#59C1F5,#FF8C69)', note: 'حساب نشط · سجل نظيف', meta: 'Risk: 22/100', status: 'clear' },
    ],
    ipHistory: [
      { ip: '77.42.18.61', location: 'الرياض، المملكة · STC', device: 'iPad · آخر تسجيل دخول', status: 'normal', statusLabel: 'طبيعي' },
    ],
    checklist: [
      { label: 'مراجعة لقطة شاشة الوصف والرابط', state: 'done' },
      { label: 'التحقق من مصدر الرابط الخارجي', state: 'done' },
      { label: 'رفض البلاغ لعدم وجود مخالفة', state: 'done' },
    ],
    priorReportsList: [
      { id: 'FR-082', reason: 'نشر رابط خارجي مشبوه في وصف الخدمة المعروضة', date: '2 يوليو 2026', outcome: 'رُفض — لا مخالفة', current: true },
    ],
  },
  {
    id: 'FR-076', type: 'fraud', typeLabel: 'احتيال', reporter: 'ريم الحربي', reporterAv: 'ر', reporterBg: 'linear-gradient(135deg,#FFB400,#59C1F5)',
    reported: 'خالد ب.', reportedAv: 'خ', reportedBg: 'linear-gradient(135deg,#FF6B6B,#FFB400)',
    desc: 'انتحل صفة مدير حساب وسيط AI للتواصل وطلب بيانات دفع', aiSuggestion: 'تعليق فوري',
    date: '28 يونيو 2026', status: 'actioned', priority: 'high', severity: 'خطورة عالية', aiRiskScore: 95,
    disputedAmount: '—', priorReports: 4,
    evidence: [{ label: 'رسائل انتحال الصفة', meta: 'impersonation.png · 0.6 MB', note: 'رسائل تدّعي أنها من فريق الدعم الرسمي وتطلب رمز OTP' }],
    linkedAccounts: [
      { id: 'U-00187', name: 'خالد ب. (الحساب الرئيسي)', av: 'خ', avBg: 'linear-gradient(135deg,#FF6B6B,#FFB400)', note: 'تم تعليقه نهائياً · 4 بلاغات ضده', meta: 'Risk: 95/100', status: 'suspect' },
      { id: 'U-00201', name: 'حساب مطابق — نفس اسم العرض والصورة', av: 'خ', avBg: 'linear-gradient(135deg,#FF8C69,#A56BE0)', note: 'أُنشئ بعد التعليق مباشرة لمحاولة الالتفاف', meta: 'مُعلّق أيضاً', status: 'suspect' },
    ],
    ipHistory: [
      { ip: '141.98.11.77', location: 'روسيا · VPN مشبوه', device: 'يتغيّر باستمرار بين تسجيلات الدخول', status: 'blocked', statusLabel: 'محجوب' },
      { ip: '154.213.6.9', location: 'جدة، المملكة · موبايلي', device: 'Xiaomi Redmi Note 12', status: 'normal', statusLabel: 'طبيعي' },
    ],
    checklist: [
      { label: 'مراجعة رسائل انتحال الصفة', state: 'done' },
      { label: 'فحص شبكة الحسابات المرتبطة', state: 'done' },
      { label: 'تعليق الحساب الرئيسي والحساب البديل', state: 'done' },
      { label: 'إحالة الحادثة لفريق الأمن الرقمي', state: 'done' },
    ],
    priorReportsList: [
      { id: 'FR-032', reason: 'انتحال صفة موظف دعم في محادثة سابقة', date: 'يناير 2026', outcome: 'تحذير رسمي' },
      { id: 'FR-045', reason: 'طلب بيانات دفع عبر رسالة مشبوهة', date: 'مارس 2026', outcome: 'تعليق مؤقت 7 أيام' },
      { id: 'FR-063', reason: 'إنشاء حساب مطابق بعد رفع التعليق', date: 'مايو 2026', outcome: 'تعليق مؤقت 30 يوماً' },
      { id: 'FR-076', reason: 'انتحل صفة مدير حساب وسيط AI وطلب بيانات دفع', date: '28 يونيو 2026', outcome: 'تعليق نهائي', current: true },
    ],
  },
];
