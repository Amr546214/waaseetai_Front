import { UserRole } from '../models/auth.model';

const ASK = /(اشرح|شرح|اشرحلي|اشرحلى|عرفني|عرّفني|وريني|ورّيني|علمني|علّمني|جولة|جوله|تعريف)/;
const PANEL = /(لوحة|لوحه|لوحتي|لوحتى|داشبورد|الداشبورد|dashboard)/i;
const ROLE_WORDS: Array<[UserRole, RegExp]> = [
	[UserRole.CLIENT, /(طالب\s*الخدم|العميل|طالب خدمة)/],
	[UserRole.PROVIDER, /(مقدم\s*الخدم|مزود|مقدم خدمة|المنفذ)/],
	[UserRole.AFFILIATE, /(مسوق|المسوّق|التسويق)/],
];

/**
 * «اشرحلي لوحة طالب الخدمة»: a request to be shown the dashboard. Returns the role whose tour to run, or null when the text is not such a request.
 * A named role other than the one the person is acting as is NOT matched (that dashboard is not theirs): the question goes to the assistant as usual.
 */
export function tourIntentFor(question: string, actingRole: UserRole | null): UserRole | null {
	const q = question.trim();
	if (!q || q.length > 120 || !ASK.test(q) || !PANEL.test(q) || !actingRole) return null;
	const named = ROLE_WORDS.find(([, re]) => re.test(q))?.[0];
	return !named || named === actingRole ? actingRole : null;
}

/** cheap text-only pre-check (no auth lookup): could this be an explain-the-dashboard request? */
export const mayBeTourRequest = (question: string): boolean => { const q = question.trim(); return q.length > 0 && q.length <= 120 && ASK.test(q) && PANEL.test(q); };
