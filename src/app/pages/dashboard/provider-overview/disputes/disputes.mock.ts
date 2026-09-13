// Shared mock data for the disputes list (disputes.ts) and the dispute detail
// route (dispute-details/dispute-details.ts). There is no provider-facing
// "get dispute by id" backend endpoint yet (dispute-api.service.ts only
// exposes getAdminDisputes/getAdminDispute for admins and
// createProviderDispute for raising a new dispute) — both pages read from
// this single in-memory array so the list and the detail view never drift
// apart while backed only by mock data.

export interface DisputeTimelineStep {
	label: string;
	done?: boolean;
	active?: boolean;
	icon?: string;
}

export interface DisputeHistoryEntry {
	title: string;
	sub: string;
	time: string;
	iconType: 'open' | 'ai' | 'doc' | 'chat' | 'pending';
}

export interface DisputeEvidenceItem {
	name: string;
	meta: string;
	source: 'ai' | 'company' | 'client';
	iconType: 'doc' | 'ai';
}

export interface DisputeParty {
	name: string;
	role: string;
	initials: string;
	gradient: string;
}

export interface DisputeStatusStep {
	label: string;
	state: 'done' | 'active' | 'pending';
}

export interface DisputeMeter {
	label: string;
	pct: number;
	variant?: 'default' | 'purple';
	suffixLabel?: string;
}

export interface DisputeDetail {
	confidencePct: number;
	verdictFor: { label: string; items: string[] };
	verdictAgainst: { label: string; items: string[] };
	meters: DisputeMeter[];
	recommendation: string;
	history: DisputeHistoryEntry[];
	evidence: DisputeEvidenceItem[];
	parties: DisputeParty[];
	statusSteps: DisputeStatusStep[];
	info: { label: string; value: string; valueClass?: 'teal' | 'amber' }[];
}

export interface Dispute {
	id: string;
	title: string;
	project: string;
	status: string;
	who: string;
	extra: string;
	icon: string;
	iconClass: string;
	badgeText: string;
	badgeClass: string;
	activeBorder: boolean;
	timeline: DisputeTimelineStep[];
	aiText: string;
	aiDone: boolean;
	amount: string;
	showEscalate: boolean;
	messages: number;
	date: string;
	detail?: DisputeDetail;
}

export const DISPUTES_MOCK: Dispute[] = [
	{
		id: 'DSP-2026-014',
		title: 'نزاع: جودة التسليم لا تطابق العقد',
		project: 'تصميم هوية بصرية · مع نورة التصميم',
		status: 'open',
		who: 'mine',
		extra: 'review',
		icon: 'shield',
		iconClass: 'bg-[#FFB400]/15 text-[#FFB400]',
		badgeText: 'قيد مراجعة الإدارة',
		badgeClass: 'bg-[#FFB400]/15 text-[#D98A0B] border-[#FFB400]/30',
		activeBorder: true,
		timeline: [
			{ label: 'رُفع الطلب', done: true, icon: 'check' },
			{ label: 'قرار الذكاء الأول', done: true, icon: 'ai' },
			{ label: 'مراجعة الإدارة', active: true, icon: 'shield' },
			{ label: 'الإقفال' }
		],
		aiText: ' التسليم يطابق 78٪ من نطاق العقد، يُقترح إعادة تنفيذ العنصرين الناقصين خلال 3 أيام دون تسوية مالية، أو تسوية 20٪ من الضمان. بانتظار اعتماد الإدارة',
		aiDone: false,
		amount: '2,500',
		showEscalate: true,
		messages: 3,
		date: '',
		detail: {
			confidencePct: 78,
			verdictFor: {
				label: 'لصالحك',
				items: [
					'سجل الرفع يثبت تسليم الملفات الأساسية في الموعد المتفق عليه',
					'3 مشاريع سابقة مكتملة دون أي نزاع مع نفس النطاق'
				]
			},
			verdictAgainst: {
				label: 'لصالح العميل',
				items: [
					'عنصران من نطاق العقد (الأيقونات ودليل الاستخدام) غير مكتملين',
					'لم يُبلَّغ العميل رسمياً بالتأخر في هذين العنصرين'
				]
			},
			meters: [
				{ label: 'تطابق التسليم مع العقد', pct: 78 },
				{ label: 'التزامك بالمواعيد', pct: 90 },
				{ label: 'مسؤولية النقص', pct: 65, variant: 'purple', suffixLabel: '65٪ طرفك' }
			],
			recommendation: 'القرار الأولي: إعادة تنفيذ العنصرين الناقصين خلال 3 أيام دون تسوية مالية، أو تسوية 20٪ من الضمان (500 ريال) للعميل مقابل إغلاق النزاع فوراً.',
			history: [
				{ title: 'رفع العميل النزاع', sub: 'يدّعي أن التسليم لا يطابق نطاق العقد بالكامل', time: '10 يونيو 2026 — 11:20 ص', iconType: 'open' },
				{ title: 'AI جمع الأدلة تلقائياً', sub: 'راجع سجل الرسائل والملفات المرفوعة ونطاق العقد الموقّع', time: '10 يونيو 2026 — 11:26 ص', iconType: 'ai' },
				{ title: 'قدّمت أدلة إضافية', sub: 'رفعت لقطات شاشة لسجل التسليم وملف المصدر النهائي', time: '11 يونيو 2026 — 9:40 ص', iconType: 'doc' },
				{ title: 'بانتظار مراجعة الإدارة', sub: 'مقرر خلال 24–48 ساعة من الآن', time: 'قيد الانتظار', iconType: 'pending' }
			],
			evidence: [
				{ name: 'نطاق العقد الموقّع', meta: 'PDF · وقت الإنشاء', source: 'ai', iconType: 'doc' },
				{ name: 'سجل رفع الملفات النهائية', meta: '9 يونيو 2026 · ZIP', source: 'company', iconType: 'doc' },
				{ name: 'تقرير AI — تحليل التطابق', meta: 'تلقائي · تحليل نطاق العقد', source: 'ai', iconType: 'ai' }
			],
			parties: [
				{ name: 'أنت (مقدّم الخدمة)', role: 'تصميم هوية بصرية', initials: 'أن', gradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)' },
				{ name: 'نورة التصميم', role: 'طالب الخدمة — العميل', initials: 'نو', gradient: 'linear-gradient(135deg,#FF8C69,#C0394A)' },
				{ name: 'وسيط AI', role: 'محلِّل النزاع', initials: 'AI', gradient: 'linear-gradient(135deg,#A56BE0,#7B2FBE)' }
			],
			statusSteps: [
				{ label: 'رفع النزاع', state: 'done' },
				{ label: 'جمع الأدلة (AI)', state: 'done' },
				{ label: 'تقديم أدلة إضافية', state: 'done' },
				{ label: 'مراجعة الإدارة', state: 'active' },
				{ label: 'صدور القرار', state: 'pending' },
				{ label: 'تسوية الضمان', state: 'pending' }
			],
			info: [
				{ label: 'رقم النزاع', value: 'DSP-2026-014' },
				{ label: 'تاريخ الرفع', value: '10 يونيو 2026' },
				{ label: 'المبلغ المتنازع عليه', value: '2,500 ريال', valueClass: 'teal' },
				{ label: 'مسؤول الدعم', value: 'بانتظار التعيين' },
				{ label: 'الموعد المتوقع', value: '13 يونيو 2026', valueClass: 'amber' }
			]
		}
	},
	{
		id: 'CNL-2026-007',
		title: 'إلغاء بالتراضي: تغيّر نطاق المشروع',
		project: 'كتابة محتوى متجر · مع رشا الكاتبة',
		status: 'open',
		who: 'mine',
		extra: 'pending',
		icon: 'hands',
		iconClass: 'bg-[#FF8C69]/15 text-[#FF8C69]',
		badgeText: 'بانتظار موافقة الطرفين',
		badgeClass: 'bg-[#FFB400]/15 text-[#D98A0B] border-[#FFB400]/30',
		activeBorder: true,
		timeline: [
			{ label: 'رُفع الطلب', done: true, icon: 'check' },
			{ label: 'تسوية مقترحة من الذكاء', active: true, icon: 'ai' },
			{ label: 'اعتماد الإدارة', icon: 'shield' },
			{ label: 'الإقفال' }
		],
		aiText: ' إنهاء العقد بالتراضي مع احتساب 40٪ للعمل المنجَز (760 ريال) للمقدّم وردّ الباقي إليك. بانتظار موافقتكما في النقاش',
		aiDone: false,
		amount: '1,900',
		showEscalate: false,
		messages: 1,
		date: '',
		detail: {
			confidencePct: 85,
			verdictFor: {
				label: 'لصالحك',
				items: ['40٪ من العمل منجَز وموثّق برفعات جزئية سابقة', 'العميل غيّر نطاق المشروع بعد بدء التنفيذ']
			},
			verdictAgainst: {
				label: 'لصالح العميل',
				items: ['لم يُستلم أي تسليم نهائي قابل للاستخدام']
			},
			meters: [
				{ label: 'نسبة العمل المنجَز', pct: 40 },
				{ label: 'وضوح طلب الإلغاء', pct: 92 }
			],
			recommendation: 'تسوية مقترحة: احتساب 40٪ من قيمة العقد (760 ريال) لك مقابل العمل المنجَز، وردّ الباقي (1,140 ريال) للعميل، ثم إغلاق العقد بالتراضي.',
			history: [
				{ title: 'طلب العميل إلغاء المشروع', sub: 'بسبب تغيّر نطاق العمل المطلوب بعد بدء الكتابة', time: '2 يونيو 2026 — 3:10 م', iconType: 'open' },
				{ title: 'AI اقترح نسبة تسوية', sub: 'بناءً على نسبة الإنجاز الموثقة في سجل التسليمات الجزئية', time: '2 يونيو 2026 — 3:25 م', iconType: 'ai' },
				{ title: 'بانتظار موافقة الطرفين', sub: 'في نقاش النزاع المباشر', time: 'قيد الانتظار', iconType: 'pending' }
			],
			evidence: [
				{ name: 'سجل التسليمات الجزئية', meta: '3 ملفات · Google Docs', source: 'company', iconType: 'doc' },
				{ name: 'تقرير AI — نسبة الإنجاز', meta: 'تلقائي · تحليل المحتوى المسلَّم', source: 'ai', iconType: 'ai' }
			],
			parties: [
				{ name: 'أنت (مقدّم الخدمة)', role: 'كتابة محتوى متجر', initials: 'أن', gradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)' },
				{ name: 'رشا الكاتبة', role: 'طالب الخدمة — العميل', initials: 'رش', gradient: 'linear-gradient(135deg,#FF8C69,#C0394A)' },
				{ name: 'وسيط AI', role: 'محلِّل النزاع', initials: 'AI', gradient: 'linear-gradient(135deg,#A56BE0,#7B2FBE)' }
			],
			statusSteps: [
				{ label: 'رفع طلب الإلغاء', state: 'done' },
				{ label: 'تسوية مقترحة من الذكاء', state: 'active' },
				{ label: 'اعتماد الإدارة', state: 'pending' },
				{ label: 'الإقفال', state: 'pending' }
			],
			info: [
				{ label: 'رقم الطلب', value: 'CNL-2026-007' },
				{ label: 'تاريخ الرفع', value: '2 يونيو 2026' },
				{ label: 'المبلغ المتجمّد بالضمان', value: '1,900 ريال', valueClass: 'teal' },
				{ label: 'الحالة', value: 'بانتظار موافقة الطرفين', valueClass: 'amber' }
			]
		}
	},
	{
		id: 'DSP-2026-009',
		title: 'نزاع: تأخّر في التسليم',
		project: 'تطوير متجر · مع تقنية الرواد',
		status: 'closed',
		who: 'against',
		extra: '',
		icon: 'check',
		iconClass: 'bg-[#0FA99A]/15 text-[#0FA99A]',
		badgeText: 'أُغلق بالتراضي',
		badgeClass: 'bg-[#0FA99A]/15 text-[#0FA99A] border-[#0FA99A]/30',
		activeBorder: false,
		timeline: [],
		aiText: ' اتفق الطرفان على تمديد 5 أيام دون غرامة، واعتمدت الإدارة قرار الذكاء وأُغلق النزاع',
		aiDone: true,
		amount: '',
		showEscalate: false,
		messages: 0,
		date: 'أُغلق 12 مايو · المبلغ أُفرج بالكامل',
		detail: {
			confidencePct: 88,
			verdictFor: { label: 'لصالح تقنية الرواد', items: ['تأخر 5 أيام مبرَّر بتعديلات متأخرة من العميل'] },
			verdictAgainst: { label: 'لصالحك', items: ['التسليم النهائي تجاوز الموعد الأصلي المتفق عليه'] },
			meters: [{ label: 'مسؤولية التأخر', pct: 30, variant: 'purple', suffixLabel: '30٪ طرف المُقدّم' }],
			recommendation: 'اتفق الطرفان على تمديد المهلة 5 أيام دون أي غرامة مالية، واعتمدت الإدارة القرار وأُفرج عن كامل المبلغ المحتجز.',
			history: [
				{ title: 'رُفع النزاع', sub: 'بخصوص تأخر تسليم المتجر الإلكتروني', time: '5 مايو 2026', iconType: 'open' },
				{ title: 'اعتمدت الإدارة التسوية', sub: 'تمديد 5 أيام دون غرامة، وإفراج كامل عن الضمان', time: '12 مايو 2026', iconType: 'doc' }
			],
			evidence: [{ name: 'تقرير AI — تحليل التأخر', meta: 'تلقائي', source: 'ai', iconType: 'ai' }],
			parties: [
				{ name: 'أنت (مقدّم الخدمة)', role: 'تطوير متجر', initials: 'أن', gradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)' },
				{ name: 'تقنية الرواد', role: 'طالب الخدمة — العميل', initials: 'تق', gradient: 'linear-gradient(135deg,#FF8C69,#C0394A)' }
			],
			statusSteps: [
				{ label: 'رفع النزاع', state: 'done' },
				{ label: 'قرار الذكاء', state: 'done' },
				{ label: 'اعتماد الإدارة', state: 'done' },
				{ label: 'الإقفال', state: 'done' }
			],
			info: [
				{ label: 'رقم النزاع', value: 'DSP-2026-009' },
				{ label: 'تاريخ الإغلاق', value: '12 مايو 2026' },
				{ label: 'حالة المبلغ', value: 'أُفرج بالكامل', valueClass: 'teal' }
			]
		}
	},
	{
		id: 'CNL-2026-003',
		title: 'إلغاء بالتراضي: اتفاق ودّي',
		project: 'استشارة تسويقية · مع مكتب أفق',
		status: 'closed',
		who: 'mine',
		extra: '',
		icon: 'check',
		iconClass: 'bg-[#0FA99A]/15 text-[#0FA99A]',
		badgeText: 'أُغلق بالتراضي',
		badgeClass: 'bg-[#0FA99A]/15 text-[#0FA99A] border-[#0FA99A]/30',
		activeBorder: false,
		timeline: [],
		aiText: ' أُنهي العقد بالتراضي مع ردّ كامل للمبلغ، واعتمدت الإدارة التسوية',
		aiDone: true,
		amount: '',
		showEscalate: false,
		messages: 0,
		date: 'أُغلق 28 أبريل · رُدّ 1,500 ريال',
		detail: {
			confidencePct: 95,
			verdictFor: { label: 'اتفاق الطرفين', items: ['لم يبدأ تنفيذ العمل فعلياً وقت طلب الإلغاء'] },
			verdictAgainst: { label: '—', items: [] },
			meters: [{ label: 'نسبة العمل المنجَز', pct: 0 }],
			recommendation: 'تم الاتفاق على إلغاء العقد بالكامل دون أي عمل منجَز، وردّ كامل المبلغ للعميل.',
			history: [
				{ title: 'طلب إلغاء بالتراضي', sub: 'قبل بدء تنفيذ الاستشارة التسويقية', time: '25 أبريل 2026', iconType: 'open' },
				{ title: 'اعتمدت الإدارة التسوية', sub: 'ردّ كامل المبلغ للعميل', time: '28 أبريل 2026', iconType: 'doc' }
			],
			evidence: [],
			parties: [
				{ name: 'أنت (مقدّم الخدمة)', role: 'استشارة تسويقية', initials: 'أن', gradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)' },
				{ name: 'مكتب أفق', role: 'طالب الخدمة — العميل', initials: 'مك', gradient: 'linear-gradient(135deg,#FF8C69,#C0394A)' }
			],
			statusSteps: [
				{ label: 'طلب الإلغاء', state: 'done' },
				{ label: 'اعتماد الإدارة', state: 'done' },
				{ label: 'الإقفال', state: 'done' }
			],
			info: [
				{ label: 'رقم الطلب', value: 'CNL-2026-003' },
				{ label: 'تاريخ الإغلاق', value: '28 أبريل 2026' },
				{ label: 'المبلغ المُعاد', value: '1,500 ريال', valueClass: 'teal' }
			]
		}
	}
];
