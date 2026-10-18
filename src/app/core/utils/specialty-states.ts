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
	/** Seconds until the test can be retaken (cooldown after a failed attempt), when the backend says so. */
	retryAfterSeconds?: number | null;
	/** The attempt limit (per 30 days) is reached: no retake for now. */
	attemptLimitReached?: boolean;
}

export const SPECIALTIES_PAGE = '/provider-overview/profile/specialties';

export const SPECIALTY_STATE_TEXT: Readonly<Record<Exclude<RegisteredSpecialtyState, 'PASSED'>, string>> = {
	TEST_NOT_TAKEN: 'مسجّل، ولم تُجرِ اختبار هذا التخصص بعد',
	TEST_NOT_PASSED: 'أجريت الاختبار ولم تتجاوزه، يمكنك إعادة المحاولة',
	REJECTED: 'تم رفض هذا التخصص، راجع سبب الرفض وأعد التقديم',
	LOCKED_OUT: 'الاختبار مقفل مؤقتًا لهذا التخصص، حاول مجددًا بعد انتهاء مدة القفل',
};

/** "يمكنك إعادة الاختبار بعد X ساعة" (hours rounded up; under an hour says so). */
export function retryAfterText(seconds: number): string {
	const hours = Math.ceil(seconds / 3600);
	return hours <= 1 ? 'يمكنك إعادة الاختبار بعد أقل من ساعة' : `يمكنك إعادة الاختبار بعد ${hours} ساعة`;
}
export const ATTEMPT_LIMIT_TEXT = 'وصلت للحد الأقصى لمحاولات هذا الاختبار خلال 30 يومًا، يمكنك المحاولة لاحقًا';

/** The text of a registered specialty that cannot be selected yet: its state, with the wait when the backend reports one. */
export function registeredStateText(r: Pick<RegisteredSpecialty, 'state' | 'retryAfterSeconds' | 'attemptLimitReached'>): string {
	if (r.state === 'PASSED') return '';
	if (r.attemptLimitReached && (r.state === 'TEST_NOT_PASSED' || r.state === 'REJECTED')) return ATTEMPT_LIMIT_TEXT;
	if ((r.state === 'TEST_NOT_PASSED' || r.state === 'REJECTED') && r.retryAfterSeconds && r.retryAfterSeconds > 0) return `أجريت الاختبار ولم تتجاوزه. ${retryAfterText(r.retryAfterSeconds)}`;
	return SPECIALTY_STATE_TEXT[r.state];
}

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
		.map((r) => ({ name: r.name, text: registeredStateText(r), state: r.state }));
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

// ── Approval state: the test, the samples and the admin decision are three different things (BE: utils/specialty-approval-state.ts). ──
export type SpecialtyApprovalState =
	| 'APPROVED' | 'LOCKED' | 'TEST_NOT_TAKEN' | 'TEST_NOT_PASSED' | 'REJECTED'
	| 'PASSED_NO_SAMPLES' | 'DRAFT_SAMPLES' | 'SAMPLES_UNDER_REVIEW' | 'SAMPLES_REJECTED';

export interface SpecialtyApprovalInfo { approvalState?: SpecialtyApprovalState | null; rejectionReason?: string | null; retryAfterSeconds?: number | null; attemptLimitReached?: boolean }

export const ACCREDITATION_NEW_PAGE = '/provider-overview/business-models/accreditation/new';

export interface ApprovalView { label: string; detail: string; tone: 'ok' | 'wait' | 'bad' | 'todo'; ctaLabel: string | null; ctaLink: string | null }

/** "معتمد" only for a real admin approval; a passed test or uploaded samples are never called approved. */
export function approvalView(info: SpecialtyApprovalInfo | null | undefined): ApprovalView {
	const reason = info?.rejectionReason ? ` السبب: ${info.rejectionReason}` : '';
	switch (info?.approvalState) {
		case 'APPROVED': return { label: 'معتمد', detail: 'اعتمدت الإدارة هذا التخصص ونماذجه.', tone: 'ok', ctaLabel: null, ctaLink: null };
		case 'SAMPLES_UNDER_REVIEW': return { label: 'نماذجك قيد مراجعة الإدارة', detail: 'اجتزت الاختبار وأرسلت نماذج الاعتماد. لا يُعتمد التخصص إلا بقرار الإدارة.', tone: 'wait', ctaLabel: 'متابعة طلبات الاعتماد', ctaLink: '/provider-overview/business-models/accreditation/list' };
		case 'SAMPLES_REJECTED': return { label: 'تم رفض بعض النماذج', detail: `يمكنك إعادة الإرسال بعد التعديل.${reason}`, tone: 'bad', ctaLabel: 'إعادة إرسال نموذج اعتماد', ctaLink: ACCREDITATION_NEW_PAGE };
		case 'DRAFT_SAMPLES': return { label: 'نماذج محفوظة (مسودة)', detail: 'اجتزت الاختبار وحفظت نماذجك، لكنها لم تُرسَل بعد لطابور مراجعة الإدارة. أرسل نموذج اعتماد لتبدأ المراجعة.', tone: 'todo', ctaLabel: 'إرسال نموذج اعتماد', ctaLink: ACCREDITATION_NEW_PAGE };
		case 'PASSED_NO_SAMPLES': return { label: 'اجتزت الاختبار — لم ترفع نماذج بعد', detail: 'الاختبار وحده لا يعني الاعتماد. ارفع نموذج اعتماد ليراجعه فريق وسيط.', tone: 'todo', ctaLabel: 'رفع نموذج اعتماد', ctaLink: ACCREDITATION_NEW_PAGE };
		case 'TEST_NOT_TAKEN': return { label: 'لم تُجرِ اختبار هذا التخصص بعد', detail: SPECIALTY_STATE_TEXT.TEST_NOT_TAKEN, tone: 'todo', ctaLabel: 'إجراء الاختبار', ctaLink: SPECIALTIES_PAGE };
		case 'TEST_NOT_PASSED': {
			const waiting = !!info.attemptLimitReached || (info.retryAfterSeconds ?? 0) > 0;
			return { label: 'لم تتجاوز الاختبار', detail: waiting ? registeredStateText({ state: 'TEST_NOT_PASSED', retryAfterSeconds: info.retryAfterSeconds, attemptLimitReached: info.attemptLimitReached }) : SPECIALTY_STATE_TEXT.TEST_NOT_PASSED, tone: 'bad', ctaLabel: waiting ? null : 'إعادة المحاولة', ctaLink: waiting ? null : SPECIALTIES_PAGE };
		}
		case 'REJECTED': {
			const waiting = !!info.attemptLimitReached || (info.retryAfterSeconds ?? 0) > 0;
			return { label: 'تم رفض هذا التخصص', detail: `${waiting ? registeredStateText({ state: 'REJECTED', retryAfterSeconds: info.retryAfterSeconds, attemptLimitReached: info.attemptLimitReached }) : SPECIALTY_STATE_TEXT.REJECTED}${reason}`, tone: 'bad', ctaLabel: waiting ? null : 'إعادة التقديم', ctaLink: waiting ? null : SPECIALTIES_PAGE };
		}
		case 'LOCKED': return { label: 'مقفل مؤقتًا', detail: SPECIALTY_STATE_TEXT.LOCKED_OUT, tone: 'bad', ctaLabel: null, ctaLink: null };
		default: return { label: 'بانتظار الاعتماد', detail: '', tone: 'wait', ctaLabel: null, ctaLink: null };
	}
}

/** Short tag for the selectors (a passed specialty listed to pick): approved / under review / what is missing. */
/** Percent for display: at most 1 decimal (same rule as the specialty test result, `number:'1.0-1'`), Latin digits like the rest of the UI; '' for null / NaN / non-finite. */
export function formatPercent(value: number | string | null | undefined): string {
	if (value === null || value === undefined || value === '') return '';
	const n = Number(value);
	if (!Number.isFinite(n)) return '';
	return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(n)}%`;
}

export function approvalTag(info: SpecialtyApprovalInfo | null | undefined, score?: number | null): string {
	const p = score ? formatPercent(score) : '';
	const s = p ? ` ${p}` : '';
	switch (info?.approvalState) {
		case 'APPROVED': return `✓ معتمد${s}`;
		case 'SAMPLES_UNDER_REVIEW': return `⏳ نماذجك قيد مراجعة الإدارة${s}`;
		case 'SAMPLES_REJECTED': return '⚠ تم رفض بعض النماذج — أعد الإرسال';
		case 'DRAFT_SAMPLES': return `✓ اجتزت الاختبار${s} · النماذج مسودة، أرسل نموذج اعتماد`;
		case 'PASSED_NO_SAMPLES': return `✓ اجتزت الاختبار${s} — ارفع نموذج اعتماد`;
		default: return `✓ اجتزت الاختبار${s} · بانتظار اعتماد الأدمن`;
	}
}
