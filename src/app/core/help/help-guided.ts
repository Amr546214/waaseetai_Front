// The PROVIDER help page (/provider-overview/help…) has a GUIDED assistant (FAQ navigator): no free text, no model call. Bebo shows ready choices, each with a short
// ready answer from the help-centre content and a clear way to the human support. Everywhere else Bebo is unchanged (client / marketer / admin help pages and the
// other dashboard pages keep the normal chat).
export type HelpRole = 'provider';

export interface GuidedAnswer { id: string; question: string; answer: string; links?: { label: string; route: string }[] }

export const PROVIDER_HELP_ROUTES = {
	disputes: '/provider-overview/disputes',
	wallet: '/provider-overview/finance/wallet',
	withdraw: '/provider-overview/finance/withdraw',
	explore: '/provider-overview/explore-requests',
	tickets: '/provider-overview/help/tickets',
	newTicket: '/provider-overview/help/tickets/new',
	liveSupport: '/provider-overview/help/live-support',
} as const;

const R = PROVIDER_HELP_ROUTES;

export function guidedCatalog(_role: HelpRole = 'provider'): GuidedAnswer[] {
	return [
		{ id: 'guarantee', question: 'الضمان المالي', answer: 'يُحتجز مبلغ العقد في حساب ضمان فور توقيع العقد، ولا يصلك إلا بعد قبول العميل للتسليم. إن لم يكتمل العمل يراجع الفريق المختص الحالة وفق شروط العقد.' },
		{ id: 'offer', question: 'تقديم عرض', answer: 'افتح «طلبات العملاء والعروض»، واختر طلبًا يناسب تخصصك، ثم اضغط تقديم عرض وأدخل السعر والمدة والوصف، وراجع ملخص العرض قبل الإرسال.', links: [{ label: 'استكشاف الطلبات', route: R.explore }] },
		{ id: 'payout', question: 'سحب الأرباح', answer: 'تظهر أرباحك المتاحة في محفظتك. اطلب السحب من صفحة السحب عندما يبلغ رصيدك الحد الأدنى، وتخضع طلبات السحب لمراجعة قبل التنفيذ.', links: [{ label: 'فتح المحفظة', route: R.wallet }, { label: 'طلب سحب', route: R.withdraw }] },
		{ id: 'dispute', question: 'النزاعات', answer: 'افتح نزاعًا من صفحة النزاعات وأرفق الأدلة. يبقى المبلغ محتجزًا في الضمان حتى يصدر الفريق المختص قراره بعد مراجعة الطرفين والأدلة.', links: [{ label: 'فتح صفحة النزاعات', route: R.disputes }] },
		{ id: 'tickets', question: 'التذاكر والدعم', answer: 'لأي مشكلة تحتاج متابعة افتح تذكرة دعم وسيصلك الرد من الفريق، وتتابع كل تذاكرك وحالتها من صفحة التذاكر.', links: [{ label: 'فتح تذكرة دعم', route: R.newTicket }, { label: 'تذاكري', route: R.tickets }] },
		{ id: 'other', question: 'مشكلة أخرى / التواصل مع الدعم البشري', answer: 'لهذه المشكلة تواصل مع الفريق مباشرة. افتح تذكرة دعم أو تواصل مع الدعم البشري ليساعدك.', links: [{ label: 'فتح تذكرة دعم', route: R.newTicket }, { label: 'التواصل مع الدعم البشري', route: R.liveSupport }] },
	];
}

/** The two support exits shown under the list. */
export function guidedSupport(): { support: { label: string; route: string }; ticket: { label: string; route: string } } {
	return { support: { label: 'التواصل مع الدعم البشري', route: R.liveSupport }, ticket: { label: 'فتح تذكرة دعم', route: R.newTicket } };
}

/** Guided mode applies to the provider help section only: /provider-overview/help and its sub-pages. */
export function helpRoleOfUrl(url: string | null | undefined): HelpRole | null {
	return /^\/provider-overview\/help(?:[\/?#]|$)/.test(url || '') ? 'provider' : null;
}
