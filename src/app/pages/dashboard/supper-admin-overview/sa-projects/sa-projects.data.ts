// Mock data for the super-admin projects list + detail pages (no backend
// projects endpoint wired yet — shared by SaProjects and SaProjectDetail).

export type ProjectStatus = 'active' | 'review' | 'late' | 'completed' | 'cancelled';
export type FilterKey = 'all' | ProjectStatus;
export type RiskLevel = 'low' | 'medium' | 'high';
export type DeliverableStatus = 'accepted' | 'pending' | 'rejected';
export type DeliverableIcon = 'doc' | 'image' | 'link';
export type ChatRole = 'client' | 'provider' | 'admin';
export type DeliverableFilter = 'all' | DeliverableStatus;

export interface Milestone {
  name: string;
  state: 'done' | 'active' | 'late' | 'pending';
  progress: number;
}

export interface Deliverable {
  name: string;
  meta: string;
  status: DeliverableStatus;
  icon: DeliverableIcon;
}

export interface ChatMessage {
  sender: string;
  role: ChatRole;
  text: string;
  time: string;
}

export interface GanttPhase {
  name: string;
  state: 'done' | 'active' | 'late' | 'pending';
  startPct: number;
  widthPct: number;
}

export interface ActivityEvent {
  text: string;
  time: string;
  color: string;
}

export interface PartyProfile {
  name: string;
  role: string;
  avatar: string;
  bg: string;
  userId: string;
  projectsCount: number;
  risk: RiskLevel;
  rating: number;
}

export interface LinkedEntity {
  kind: 'contract' | 'request' | 'offer' | 'dispute';
  label: string;
  refId: string;
  status: string;
  route: string;
}

export interface Project {
  id: string;
  title: string;
  client: string;
  cAv: string;
  cBg: string;
  provider: string;
  pAv: string;
  pBg: string;
  value: string;
  escrowTotal: number;
  escrowReleased: number;
  spec: string;
  progress: number;
  deadline: string;
  startDate: string;
  contractType: string;
  status: ProjectStatus;
  risk: RiskLevel;
  milestones: Milestone[];
  aiNote: string;
  deliverables: Deliverable[];
  commLog: ChatMessage[];
  commStale: boolean;
  commStaleNote: string;
  gantt: GanttPhase[];
  activityLog: ActivityEvent[];
  clientParty: PartyProfile;
  providerParty: PartyProfile;
  linkedEntities: LinkedEntity[];
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'جارٍ',
  review: 'مراجعة التسليم',
  late: 'متأخر',
  completed: 'مكتمل',
  cancelled: 'ملغى',
};

export const PROJECT_STATUS_CLASSES: Record<ProjectStatus, string> = {
  active: 'pj-st-active',
  review: 'pj-st-review',
  late: 'pj-st-late',
  completed: 'pj-st-completed',
  cancelled: 'pj-st-cancelled',
};

export const PROJECT_RISK_LABELS: Record<RiskLevel, string> = { low: 'منخفض', medium: 'متوسط', high: 'عالٍ' };
export const PROJECT_RISK_CLASSES: Record<RiskLevel, string> = { low: 'pj-risk-low', medium: 'pj-risk-med', high: 'pj-risk-high' };

export const PROJECTS: Project[] = [
  {
    id: 'PR-1301', title: 'تصميم بنرات إعلانية × 10', client: 'شركة الخليج التقنية', cAv: 'خ', cBg: 'linear-gradient(135deg,#FFB400,#FF8C69)',
    provider: 'سارة القحطاني', pAv: 'س', pBg: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', value: '3,200 ر.س',
    escrowTotal: 3200, escrowReleased: 1280, spec: 'تصميم', progress: 40, deadline: '2026-09-20', startDate: '2026-09-01',
    contractType: 'نتائج محددة', status: 'active', risk: 'low',
    milestones: [
      { name: 'التصميم الأولي', state: 'done', progress: 100 },
      { name: 'مراجعة العميل', state: 'active', progress: 60 },
      { name: 'التسليم النهائي', state: 'pending', progress: 0 },
    ],
    aiNote: 'المشروع يسير وفق الجدول الزمني — لا مؤشرات خطر.',
    deliverables: [
      { name: 'بنرات-فيسبوك-إنستغرام-v1.zip', meta: 'رُفع: 5 سبتمبر 2026 · 12.4 MB · التصميم الأولي', status: 'accepted', icon: 'doc' },
      { name: 'موك-أب-عرض-تقديمي.pdf', meta: 'رُفع: 7 سبتمبر 2026 · 3.1 MB · التصميم الأولي', status: 'accepted', icon: 'doc' },
      { name: 'بنرات-جوجل-ادز-تعديل.zip', meta: 'رُفع: 14 سبتمبر 2026 · 9.8 MB · مراجعة العميل', status: 'pending', icon: 'image' },
      { name: 'رابط: معاينة كانفا للتصاميم', meta: 'رُفع: 15 سبتمبر 2026 · رابط مباشر · مراجعة العميل', status: 'pending', icon: 'link' },
    ],
    commLog: [
      { sender: 'شركة الخليج التقنية (طالب)', role: 'client', text: 'هل يمكن تعديل ألوان البنر الثالث ليتماشى مع هويتنا البصرية؟', time: '12 سبتمبر — 09:40 ص' },
      { sender: 'سارة القحطاني (مقدمة الخدمة)', role: 'provider', text: 'بالتأكيد، سأرسل نسخة معدلة اليوم بعد الظهر.', time: '12 سبتمبر — 10:05 ص' },
      { sender: 'شركة الخليج التقنية', role: 'client', text: 'تم الاستلام والموافقة، بانتظار بقية البنرات.', time: '14 سبتمبر — 01:20 م' },
      { sender: '', role: 'admin', text: '← إشعار إداري — تم رفع 4 من أصل 10 بنرات حتى الآن →', time: '15 سبتمبر' },
    ],
    commStale: false,
    commStaleNote: '',
    gantt: [
      { name: 'التصميم الأولي', state: 'done', startPct: 0, widthPct: 30 },
      { name: 'مراجعة العميل', state: 'active', startPct: 30, widthPct: 35 },
      { name: 'التسليم النهائي', state: 'pending', startPct: 65, widthPct: 35 },
    ],
    activityLog: [
      { text: 'رفعت سارة القحطاني نسخة معدلة من البنر الثالث بعد ملاحظات العميل', time: 'اليوم، 15 سبتمبر 2026', color: '#2BD4C7' },
      { text: 'طلبت شركة الخليج التقنية تعديل ألوان البنر الثالث', time: '12 سبتمبر 2026، 09:40 ص', color: '#FFB400' },
      { text: 'أُفرج عن دفعة أولى 1,280 ر.س بعد قبول التصميم الأولي', time: '8 سبتمبر 2026، 11:00 ص', color: '#0FA99A' },
      { text: 'قبلت شركة الخليج التقنية تسليمات المرحلة الأولى', time: '7 سبتمبر 2026، 04:10 م', color: '#0FA99A' },
      { text: 'بدأ المشروع رسمياً بعد توقيع العقد CO-1301 وإيداع الضمان الكامل', time: '1 سبتمبر 2026، 10:00 ص', color: '#A56BE0' },
    ],
    clientParty: { name: 'شركة الخليج التقنية', role: 'طالب الخدمة · شركة', avatar: 'خ', bg: 'linear-gradient(135deg,#FFB400,#FF8C69)', userId: 'USR-2101', projectsCount: 23, risk: 'low', rating: 4.3 },
    providerParty: { name: 'سارة القحطاني', role: 'مقدمة الخدمة · فرد · Gold', avatar: 'س', bg: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', userId: 'USR-3087', projectsCount: 34, risk: 'low', rating: 4.8 },
    linkedEntities: [
      { kind: 'contract', label: 'عقد المشروع', refId: 'CO-1301 · نشط', status: 'نشط', route: '/supper-admin-overview/contracts' },
      { kind: 'request', label: 'الطلب الأصلي', refId: 'RQ-1301 · مكتمل', status: 'مكتمل', route: '/supper-admin-overview/requests' },
      { kind: 'offer', label: 'العرض المقبول', refId: 'OF-4812 · 3,200 ر.س', status: 'مقبول', route: '/supper-admin-overview/offers' },
    ],
  },
  {
    id: 'PR-1298', title: 'تطوير تطبيق iOS لمتجر', client: 'مؤسسة النور', cAv: 'ن', cBg: 'linear-gradient(135deg,#2BD4C7,#0FA99A)',
    provider: 'هيثم القرني', pAv: 'هـ', pBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', value: '28,000 ر.س',
    escrowTotal: 28000, escrowReleased: 11200, spec: 'برمجة', progress: 65, deadline: '2026-10-15', startDate: '2026-08-10',
    contractType: 'نتائج محددة على مراحل', status: 'active', risk: 'low',
    milestones: [
      { name: 'التحليل والتخطيط', state: 'done', progress: 100 },
      { name: 'واجهة المستخدم', state: 'done', progress: 100 },
      { name: 'الربط بالخلفية', state: 'active', progress: 55 },
      { name: 'الاختبار والتسليم', state: 'pending', progress: 0 },
    ],
    aiNote: 'وتيرة العمل ثابتة — تسليم متوقع في الموعد.',
    deliverables: [
      { name: 'وثيقة-متطلبات-التطبيق-v1.pdf', meta: 'رُفع: 15 أغسطس 2026 · 1.8 MB · التحليل والتخطيط', status: 'accepted', icon: 'doc' },
      { name: 'واجهات-Figma-تطبيق-iOS.zip', meta: 'رُفع: 28 أغسطس 2026 · 38.2 MB · واجهة المستخدم', status: 'accepted', icon: 'image' },
      { name: 'رابط: نسخة TestFlight تجريبية', meta: 'رُفع: 10 سبتمبر 2026 · رابط مباشر · الربط بالخلفية', status: 'accepted', icon: 'link' },
      { name: 'شاشات-الدفع-والمخزون.zip', meta: 'رُفع: 18 سبتمبر 2026 · 22.4 MB · الربط بالخلفية', status: 'pending', icon: 'doc' },
    ],
    commLog: [
      { sender: 'مؤسسة النور (طالب)', role: 'client', text: 'التطبيق التجريبي يعمل بشكل ممتاز، هل يمكن إضافة دعم Apple Pay؟', time: '16 سبتمبر — 11:00 ص' },
      { sender: 'هيثم القرني (مقدم الخدمة)', role: 'provider', text: 'نعم، سأضيفها ضمن مرحلة الربط بالخلفية الحالية دون تكلفة إضافية.', time: '16 سبتمبر — 01:30 م' },
      { sender: 'مؤسسة النور', role: 'client', text: 'ممتاز، شكراً لسرعة الاستجابة.', time: '16 سبتمبر — 02:00 م' },
    ],
    commStale: false,
    commStaleNote: '',
    gantt: [
      { name: 'التحليل والتخطيط', state: 'done', startPct: 0, widthPct: 20 },
      { name: 'واجهة المستخدم', state: 'done', startPct: 20, widthPct: 25 },
      { name: 'الربط بالخلفية', state: 'active', startPct: 45, widthPct: 30 },
      { name: 'الاختبار والتسليم', state: 'pending', startPct: 75, widthPct: 25 },
    ],
    activityLog: [
      { text: 'رفع هيثم القرني نسخة TestFlight تجريبية للاختبار', time: 'قبل 3 أيام', color: '#2BD4C7' },
      { text: 'وافقت مؤسسة النور على إضافة دعم Apple Pay ضمن النطاق الحالي', time: '16 سبتمبر 2026، 02:00 م', color: '#5DA0FF' },
      { text: 'أُفرج عن دفعة ثانية 5,600 ر.س بعد قبول واجهات المستخدم', time: '29 أغسطس 2026، 10:15 ص', color: '#0FA99A' },
      { text: 'قبلت مؤسسة النور تسليمات مرحلة التحليل والتخطيط', time: '16 أغسطس 2026، 09:00 ص', color: '#0FA99A' },
      { text: 'بدأ المشروع رسمياً بعد توقيع العقد CO-1298', time: '10 أغسطس 2026، 10:00 ص', color: '#A56BE0' },
    ],
    clientParty: { name: 'مؤسسة النور', role: 'طالب الخدمة · مؤسسة', avatar: 'ن', bg: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', userId: 'USR-2077', projectsCount: 12, risk: 'low', rating: 4.5 },
    providerParty: { name: 'هيثم القرني', role: 'مقدم الخدمة · فرد · Platinum', avatar: 'هـ', bg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', userId: 'USR-3054', projectsCount: 51, risk: 'low', rating: 4.9 },
    linkedEntities: [
      { kind: 'contract', label: 'عقد المشروع', refId: 'CO-1298 · نشط', status: 'نشط', route: '/supper-admin-overview/contracts' },
      { kind: 'request', label: 'الطلب الأصلي', refId: 'RQ-1298 · مكتمل', status: 'مكتمل', route: '/supper-admin-overview/requests' },
      { kind: 'offer', label: 'العرض المقبول', refId: 'OF-4790 · 28,000 ر.س', status: 'مقبول', route: '/supper-admin-overview/offers' },
    ],
  },
  {
    id: 'PR-1290', title: 'تصميم هوية بصرية كاملة', client: 'فهد العتيبي', cAv: 'ف', cBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
    provider: 'أحمد الزهراني', pAv: 'أ', pBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)', value: '8,500 ر.س',
    escrowTotal: 8500, escrowReleased: 1700, spec: 'تصميم', progress: 30, deadline: '2026-09-14', startDate: '2026-08-20',
    contractType: 'نتائج محددة', status: 'late', risk: 'high',
    milestones: [
      { name: 'تحليل المتطلبات', state: 'done', progress: 100 },
      { name: 'تصميم الشعار', state: 'late', progress: 40 },
      { name: 'دليل الاستخدام', state: 'pending', progress: 0 },
    ],
    aiNote: 'المشروع متأخر 3 أيام — لا تراسل بين الطرفين منذ 48 ساعة، مؤشر خطر على توقف العمل.',
    deliverables: [
      { name: 'تحليل-المتطلبات-والمرجعيات.pdf', meta: 'رُفع: 25 أغسطس 2026 · 2.1 MB · تحليل المتطلبات', status: 'accepted', icon: 'doc' },
      { name: 'شعار-تجريبي-نسخة-1.zip', meta: 'رُفع: 5 سبتمبر 2026 · 6.4 MB · تصميم الشعار — سبب الرفض: الألوان لا تطابق الهوية المطلوبة', status: 'rejected', icon: 'image' },
      { name: 'شعار-تجريبي-نسخة-2.zip', meta: 'رُفع: 13 سبتمبر 2026 · 7.0 MB · تصميم الشعار', status: 'pending', icon: 'image' },
    ],
    commLog: [
      { sender: 'فهد العتيبي (طالب)', role: 'client', text: 'الشعار الأول لا يعكس الهوية التي اتفقنا عليها، الألوان مختلفة تماماً.', time: '5 سبتمبر — 03:00 م' },
      { sender: 'أحمد الزهراني (مقدم الخدمة)', role: 'provider', text: 'أعتذر عن ذلك، سأعيد التصميم وفق لوحة الألوان المرسلة.', time: '6 سبتمبر — 09:00 ص' },
      { sender: '', role: 'admin', text: '← إشعار إداري — لا يوجد رد من مقدم الخدمة منذ 48 ساعة →', time: '15 سبتمبر' },
    ],
    commStale: true,
    commStaleNote: 'آخر رسالة قبل 48 ساعة — يُنصح بإشعار الطرفين لمتابعة المشروع',
    gantt: [
      { name: 'تحليل المتطلبات', state: 'done', startPct: 0, widthPct: 25 },
      { name: 'تصميم الشعار', state: 'late', startPct: 25, widthPct: 30 },
      { name: 'دليل الاستخدام', state: 'pending', startPct: 55, widthPct: 30 },
    ],
    activityLog: [
      { text: 'تجاوز المشروع الموعد المخطط لمرحلة تصميم الشعار بـ 3 أيام', time: 'اليوم، 20 سبتمبر 2026', color: '#FF8C69' },
      { text: 'رفع أحمد الزهراني نسخة ثانية من الشعار بعد الرفض', time: '13 سبتمبر 2026، 10:00 ص', color: '#2BD4C7' },
      { text: 'رفض فهد العتيبي النسخة الأولى من الشعار', time: '5 سبتمبر 2026، 03:00 م', color: '#FF6B6B' },
      { text: 'رفع أحمد الزهراني النسخة الأولى من الشعار', time: '5 سبتمبر 2026، 11:00 ص', color: '#FFB400' },
      { text: 'بدأ المشروع رسمياً بعد توقيع العقد CO-1247', time: '20 أغسطس 2026، 10:00 ص', color: '#A56BE0' },
    ],
    clientParty: { name: 'فهد العتيبي', role: 'طالب الخدمة · فرد', avatar: 'ف', bg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)', userId: 'USR-2143', projectsCount: 7, risk: 'medium', rating: 3.8 },
    providerParty: { name: 'أحمد الزهراني', role: 'مقدم الخدمة · فرد · Silver', avatar: 'أ', bg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)', userId: 'USR-3021', projectsCount: 19, risk: 'high', rating: 3.6 },
    linkedEntities: [
      { kind: 'contract', label: 'عقد المشروع', refId: 'CO-1247 · نشط', status: 'نشط', route: '/supper-admin-overview/contracts' },
      { kind: 'request', label: 'الطلب الأصلي', refId: 'RQ-1290 · مكتمل', status: 'مكتمل', route: '/supper-admin-overview/requests' },
      { kind: 'offer', label: 'العرض المقبول', refId: 'OF-4776 · 8,500 ر.س', status: 'مقبول', route: '/supper-admin-overview/offers' },
    ],
  },
  {
    id: 'PR-1285', title: 'استشارة قانونية عقد تجاري', client: 'ريم الحربي', cAv: 'ر', cBg: 'linear-gradient(135deg,#FFB400,#59C1F5)',
    provider: 'خالد المالكي', pAv: 'خ', pBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', value: '2,000 ر.س',
    escrowTotal: 2000, escrowReleased: 2000, spec: 'استشارات', progress: 100, deadline: '2026-09-05', startDate: '2026-08-25',
    contractType: 'استشارة بالساعة', status: 'completed', risk: 'low',
    milestones: [
      { name: 'مراجعة العقد', state: 'done', progress: 100 },
      { name: 'تسليم التقرير النهائي', state: 'done', progress: 100 },
    ],
    aiNote: 'اكتمل المشروع بنجاح ضمن الجدول الزمني.',
    deliverables: [
      { name: 'مراجعة-العقد-التجاري-ملاحظات.pdf', meta: 'رُفع: 27 أغسطس 2026 · 1.2 MB · مراجعة العقد', status: 'accepted', icon: 'doc' },
      { name: 'التقرير-القانوني-النهائي.pdf', meta: 'رُفع: 4 سبتمبر 2026 · 2.6 MB · تسليم التقرير النهائي', status: 'accepted', icon: 'doc' },
    ],
    commLog: [
      { sender: 'ريم الحربي (طالب)', role: 'client', text: 'شكراً على التقرير الشامل، تمت تغطية جميع النقاط المطلوبة.', time: '4 سبتمبر — 05:00 م' },
      { sender: 'خالد المالكي (مقدم الخدمة)', role: 'provider', text: 'يسعدني ذلك، بالتوفيق في التعاقد.', time: '4 سبتمبر — 05:20 م' },
      { sender: '', role: 'admin', text: '← إشعار إداري — تم إغلاق المشروع بعد تسليم واستلام كامل الدفعات →', time: '5 سبتمبر' },
    ],
    commStale: false,
    commStaleNote: '',
    gantt: [
      { name: 'مراجعة العقد', state: 'done', startPct: 0, widthPct: 45 },
      { name: 'تسليم التقرير النهائي', state: 'done', startPct: 45, widthPct: 55 },
    ],
    activityLog: [
      { text: 'اكتمل المشروع بنجاح وتم إغلاقه', time: '5 سبتمبر 2026، 09:00 ص', color: '#0FA99A' },
      { text: 'أُفرج عن كامل الضمان 2,000 ر.س بعد قبول التقرير النهائي', time: '4 سبتمبر 2026، 05:30 م', color: '#0FA99A' },
      { text: 'قبلت ريم الحربي التقرير القانوني النهائي', time: '4 سبتمبر 2026، 05:00 م', color: '#0FA99A' },
      { text: 'بدأ المشروع رسمياً بعد توقيع العقد CO-1285', time: '25 أغسطس 2026، 10:00 ص', color: '#A56BE0' },
    ],
    clientParty: { name: 'ريم الحربي', role: 'طالبة الخدمة · فرد', avatar: 'ر', bg: 'linear-gradient(135deg,#FFB400,#59C1F5)', userId: 'USR-2199', projectsCount: 5, risk: 'low', rating: 4.6 },
    providerParty: { name: 'خالد المالكي', role: 'مقدم الخدمة · فرد · Gold', avatar: 'خ', bg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', userId: 'USR-3066', projectsCount: 27, risk: 'low', rating: 4.7 },
    linkedEntities: [
      { kind: 'contract', label: 'عقد المشروع', refId: 'CO-1285 · مكتمل', status: 'مكتمل', route: '/supper-admin-overview/contracts' },
      { kind: 'request', label: 'الطلب الأصلي', refId: 'RQ-1284 · مكتمل', status: 'مكتمل', route: '/supper-admin-overview/requests' },
      { kind: 'offer', label: 'العرض المقبول', refId: 'OF-4795 · 2,000 ر.س', status: 'مقبول', route: '/supper-admin-overview/offers' },
    ],
  },
  {
    id: 'PR-1277', title: 'واجهة تطبيق UX/UI', client: 'خالد المطيري', cAv: 'خ', cBg: 'linear-gradient(135deg,#5DA0FF,#2BD4C7)',
    provider: 'سعد الغامدي', pAv: 'س', pBg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)', value: '12,000 ر.س',
    escrowTotal: 12000, escrowReleased: 1200, spec: 'تصميم', progress: 10, deadline: '2026-09-12', startDate: '2026-08-28',
    contractType: 'نتائج محددة', status: 'late', risk: 'high',
    milestones: [
      { name: 'استكشاف احتياجات المستخدم', state: 'late', progress: 30 },
      { name: 'نماذج أولية', state: 'pending', progress: 0 },
      { name: 'تسليم نهائي', state: 'pending', progress: 0 },
    ],
    aiNote: 'تقدم بطيء جداً منذ بدء المشروع — يُنصح بالتواصل الفوري مع المقدم.',
    deliverables: [
      { name: 'ملخص-أبحاث-المستخدمين.pdf', meta: 'رُفع: 1 سبتمبر 2026 · 1.5 MB · استكشاف احتياجات المستخدم', status: 'accepted', icon: 'doc' },
      { name: 'نماذج-أولية-شاشة-تسجيل-دخول.fig', meta: 'رُفع: 10 سبتمبر 2026 · رابط Figma · نماذج أولية — سبب الرفض: لا تعكس متطلبات البراند', status: 'rejected', icon: 'link' },
    ],
    commLog: [
      { sender: 'خالد المطيري (طالب)', role: 'client', text: 'لم يصلني أي تحديث منذ أسبوعين، ما هو سبب التأخير؟', time: '18 سبتمبر — 10:00 ص' },
      { sender: '', role: 'admin', text: '← إشعار إداري — تم إرسال تذكير لمقدم الخدمة، لا رد حتى الآن →', time: '20 سبتمبر' },
    ],
    commStale: true,
    commStaleNote: 'لا يوجد تراسل من مقدم الخدمة منذ أكثر من 5 أيام — مؤشر خطر مرتفع على توقف العمل',
    gantt: [
      { name: 'استكشاف احتياجات المستخدم', state: 'late', startPct: 0, widthPct: 30 },
      { name: 'نماذج أولية', state: 'pending', startPct: 30, widthPct: 30 },
      { name: 'تسليم نهائي', state: 'pending', startPct: 60, widthPct: 40 },
    ],
    activityLog: [
      { text: 'تم تصعيد المشروع تلقائياً لمراجعة فريق النزاعات بسبب التوقف الممتد', time: 'اليوم، 20 سبتمبر 2026', color: '#FF6B6B' },
      { text: 'أرسل فريق الدعم تذكيراً لسعد الغامدي دون رد', time: '18 سبتمبر 2026، 11:00 ص', color: '#FFB400' },
      { text: 'رفض خالد المطيري النموذج الأولي لشاشة تسجيل الدخول', time: '11 سبتمبر 2026، 09:30 ص', color: '#FF6B6B' },
      { text: 'رفع سعد الغامدي النموذج الأولي الأول', time: '10 سبتمبر 2026، 02:00 م', color: '#FFB400' },
      { text: 'بدأ المشروع رسمياً بعد توقيع العقد CO-1277', time: '28 أغسطس 2026، 10:00 ص', color: '#A56BE0' },
    ],
    clientParty: { name: 'خالد المطيري', role: 'طالب الخدمة · فرد', avatar: 'خ', bg: 'linear-gradient(135deg,#5DA0FF,#2BD4C7)', userId: 'USR-2156', projectsCount: 9, risk: 'medium', rating: 4.0 },
    providerParty: { name: 'سعد الغامدي', role: 'مقدم الخدمة · فرد · Bronze', avatar: 'س', bg: 'linear-gradient(135deg,#0FA99A,#2BD4C7)', userId: 'USR-3099', projectsCount: 6, risk: 'high', rating: 3.2 },
    linkedEntities: [
      { kind: 'contract', label: 'عقد المشروع', refId: 'CO-1277 · نشط', status: 'نشط', route: '/supper-admin-overview/contracts' },
      { kind: 'request', label: 'الطلب الأصلي', refId: 'RQ-1277 · مكتمل', status: 'مكتمل', route: '/supper-admin-overview/requests' },
      { kind: 'offer', label: 'العرض المقبول', refId: 'OF-4788 · 12,000 ر.س', status: 'مقبول', route: '/supper-admin-overview/offers' },
      { kind: 'dispute', label: 'نزاع مفتوح', refId: 'DSP-3312 · قيد المراجعة', status: 'قيد المراجعة', route: '/supper-admin-overview/disputes' },
    ],
  },
  {
    id: 'PR-1265', title: 'بناء موقع متجر إلكتروني', client: 'منى الشمري', cAv: 'م', cBg: 'linear-gradient(135deg,#FFB400,#2BD4C7)',
    provider: 'أحمد الزهراني', pAv: 'أ', pBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)', value: '15,000 ر.س',
    escrowTotal: 15000, escrowReleased: 15000, spec: 'برمجة', progress: 100, deadline: '2026-09-01', startDate: '2026-08-01',
    contractType: 'نتائج محددة', status: 'completed', risk: 'low',
    milestones: [
      { name: 'التطوير', state: 'done', progress: 100 },
      { name: 'الاختبار', state: 'done', progress: 100 },
      { name: 'النشر', state: 'done', progress: 100 },
    ],
    aiNote: 'مشروع مكتمل بتقييم ممتاز من الطرفين.',
    deliverables: [
      { name: 'الموقع-الإلكتروني-نسخة-نهائية.zip', meta: 'رُفع: 28 أغسطس 2026 · 64.2 MB · التطوير', status: 'accepted', icon: 'doc' },
      { name: 'تقرير-الاختبار-والأداء.pdf', meta: 'رُفع: 30 أغسطس 2026 · 1.1 MB · الاختبار', status: 'accepted', icon: 'doc' },
      { name: 'رابط: الموقع المباشر بعد النشر', meta: 'رُفع: 1 سبتمبر 2026 · رابط مباشر · النشر', status: 'accepted', icon: 'link' },
    ],
    commLog: [
      { sender: 'منى الشمري (طالب)', role: 'client', text: 'الموقع يعمل بشكل ممتاز بعد النشر، شكراً على المجهود الكبير.', time: '1 سبتمبر — 04:00 م' },
      { sender: 'أحمد الزهراني (مقدم الخدمة)', role: 'provider', text: 'سعدت بالعمل معكم، بالتوفيق في المتجر الجديد.', time: '1 سبتمبر — 04:15 م' },
    ],
    commStale: false,
    commStaleNote: '',
    gantt: [
      { name: 'التطوير', state: 'done', startPct: 0, widthPct: 50 },
      { name: 'الاختبار', state: 'done', startPct: 50, widthPct: 25 },
      { name: 'النشر', state: 'done', startPct: 75, widthPct: 25 },
    ],
    activityLog: [
      { text: 'اكتمل المشروع بنجاح وتم إغلاقه بتقييم 5 نجوم من الطرفين', time: '1 سبتمبر 2026، 05:00 م', color: '#0FA99A' },
      { text: 'أُفرج عن كامل الضمان 15,000 ر.س بعد قبول جميع التسليمات', time: '1 سبتمبر 2026، 04:30 م', color: '#0FA99A' },
      { text: 'قبلت منى الشمري رابط الموقع المباشر بعد النشر', time: '1 سبتمبر 2026، 04:00 م', color: '#0FA99A' },
      { text: 'بدأ المشروع رسمياً بعد توقيع العقد CO-1265', time: '1 أغسطس 2026، 10:00 ص', color: '#A56BE0' },
    ],
    clientParty: { name: 'منى الشمري', role: 'طالبة الخدمة · فرد', avatar: 'م', bg: 'linear-gradient(135deg,#FFB400,#2BD4C7)', userId: 'USR-2210', projectsCount: 3, risk: 'low', rating: 4.9 },
    providerParty: { name: 'أحمد الزهراني', role: 'مقدم الخدمة · فرد · Silver', avatar: 'أ', bg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)', userId: 'USR-3021', projectsCount: 19, risk: 'high', rating: 3.6 },
    linkedEntities: [
      { kind: 'contract', label: 'عقد المشروع', refId: 'CO-1265 · مكتمل', status: 'مكتمل', route: '/supper-admin-overview/contracts' },
      { kind: 'request', label: 'الطلب الأصلي', refId: 'RQ-1265 · مكتمل', status: 'مكتمل', route: '/supper-admin-overview/requests' },
      { kind: 'offer', label: 'العرض المقبول', refId: 'OF-4770 · 15,000 ر.س', status: 'مقبول', route: '/supper-admin-overview/offers' },
    ],
  },
];
