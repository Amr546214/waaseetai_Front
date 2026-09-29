// Mock data — no backend endpoint exists for offers yet; shared by the list
// (sa-offers) and the routed detail page (sa-offer-detail).

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'flagged';
export type NegotiationKind = 'step' | 'accepted' | 'rejected' | 'flagged';

export interface NegotiationRound {
  kind: NegotiationKind;
  dot: string;
  title: string;
  note: string;
  tags: string[];
  time: string;
}

export interface ReliabilityBar {
  label: string;
  value: string;
  width: number;
  color: string;
}

export interface SimilarOffer {
  initial: string;
  bg: string;
  title: string;
  spec: string;
  days: string;
  price: string;
  status: string;
}

export interface Offer {
  id: string;
  provider: string;
  pAv: string;
  pBg: string;
  request: string;
  spec: string;
  price: string;
  priceValue: number;
  marketAvg: number;
  days: string;
  rating: number;
  date: string;
  status: OfferStatus;
  aiClean: boolean;
  reliability: number;
  disputesRate: string;
  completionRate: string;
  level: string;
  // AI + linked records
  aiScore: number;
  acceptedDate?: string;
  linkedRequestId: string;
  linkedContractId?: string;
  linkedProjectId?: string;
  // provider profile summary
  projectsCompleted: number;
  providerRevenue: string;
  providerDisputesText: string;
  // negotiation timeline
  negotiationRounds: NegotiationRound[];
  negotiationSummary: string;
  // reliability breakdown
  reliabilityBars: ReliabilityBar[];
  // market comparison
  similarOffers: SimilarOffer[];
  marketBanner: string;
  marketBannerWarn?: boolean;
  marketNote: string;
  // AI analysis
  aiAnalysisPoints: string[];
  successProbability: number;
}

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  pending: 'بانتظار القرار',
  accepted: 'مقبول',
  rejected: 'مرفوض',
  flagged: 'مشبوه',
};

export const OFFER_STATUS_CLASSES: Record<OfferStatus, string> = {
  pending: 'of-st-pending',
  accepted: 'of-st-accepted',
  rejected: 'of-st-rejected',
  flagged: 'of-st-flagged',
};

export function offerPriceIntel(o: Offer): { label: string; cls: string } {
  const diff = Math.round(((o.priceValue - o.marketAvg) / o.marketAvg) * 100);
  if (diff < -15) return { label: `أقل ▼${Math.abs(diff)}%`, cls: 'of-intel-low' };
  if (diff > 20) return { label: `أعلى ▲${diff}%`, cls: 'of-intel-high' };
  return { label: `متوسط ~${diff >= 0 ? '+' : ''}${diff}%`, cls: 'of-intel-mid' };
}

export const OFFERS: Offer[] = [
  {
    id: 'OF-4812', provider: 'سارة القحطاني', pAv: 'س', pBg: 'linear-gradient(135deg,#59C1F5,#5DA0FF)',
    request: 'تصميم بنرات إعلانية × 10', spec: 'تصميم', price: '3,200 ر.س', priceValue: 3200, marketAvg: 3100,
    days: '5 أيام', rating: 4.9, date: '2026-09-08', status: 'accepted', aiClean: true,
    reliability: 97, disputesRate: '0%', completionRate: '100%', level: 'Platinum',
    aiScore: 93, acceptedDate: '٨ سبتمبر ٢٠٢٦',
    linkedRequestId: 'RQ-1301', linkedContractId: 'CO-1301', linkedProjectId: 'PR-1301',
    projectsCompleted: 54, providerRevenue: '86,400 ر.س', providerDisputesText: 'لا يوجد',
    negotiationRounds: [
      {
        kind: 'step', dot: '1', title: 'العرض الأولي من سارة القحطاني',
        note: 'قدّمت عرضاً بمبلغ 3,600 ر.س خلال 6 أيام مع نماذج أولية لثلاثة تصاميم من أصل عشرة',
        tags: ['المبلغ: 3,600 ر.س', 'المدة: 6 أيام'], time: '٨ سبتمبر ٢٠٢٦ — ١٠:١٥ ص',
      },
      {
        kind: 'step', dot: '2', title: 'طلب تفاوض من العميل',
        note: 'طلب العميل تخفيض السعر إلى 3,200 ر.س وتقصير المدة إلى 5 أيام نظراً لضيق الميزانية',
        tags: ['مطلوب: 3,200 ر.س', '5 أيام'], time: '٨ سبتمبر ٢٠٢٦ — ١١:٤٠ ص',
      },
      {
        kind: 'accepted', dot: '✓', title: 'قبول العرض المعدَّل',
        note: 'وافقت سارة على 3,200 ر.س خلال 5 أيام مع الحفاظ على جميع التصاميم العشرة دون أي تنازل بالنطاق',
        tags: ['المبلغ النهائي: 3,200 ر.س'], time: '٨ سبتمبر ٢٠٢٦ — ١٢:٠٥ م',
      },
    ],
    negotiationSummary: 'التفاوض: خُفِّض المبلغ بنسبة 11% (من 3,600 إلى 3,200 ر.س) خلال أقل من ساعتين — العرض ضمن متوسط السوق',
    reliabilityBars: [
      { label: 'معدل إتمام المشاريع', value: '100%', width: 100, color: '#0FA99A' },
      { label: 'التسليم في الوقت', value: '97%', width: 97, color: '#2BD4C7' },
      { label: 'جودة التسليمات', value: '98%', width: 98, color: 'linear-gradient(90deg,#2BD4C7,#2B7FFF)' },
      { label: 'التراسل والاستجابة', value: '95%', width: 95, color: '#5DA0FF' },
      { label: 'معدل النزاعات', value: '0%', width: 2, color: '#0FA99A' },
    ],
    similarOffers: [
      { initial: 'ر', bg: 'linear-gradient(135deg,#FFB400,#59C1F5)', title: 'حزمة بنرات لمتجر أزياء (٢٠٢٦)', spec: 'تصميم', days: '5 أيام', price: '3,400 ر.س', status: 'مقبول' },
      { initial: 'م', bg: 'linear-gradient(135deg,#A56BE0,#FF8C69)', title: 'بنرات حملة رمضان (٢٠٢٦)', spec: 'تصميم', days: '4 أيام', price: '2,950 ر.س', status: 'مقبول' },
      { initial: 'ل', bg: 'linear-gradient(135deg,#2BD4C7,#FFB400)', title: 'تصميم لافتات معرض تجاري (٢٠٢٥)', spec: 'تصميم', days: '6 أيام', price: '3,600 ر.س', status: 'مكتمل' },
    ],
    marketBanner: 'هذا العرض (3,200 ر.س) ضمن متوسط السوق لنفس التخصص — سعر عادل',
    marketNote: 'متوسط السوق (تصميم، 4-6 أيام): 3,317 ر.س · هذا العرض: 3,200 ر.س (أقل بـ 3.5%)',
    aiAnalysisPoints: [
      '✓ العرض ضمن متوسط السوق لنفس نوع الخدمة',
      '✓ مقدمة الخدمة موثوقة جداً (Reliability: 97) بصفر نزاعات تاريخياً',
      '✓ التفاوض جرى بسرعة واحترافية دون أي تنازل في النطاق',
      '📊 احتمال إتمام المشروع بنجاح: 96%',
    ],
    successProbability: 96,
  },
  {
    id: 'OF-4811', provider: 'أحمد الزهراني', pAv: 'أ', pBg: 'linear-gradient(135deg,#2B7FFF,#5DA0FF)',
    request: 'تصميم بنرات إعلانية × 10', spec: 'تصميم', price: '2,800 ر.س', priceValue: 2800, marketAvg: 3100,
    days: '6 أيام', rating: 4.7, date: '2026-09-08', status: 'rejected', aiClean: true,
    reliability: 91, disputesRate: '2.9%', completionRate: '97%', level: 'Platinum',
    aiScore: 84,
    linkedRequestId: 'RQ-1301',
    projectsCompleted: 41, providerRevenue: '52,100 ر.س', providerDisputesText: '1 نزاع (تمت تسويته)',
    negotiationRounds: [
      {
        kind: 'step', dot: '1', title: 'العرض الأولي من أحمد الزهراني',
        note: 'قدّم عرضاً بمبلغ 2,800 ر.س خلال 6 أيام مع تفاصيل تنفيذ واضحة لكل بانر على حدة',
        tags: ['المبلغ: 2,800 ر.س', 'المدة: 6 أيام'], time: '٨ سبتمبر ٢٠٢٦ — ٠٩:٠٠ ص',
      },
      {
        kind: 'rejected', dot: '✕', title: 'رفض العرض من العميل',
        note: 'فضّل العميل عرضاً منافساً بمدة أقصر (5 أيام) رغم فارق السعر البسيط لصالح أحمد',
        tags: ['فارق السعر: -400 ر.س فقط'], time: '٨ سبتمبر ٢٠٢٦ — ٠٢:٣٠ م',
      },
    ],
    negotiationSummary: 'لم يتم التفاوض على السعر — الرفض جاء بسبب معيار مدة التنفيذ فقط',
    reliabilityBars: [
      { label: 'معدل إتمام المشاريع', value: '97%', width: 97, color: '#0FA99A' },
      { label: 'التسليم في الوقت', value: '93%', width: 93, color: '#2BD4C7' },
      { label: 'جودة التسليمات', value: '96%', width: 96, color: 'linear-gradient(90deg,#2BD4C7,#2B7FFF)' },
      { label: 'التراسل والاستجابة', value: '90%', width: 90, color: '#5DA0FF' },
      { label: 'معدل النزاعات', value: '2.9%', width: 8, color: '#FFB400' },
    ],
    similarOffers: [
      { initial: 'س', bg: 'linear-gradient(135deg,#2BD4C7,#5DA0FF)', title: 'بنرات إعلانية لصالة رياضية (٢٠٢٦)', spec: 'تصميم', days: '5 أيام', price: '3,000 ر.س', status: 'مقبول' },
      { initial: 'هـ', bg: 'linear-gradient(135deg,#FFB400,#FF8C69)', title: 'حزمة بنرات سوشيال ميديا (٢٠٢٥)', spec: 'تصميم', days: '4 أيام', price: '2,600 ر.س', status: 'مقبول' },
    ],
    marketBanner: 'هذا العرض (2,800 ر.س) ضمن نطاق السوق — الرفض غير مرتبط بالسعر',
    marketNote: 'متوسط السوق (تصميم، 4-6 أيام): 2,867 ر.س · هذا العرض: 2,800 ر.س (أقل بـ 2.3%)',
    aiAnalysisPoints: [
      '✓ السعر تنافسي وأقل قليلاً من متوسط السوق',
      '⚠ مدة التنفيذ (6 أيام) أطول من العرض المنافس الذي فضّله العميل',
      '✓ سجل مقدم الخدمة نظيف وموثوق (Reliability: 91)',
      '📊 احتمال قبول عرض مماثل مستقبلاً: 78%',
    ],
    successProbability: 78,
  },
  {
    id: 'OF-4810', provider: 'ريم الحربي', pAv: 'ر', pBg: 'linear-gradient(135deg,#FFB400,#59C1F5)',
    request: 'تطوير تطبيق iOS', spec: 'برمجة', price: '24,000 ر.س', priceValue: 24000, marketAvg: 26000,
    days: '45 يوم', rating: 4.8, date: '2026-09-07', status: 'pending', aiClean: true,
    reliability: 94, disputesRate: '1.1%', completionRate: '98%', level: 'Gold',
    aiScore: 88,
    linkedRequestId: 'RQ-1288',
    projectsCompleted: 37, providerRevenue: '71,300 ر.س', providerDisputesText: 'نزاع واحد قديم (مغلق)',
    negotiationRounds: [
      {
        kind: 'step', dot: '1', title: 'العرض الأولي من ريم الحربي',
        note: 'قدّمت عرضاً بمبلغ 24,000 ر.س خلال 45 يوماً مع خطة تطوير من 4 مراحل (تصميم واجهات، برمجة خلفية، اختبار، نشر)',
        tags: ['المبلغ: 24,000 ر.س', 'المدة: 45 يوم'], time: '٧ سبتمبر ٢٠٢٦ — ٠٤:٢٠ م',
      },
    ],
    negotiationSummary: 'لا تفاوض حتى الآن — العرض بانتظار قرار الطالب',
    reliabilityBars: [
      { label: 'معدل إتمام المشاريع', value: '98%', width: 98, color: '#0FA99A' },
      { label: 'التسليم في الوقت', value: '95%', width: 95, color: '#2BD4C7' },
      { label: 'جودة التسليمات', value: '97%', width: 97, color: 'linear-gradient(90deg,#2BD4C7,#2B7FFF)' },
      { label: 'التراسل والاستجابة', value: '93%', width: 93, color: '#5DA0FF' },
      { label: 'معدل النزاعات', value: '1.1%', width: 5, color: '#FFB400' },
    ],
    similarOffers: [
      { initial: 'خ', bg: 'linear-gradient(135deg,#2BD4C7,#5DA0FF)', title: 'تطبيق iOS لحجز المواعيد (٢٠٢٦)', spec: 'برمجة', days: '40 يوم', price: '22,500 ر.س', status: 'مقبول' },
      { initial: 'ن', bg: 'linear-gradient(135deg,#A56BE0,#FF8C69)', title: 'تطبيق توصيل طلبات — iOS (٢٠٢٥)', spec: 'برمجة', days: '50 يوم', price: '27,000 ر.س', status: 'مكتمل' },
      { initial: 'ف', bg: 'linear-gradient(135deg,#FFB400,#2BD4C7)', title: 'تطبيق تتبع لياقة — iOS (٢٠٢٥)', spec: 'برمجة', days: '38 يوم', price: '21,800 ر.س', status: 'مقبول' },
    ],
    marketBanner: 'هذا العرض (24,000 ر.س) قريب جداً من متوسط السوق — ضمن النطاق المعقول',
    marketNote: 'متوسط السوق (برمجة، 38-50 يوم): 23,767 ر.س · هذا العرض: 24,000 ر.س (أعلى بـ 1%)',
    aiAnalysisPoints: [
      '✓ السعر قريب من متوسط السوق لمشاريع iOS مماثلة',
      '✓ مقدمة الخدمة ذات سجل قوي (Reliability: 94)',
      '⏳ العرض لم يُقيَّم بعد من الطالب — يُنصح بمتابعة القرار خلال 48 ساعة',
      '📊 احتمال قبول العرض: 81%',
    ],
    successProbability: 81,
  },
  {
    id: 'OF-4807', provider: 'حساب مجهول', pAv: '؟', pBg: 'linear-gradient(135deg,#FF8C69,#FFB400)',
    request: 'استشارة قانونية', spec: 'استشارات', price: '150 ر.س', priceValue: 150, marketAvg: 900,
    days: '1 يوم', rating: 2.1, date: '2026-09-06', status: 'flagged', aiClean: false,
    reliability: 22, disputesRate: '18%', completionRate: '40%', level: 'جديد',
    aiScore: 21,
    linkedRequestId: 'RQ-1270',
    projectsCompleted: 3, providerRevenue: '640 ر.س', providerDisputesText: '4 نزاعات (نشطة)',
    negotiationRounds: [
      {
        kind: 'flagged', dot: '⚠', title: 'عرض أولي منخفض بشكل غير معتاد',
        note: 'قدّم الحساب عرضاً بمبلغ 150 ر.س مقابل استشارة قانونية كاملة — أقل بكثير من متوسط السوق (900 ر.س) دون أي تبرير واضح',
        tags: ['المبلغ: 150 ر.س', 'المدة: 1 يوم'], time: '٦ سبتمبر ٢٠٢٦ — ٠٨:١٠ ص',
      },
    ],
    negotiationSummary: 'تم إيقاف العرض تلقائياً بواسطة فلتر الأسعار الشاذة لإحالته إلى المراجعة اليدوية',
    reliabilityBars: [
      { label: 'معدل إتمام المشاريع', value: '40%', width: 40, color: '#FF8C69' },
      { label: 'التسليم في الوقت', value: '35%', width: 35, color: '#FF8C69' },
      { label: 'جودة التسليمات', value: '44%', width: 44, color: '#FF8C69' },
      { label: 'التراسل والاستجابة', value: '50%', width: 50, color: '#FFB400' },
      { label: 'معدل النزاعات', value: '18%', width: 45, color: '#FF8C69' },
    ],
    similarOffers: [
      { initial: '؟', bg: 'linear-gradient(135deg,#FF8C69,#FFB400)', title: 'استشارة تعاقدية سريعة (حساب جديد) (٢٠٢٦)', spec: 'استشارات', days: '1 يوم', price: '850 ر.س', status: 'مرفوض' },
      { initial: 'ط', bg: 'linear-gradient(135deg,#2BD4C7,#5DA0FF)', title: 'استشارة قانونية لعقد إيجار (٢٠٢٦)', spec: 'استشارات', days: '2 يوم', price: '950 ر.س', status: 'مقبول' },
    ],
    marketBanner: '⚠ هذا العرض أقل من متوسط السوق بنسبة 83% — نمط سعري مشبوه يستدعي المراجعة',
    marketBannerWarn: true,
    marketNote: 'متوسط السوق (استشارات، 1-2 يوم): 900 ر.س · هذا العرض: 150 ر.س (أقل بـ 83%)',
    aiAnalysisPoints: [
      '⚠ السعر أقل من متوسط السوق بفارق كبير جداً (83%) — نمط غير طبيعي',
      '⚠ الحساب مجهول الهوية ولم يُكمل توثيق KYC',
      '⚠ معدل النزاعات مرتفع جداً (18%) ومعدل الإتمام ضعيف (40%)',
      '🛑 يُنصح برفض العرض وتعليق الحساب لمراجعة الامتثال',
    ],
    successProbability: 12,
  },
  {
    id: 'OF-4805', provider: 'سارة القحطاني', pAv: 'س', pBg: 'linear-gradient(135deg,#59C1F5,#5DA0FF)',
    request: 'تحرير ومونتاج فيديو', spec: 'تصميم', price: '3,800 ر.س', priceValue: 3800, marketAvg: 3600,
    days: '7 أيام', rating: 4.9, date: '2026-09-05', status: 'pending', aiClean: true,
    reliability: 97, disputesRate: '0%', completionRate: '100%', level: 'Platinum',
    aiScore: 90,
    linkedRequestId: 'RQ-1279',
    projectsCompleted: 54, providerRevenue: '86,400 ر.س', providerDisputesText: 'لا يوجد',
    negotiationRounds: [
      {
        kind: 'step', dot: '1', title: 'العرض الأولي من سارة القحطاني',
        note: 'قدّمت عرضاً بمبلغ 3,800 ر.س خلال 7 أيام يشمل المونتاج والتصحيح اللوني والموسيقى التصويرية',
        tags: ['المبلغ: 3,800 ر.س', 'المدة: 7 أيام'], time: '٥ سبتمبر ٢٠٢٦ — ٠١:٥٠ م',
      },
    ],
    negotiationSummary: 'لا تفاوض حتى الآن — العرض بانتظار قرار الطالب',
    reliabilityBars: [
      { label: 'معدل إتمام المشاريع', value: '100%', width: 100, color: '#0FA99A' },
      { label: 'التسليم في الوقت', value: '97%', width: 97, color: '#2BD4C7' },
      { label: 'جودة التسليمات', value: '98%', width: 98, color: 'linear-gradient(90deg,#2BD4C7,#2B7FFF)' },
      { label: 'التراسل والاستجابة', value: '95%', width: 95, color: '#5DA0FF' },
      { label: 'معدل النزاعات', value: '0%', width: 2, color: '#0FA99A' },
    ],
    similarOffers: [
      { initial: 'م', bg: 'linear-gradient(135deg,#2BD4C7,#A56BE0)', title: 'مونتاج فيديو تعريفي لمنتج (٢٠٢٦)', spec: 'تصميم', days: '6 أيام', price: '3,500 ر.س', status: 'مقبول' },
      { initial: 'ع', bg: 'linear-gradient(135deg,#FFB400,#5DA0FF)', title: 'تحرير فيديوهات تسويقية × 5 (٢٠٢٥)', spec: 'تصميم', days: '8 أيام', price: '4,100 ر.س', status: 'مكتمل' },
    ],
    marketBanner: 'هذا العرض (3,800 ر.س) مطابق تقريباً لمتوسط السوق — سعر عادل',
    marketNote: 'متوسط السوق (تصميم، 6-8 أيام): 3,800 ر.س · هذا العرض: 3,800 ر.س (مطابق للمتوسط)',
    aiAnalysisPoints: [
      '✓ السعر مطابق لمتوسط السوق تماماً',
      '✓ مقدمة الخدمة من الفئة Platinum بسجل ممتاز (Reliability: 97)',
      '⏳ بانتظار قرار الطالب — لم يبدأ التفاوض بعد',
      '📊 احتمال قبول العرض: 90%',
    ],
    successProbability: 90,
  },
  {
    id: 'OF-4803', provider: 'خالد المالكي', pAv: 'خ', pBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
    request: 'بناء موقع متجر إلكتروني', spec: 'برمجة', price: '12,500 ر.س', priceValue: 12500, marketAvg: 14000,
    days: '30 يوم', rating: 4.5, date: '2026-09-04', status: 'pending', aiClean: true,
    reliability: 88, disputesRate: '3.4%', completionRate: '95%', level: 'Gold',
    aiScore: 86,
    linkedRequestId: 'RQ-1265',
    projectsCompleted: 29, providerRevenue: '58,900 ر.س', providerDisputesText: '2 نزاع (مغلقة)',
    negotiationRounds: [
      {
        kind: 'step', dot: '1', title: 'العرض الأولي من خالد المالكي',
        note: 'قدّم عرضاً بمبلغ 12,500 ر.س خلال 30 يوماً يشمل تصميم المتجر وربط بوابة الدفع ولوحة تحكم للمخزون',
        tags: ['المبلغ: 12,500 ر.س', 'المدة: 30 يوم'], time: '٤ سبتمبر ٢٠٢٦ — ١١:٠٠ ص',
      },
    ],
    negotiationSummary: 'لا تفاوض حتى الآن — العرض بانتظار قرار الطالب',
    reliabilityBars: [
      { label: 'معدل إتمام المشاريع', value: '95%', width: 95, color: '#0FA99A' },
      { label: 'التسليم في الوقت', value: '90%', width: 90, color: '#2BD4C7' },
      { label: 'جودة التسليمات', value: '93%', width: 93, color: 'linear-gradient(90deg,#2BD4C7,#2B7FFF)' },
      { label: 'التراسل والاستجابة', value: '88%', width: 88, color: '#5DA0FF' },
      { label: 'معدل النزاعات', value: '3.4%', width: 10, color: '#FFB400' },
    ],
    similarOffers: [
      { initial: 'ي', bg: 'linear-gradient(135deg,#5DA0FF,#2BD4C7)', title: 'متجر إلكتروني لبيع الأثاث (٢٠٢٦)', spec: 'برمجة', days: '28 يوم', price: '13,200 ر.س', status: 'مقبول' },
      { initial: 'ز', bg: 'linear-gradient(135deg,#A56BE0,#FFB400)', title: 'منصة تجارة إلكترونية صغيرة (٢٠٢٥)', spec: 'برمجة', days: '35 يوم', price: '15,000 ر.س', status: 'مكتمل' },
    ],
    marketBanner: 'هذا العرض (12,500 ر.س) أقل من متوسط السوق — قيمة تنافسية جيدة',
    marketNote: 'متوسط السوق (برمجة، 28-35 يوم): 14,100 ر.س · هذا العرض: 12,500 ر.س (أقل بـ 11.3%)',
    aiAnalysisPoints: [
      '✓ السعر أقل من متوسط السوق بهامش معقول دون مبالغة',
      '✓ مقدم الخدمة من فئة Gold بسجل جيد (Reliability: 88)',
      '⏳ العرض بانتظار قرار الطالب',
      '📊 احتمال قبول العرض: 85%',
    ],
    successProbability: 85,
  },
];
