// The help pages of every role (/provider-overview/help…, /client-overview/help…, /marketer-overview/help…) have a GUIDED assistant (FAQ navigator): no free text, no
// model call. Bebo shows ready choices for the role, each with a short ready answer from the help-centre content, a link to the right page when there is one, and a
// single, always-present way to the human support. Everywhere else (the rest of the dashboards) Bebo is unchanged.
export type HelpRole = 'provider' | 'client' | 'marketer';

export interface GuidedLink { label: string; route: string; queryParams?: Record<string, string> }
export interface GuidedAnswer { id: string; question: string; answer: string; links?: GuidedLink[] }
export interface GuidedSupport { support: GuidedLink | null; ticket: GuidedLink }

export const PROVIDER_HELP_ROUTES = {
	disputes: '/provider-overview/disputes',
	wallet: '/provider-overview/finance/wallet',
	withdraw: '/provider-overview/finance/withdraw',
	explore: '/provider-overview/explore-requests',
	tickets: '/provider-overview/help/tickets',
	newTicket: '/provider-overview/help/tickets/new',
	liveSupport: '/provider-overview/help/live-support',
} as const;

export const CLIENT_HELP_ROUTES = {
	createRequest: '/client-overview/create-request',
	myRequests: '/client-overview/my-requests',
	activeProjects: '/client-overview/projects/active',
	disputes: '/client-overview/disputes',
	tickets: '/client-overview/help/tickets',
	newTicket: '/client-overview/help/tickets/new',
	liveSupport: '/client-overview/help/live-support',
} as const;

export const MARKETER_HELP_ROUTES = {
	refLinks: '/marketer-overview/ref-links',
	commissions: '/marketer-overview/commissions',
	withdraw: '/marketer-overview/withdraw',
	referrals: '/marketer-overview/referrals',
	/** The marketer's tickets live on the help page itself: this opens its new-ticket form. */
	help: '/marketer-overview/help',
} as const;

const P = PROVIDER_HELP_ROUTES, C = CLIENT_HELP_ROUTES, M = MARKETER_HELP_ROUTES;
const OTHER_ANSWER = 'لهذه المشكلة تواصل مع الفريق مباشرة: افتح تذكرة دعم أو تواصل مع الدعم البشري من الأزرار أدناه ليساعدك.';

export function guidedCatalog(role: HelpRole = 'provider'): GuidedAnswer[] {
	if (role === 'client') {
		return [
			{ id: 'create', question: 'إنشاء طلب', answer: 'اضغط «إنشاء طلب»، اكتب عنوان الطلب ووصفه واختر التخصص والميزانية والمدة، وراجع الملخص ثم انشره ليصل إلى مقدّمي الخدمة المناسبين.', links: [{ label: 'إنشاء طلب جديد', route: C.createRequest }] },
			{ id: 'offer', question: 'اختيار عرض', answer: 'تُعرض العروض حسب توافقها مع طلبك والسعر وتقييم المقدّم وزمن التسليم. قارن بينها وافتح تفاصيل كل عرض، ويبقى اختيار العرض قرارك أنت.', links: [{ label: 'طلباتي وعروضها', route: C.myRequests }] },
			{ id: 'guarantee', question: 'الضمان المالي', answer: 'يُحتجز المبلغ في حساب ضمان فور توقيع العقد، ولا يصل إلى مقدّم الخدمة إلا بعد قبولك للتسليم. إن لم يكتمل العمل تستردّ مبلغك وفق شروط العقد ومراجعة الفريق المختص.' },
			{ id: 'project', question: 'متابعة المشروع', answer: 'تتابع مراحل مشروعك وتسليماته من صفحة المشاريع النشطة، وتقبل التسليم أو تطلب تعديلًا عند كل مرحلة.', links: [{ label: 'المشاريع النشطة', route: C.activeProjects }] },
			{ id: 'dispute', question: 'النزاعات', answer: 'افتح نزاعًا من صفحة النزاعات وأرفق الأدلة. يبقى المبلغ محتجزًا في الضمان حتى يصدر الفريق المختص قراره بعد مراجعة الطرفين والأدلة.', links: [{ label: 'فتح صفحة النزاعات', route: C.disputes }] },
			{ id: 'tickets', question: 'التذاكر والدعم', answer: 'لأي مشكلة تحتاج متابعة افتح تذكرة دعم وسيصلك الرد من الفريق، وتتابع كل تذاكرك وحالتها من صفحة التذاكر.', links: [{ label: 'تذاكري', route: C.tickets }] },
			{ id: 'other', question: 'مشكلة أخرى / التواصل مع الدعم البشري', answer: OTHER_ANSWER },
		];
	}
	if (role === 'marketer') {
		return [
			{ id: 'link', question: 'رابط الإحالة', answer: 'تجد رابط الإحالة الخاص بك في صفحة الروابط. شاركه، وكل تسجيل يتم عبره يُحتسب لك. إن لم يعمل الرابط فافتح تذكرة دعم مع ذكر الرابط.', links: [{ label: 'فتح الروابط', route: M.refLinks }] },
			{ id: 'commission', question: 'العمولات', answer: 'تُحتسب عمولتك من الإحالات الناجحة بنسبة مستواك الحالي، وتظهر نسبة المستوى بجانب اسمه في لوحتك، وتجد كل عمولة في صفحة العمولات.', links: [{ label: 'فتح العمولات', route: M.commissions }] },
			{ id: 'withdraw', question: 'السحب', answer: 'تطلب السحب من صفحة السحب عندما يبلغ رصيدك الحد الأدنى، وتخضع طلبات السحب لمراجعة قبل التنفيذ.', links: [{ label: 'فتح السحب', route: M.withdraw }] },
			{ id: 'referrals', question: 'حالة الإحالات', answer: 'تتابع كل إحالة وحالتها (قيد الانتظار أو ناجحة) من صفحة الإحالات.', links: [{ label: 'فتح الإحالات', route: M.referrals }] },
			{ id: 'tickets', question: 'التذاكر والدعم', answer: 'لأي مشكلة تحتاج متابعة افتح تذكرة دعم من صفحة المساعدة، وتجد تذاكرك وردودها في قسم «تذاكري» في الصفحة نفسها. زر فتح التذكرة أدناه.' },
			{ id: 'other', question: 'مشكلة أخرى / التواصل مع الدعم البشري', answer: OTHER_ANSWER },
		];
	}
	return [
		{ id: 'guarantee', question: 'الضمان المالي', answer: 'يُحتجز مبلغ العقد في حساب ضمان فور توقيع العقد، ولا يصلك إلا بعد قبول العميل للتسليم. إن لم يكتمل العمل يراجع الفريق المختص الحالة وفق شروط العقد.' },
		{ id: 'offer', question: 'تقديم عرض', answer: 'افتح «طلبات العملاء والعروض»، واختر طلبًا يناسب تخصصك، ثم اضغط تقديم عرض وأدخل السعر والمدة والوصف، وراجع ملخص العرض قبل الإرسال.', links: [{ label: 'استكشاف الطلبات', route: P.explore }] },
		{ id: 'payout', question: 'سحب الأرباح', answer: 'تظهر أرباحك المتاحة في محفظتك. اطلب السحب من صفحة السحب عندما يبلغ رصيدك الحد الأدنى، وتخضع طلبات السحب لمراجعة قبل التنفيذ.', links: [{ label: 'فتح المحفظة', route: P.wallet }, { label: 'طلب سحب', route: P.withdraw }] },
		{ id: 'dispute', question: 'النزاعات', answer: 'افتح نزاعًا من صفحة النزاعات وأرفق الأدلة. يبقى المبلغ محتجزًا في الضمان حتى يصدر الفريق المختص قراره بعد مراجعة الطرفين والأدلة.', links: [{ label: 'فتح صفحة النزاعات', route: P.disputes }] },
		{ id: 'tickets', question: 'التذاكر والدعم', answer: 'لأي مشكلة تحتاج متابعة افتح تذكرة دعم وسيصلك الرد من الفريق، وتتابع كل تذاكرك وحالتها من صفحة التذاكر.', links: [{ label: 'تذاكري', route: P.tickets }] },
		{ id: 'other', question: 'مشكلة أخرى / التواصل مع الدعم البشري', answer: OTHER_ANSWER },
	];
}

/** The support exits, shown ONCE under the choices (never repeated inside an answer). The marketer has no live-support page: only the ticket form. */
export function guidedSupport(role: HelpRole = 'provider'): GuidedSupport {
	if (role === 'client') return { support: { label: 'التواصل مع الدعم البشري', route: C.liveSupport }, ticket: { label: 'فتح تذكرة دعم', route: C.newTicket } };
	if (role === 'marketer') return { support: null, ticket: { label: 'فتح تذكرة دعم', route: M.help, queryParams: { ticket: '1' } } };
	return { support: { label: 'التواصل مع الدعم البشري', route: P.liveSupport }, ticket: { label: 'فتح تذكرة دعم', route: P.newTicket } };
}

/** Guided mode applies to each role's help section only: /<role>-overview/help and its sub-pages. */
export function helpRoleOfUrl(url: string | null | undefined): HelpRole | null {
	const m = /^\/(provider|client|marketer)-overview\/help(?:[\/?#]|$)/.exec(url || '');
	return m ? (m[1] as HelpRole) : null;
}
