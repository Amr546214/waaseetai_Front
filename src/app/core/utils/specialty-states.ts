// What the upload / accreditation selectors say when no specialty is selectable. The backend (GET /accreditation/passed-specialties) returns EVERY
// specialty registered on the account (signup choices included) with its state, so "you have no specialty" is only said when there truly is none.
export type RegisteredSpecialtyState = 'PASSED' | 'TEST_NOT_TAKEN' | 'TEST_NOT_PASSED' | 'REJECTED' | 'LOCKED_OUT';

export interface RegisteredSpecialty {
	id?: string;
	specialtyId: string;
	name: string;
	categoryName?: string;
	state: RegisteredSpecialtyState;
	latestScore?: number | null;
}

export const SPECIALTIES_PAGE = '/provider-overview/profile/specialties';

export const SPECIALTY_STATE_TEXT: Readonly<Record<Exclude<RegisteredSpecialtyState, 'PASSED'>, string>> = {
	TEST_NOT_TAKEN: 'مسجّل، ولم تُجرِ اختبار هذا التخصص بعد',
	TEST_NOT_PASSED: 'أجريت الاختبار ولم تتجاوزه، يمكنك إعادة المحاولة',
	REJECTED: 'تم رفض هذا التخصص، راجع سبب الرفض وأعد التقديم',
	LOCKED_OUT: 'الاختبار مقفل مؤقتًا لهذا التخصص، حاول مجددًا بعد انتهاء مدة القفل',
};

export interface SpecialtyEmptyView {
	title: string;
	body: string;
	items: { name: string; text: string; state: Exclude<RegisteredSpecialtyState, 'PASSED'> }[];
	ctaLabel: string;
	ctaLink: string;
}

/** The message for "nothing selectable": none registered at all, or the registered ones with each one's real state. */
export function specialtyEmptyView(registered: readonly RegisteredSpecialty[] | null | undefined): SpecialtyEmptyView {
	const items = (registered ?? []).filter((r): r is RegisteredSpecialty & { state: Exclude<RegisteredSpecialtyState, 'PASSED'> } => r.state !== 'PASSED')
		.map((r) => ({ name: r.name, text: SPECIALTY_STATE_TEXT[r.state], state: r.state }));
	if (!items.length) {
		return { title: 'لا يوجد لديك تخصص مسجّل', body: 'أضف تخصصك من صفحة التخصصات ثم أجرِ اختباره لتتمكن من رفع أعمالك ونشر خدماتك.', items: [], ctaLabel: 'الذهاب إلى التخصصات', ctaLink: SPECIALTIES_PAGE };
	}
	const onlyLocked = items.every((i) => i.state === 'LOCKED_OUT');
	return {
		title: 'تخصصاتك المسجّلة لم تكتمل بعد',
		body: 'هذه حالة كل تخصص من تخصصاتك، ولا حاجة لإعادة التسجيل من البداية.',
		items,
		ctaLabel: onlyLocked ? 'عرض حالة التخصصات' : 'إكمال التخصصات',
		ctaLink: SPECIALTIES_PAGE,
	};
}
