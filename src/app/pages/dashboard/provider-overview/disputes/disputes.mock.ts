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
	iconType: 'open' | 'doc' | 'chat' | 'pending';
}

export interface DisputeEvidenceItem {
	name: string;
	meta: string;
	source: 'company' | 'client';
	iconType: 'doc';
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

// Company-mode only: which team member on the provider company's side this
// dispute/project involves. Mock/placeholder — there is no backend field
// linking a dispute to a specific company team member yet (dispute.service.ts
// has no team-member assignment concept at all). Deterministic per dispute id
// (not random) so the list and detail pages always agree.
export interface DisputeTeamMember {
	name: string;
	role: string;
	initials: string;
	gradient: string;
}

// Final AI cleanup batch: confidencePct/verdictFor/verdictAgainst/meters
// (a fabricated AI-adjudication apparatus — a fake "AI confidence" score,
// AI-authored arguments for each side, and AI-assigned fault percentages)
// removed entirely — no real dispute-resolution AI exists anywhere in the
// backend (dispute.service.ts is a plain manual create -> admin-review ->
// admin-resolve workflow, zero AI/Gemini involvement). `recommendation` is
// kept as an honest admin-attributed proposed resolution, not an AI verdict.
export interface DisputeDetail {
	recommendation?: string;
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
	/** Company-mode only — see DisputeTeamMember. Mock/placeholder field. */
	teamMember?: DisputeTeamMember;
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
			{ label: 'المراجعة الأولية', done: true, icon: 'review' },
			{ label: 'مراجعة الإدارة', active: true, icon: 'shield' },
			{ label: 'الإقفال' }
		],
		aiText: ' العنصران الناقصان (الأيقونات ودليل الاستخدام) لم يُسلَّما بعد. بانتظار مراجعة الإدارة وتحديد القرار النهائي',
		aiDone: false,
		amount: '2,500',
		showEscalate: true,
		messages: 3,
		date: '',
		detail: {
			recommendation: 'مقترح الإدارة: إعادة تنفيذ العنصرين الناقصين خلال 3 أيام دون تسوية مالية، أو تسوية 20٪ من الضمان (500 ريال) للعميل مقابل إغلاق النزاع فوراً.',
			history: [
				{ title: 'رفع العميل النزاع', sub: 'يدّعي أن التسليم لا يطابق نطاق العقد بالكامل', time: '10 يونيو 2026 — 11:20 ص', iconType: 'open' },
				{ title: 'تم جمع الأدلة', sub: 'مراجعة سجل الرسائل والملفات المرفوعة ونطاق العقد الموقّع', time: '10 يونيو 2026 — 11:26 ص', iconType: 'doc' },
				{ title: 'قدّمت أدلة إضافية', sub: 'رفعت لقطات شاشة لسجل التسليم وملف المصدر النهائي', time: '11 يونيو 2026 — 9:40 ص', iconType: 'doc' },
				{ title: 'بانتظار مراجعة الإدارة', sub: 'مقرر خلال 24–48 ساعة من الآن', time: 'قيد الانتظار', iconType: 'pending' }
			],
			evidence: [
				{ name: 'نطاق العقد الموقّع', meta: 'PDF · وقت الإنشاء', source: 'company', iconType: 'doc' },
				{ name: 'سجل رفع الملفات النهائية', meta: '9 يونيو 2026 · ZIP', source: 'company', iconType: 'doc' }
			],
			parties: [
				{ name: 'أنت (مقدّم الخدمة)', role: 'تصميم هوية بصرية', initials: 'أن', gradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)' },
				{ name: 'نورة التصميم', role: 'طالب الخدمة — العميل', initials: 'نو', gradient: 'linear-gradient(135deg,#FF8C69,#C0394A)' }
			],
			statusSteps: [
				{ label: 'رفع النزاع', state: 'done' },
				{ label: 'جمع الأدلة', state: 'done' },
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
		},
		teamMember: { name: 'فهد العتيبي', role: 'تصميم هوية بصرية', initials: 'فه', gradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)' }
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
			{ label: 'تسوية مقترحة', active: true, icon: 'review' },
			{ label: 'اعتماد الإدارة', icon: 'shield' },
			{ label: 'الإقفال' }
		],
		aiText: ' تسوية مقترحة: احتساب 40٪ للعمل المنجَز (760 ريال) للمقدّم وردّ الباقي إليك. بانتظار موافقتكما في النقاش',
		aiDone: false,
		amount: '1,900',
		showEscalate: false,
		messages: 1,
		date: '',
		detail: {
			recommendation: 'تسوية مقترحة: احتساب 40٪ من قيمة العقد (760 ريال) لك مقابل العمل المنجَز، وردّ الباقي (1,140 ريال) للعميل، ثم إغلاق العقد بالتراضي.',
			history: [
				{ title: 'طلب العميل إلغاء المشروع', sub: 'بسبب تغيّر نطاق العمل المطلوب بعد بدء الكتابة', time: '2 يونيو 2026 — 3:10 م', iconType: 'open' },
				{ title: 'اقتُرحت نسبة تسوية', sub: 'بناءً على نسبة الإنجاز الموثقة في سجل التسليمات الجزئية', time: '2 يونيو 2026 — 3:25 م', iconType: 'doc' },
				{ title: 'بانتظار موافقة الطرفين', sub: 'في نقاش النزاع المباشر', time: 'قيد الانتظار', iconType: 'pending' }
			],
			evidence: [
				{ name: 'سجل التسليمات الجزئية', meta: '3 ملفات · Google Docs', source: 'company', iconType: 'doc' }
			],
			parties: [
				{ name: 'أنت (مقدّم الخدمة)', role: 'كتابة محتوى متجر', initials: 'أن', gradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)' },
				{ name: 'رشا الكاتبة', role: 'طالب الخدمة — العميل', initials: 'رش', gradient: 'linear-gradient(135deg,#FF8C69,#C0394A)' }
			],
			statusSteps: [
				{ label: 'رفع طلب الإلغاء', state: 'done' },
				{ label: 'تسوية مقترحة', state: 'active' },
				{ label: 'اعتماد الإدارة', state: 'pending' },
				{ label: 'الإقفال', state: 'pending' }
			],
			info: [
				{ label: 'رقم الطلب', value: 'CNL-2026-007' },
				{ label: 'تاريخ الرفع', value: '2 يونيو 2026' },
				{ label: 'المبلغ المتجمّد بالضمان', value: '1,900 ريال', valueClass: 'teal' },
				{ label: 'الحالة', value: 'بانتظار موافقة الطرفين', valueClass: 'amber' }
			]
		},
		teamMember: { name: 'سارة الزهراني', role: 'كتابة محتوى متجر', initials: 'سا', gradient: 'linear-gradient(135deg,#FFB400,#D98A0B)' }
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
		aiText: ' اتفق الطرفان على تمديد 5 أيام دون غرامة، واعتمدت الإدارة القرار وأُغلق النزاع',
		aiDone: true,
		amount: '',
		showEscalate: false,
		messages: 0,
		date: 'أُغلق 12 مايو · المبلغ أُفرج بالكامل',
		detail: {
			recommendation: 'اتفق الطرفان على تمديد المهلة 5 أيام دون أي غرامة مالية، واعتمدت الإدارة القرار وأُفرج عن كامل المبلغ المحتجز.',
			history: [
				{ title: 'رُفع النزاع', sub: 'بخصوص تأخر تسليم المتجر الإلكتروني', time: '5 مايو 2026', iconType: 'open' },
				{ title: 'اعتمدت الإدارة التسوية', sub: 'تمديد 5 أيام دون غرامة، وإفراج كامل عن الضمان', time: '12 مايو 2026', iconType: 'doc' }
			],
			evidence: [],
			parties: [
				{ name: 'أنت (مقدّم الخدمة)', role: 'تطوير متجر', initials: 'أن', gradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)' },
				{ name: 'تقنية الرواد', role: 'طالب الخدمة — العميل', initials: 'تق', gradient: 'linear-gradient(135deg,#FF8C69,#C0394A)' }
			],
			statusSteps: [
				{ label: 'رفع النزاع', state: 'done' },
				{ label: 'المراجعة الأولية', state: 'done' },
				{ label: 'اعتماد الإدارة', state: 'done' },
				{ label: 'الإقفال', state: 'done' }
			],
			info: [
				{ label: 'رقم النزاع', value: 'DSP-2026-009' },
				{ label: 'تاريخ الإغلاق', value: '12 مايو 2026' },
				{ label: 'حالة المبلغ', value: 'أُفرج بالكامل', valueClass: 'teal' }
			]
		},
		teamMember: { name: 'ريم الدوسري', role: 'تطوير متجر', initials: 'ري', gradient: 'linear-gradient(135deg,#0FA99A,#0D8A7E)' }
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
		},
		teamMember: { name: 'فهد العتيبي', role: 'استشارة تسويقية', initials: 'فه', gradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)' }
	}
];
