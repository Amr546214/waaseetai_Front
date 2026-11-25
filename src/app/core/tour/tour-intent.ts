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

const THIS_PAGE = /(الصفحة|الصفحه|صفحة|صفحه|هنا|دي|دى|الحالية)/;
/** «صفحة <something other than «دي/هذه»>»: the person names a page, so «this page» must not be assumed */
const OTHER_PAGE = /صفح[ةه]\s+(?!دي|دى|هذه|هذا|الحالي|هنا)\S+/;
const NAMED_PAGES: Array<[string, RegExp]> = [
	['/blog', /(مدونة|المدونة|مدونه|المدونه|blog)/i],
	['/about', /(من\s*نحن|عن\s*وسيط|about)/i],
	['/contact', /(اتصل\s*بنا|تواصل\s*معنا|contact)/i],
	['/marketplace', /(السوق|سوق\s*الخدمات|تسوق\s*الخدمات|تصفح\s*الخدمات|صفح[ةه]\s*(ال)?خدمات|marketplace)/i],
];
/** the page a «اشرح المدونة» / «اشرحلي صفحة من نحن» question names, or null */
export function namedTourPage(question: string): string | null {
	const q = question.trim();
	if (!q || q.length > 120 || !ASK.test(q) || PANEL.test(q)) return null;
	return NAMED_PAGES.find(([, re]) => re.test(q))?.[0] ?? null;
}
/** «اشرحلي الصفحة دي» / «جولة في الصفحة» / «اشرح المدونة»: a request for a page tour (the current page, or the named one) and not a dashboard */
export const isPageTourRequest = (question: string): boolean => { const q = question.trim(); return q.length > 0 && q.length <= 120 && ASK.test(q) && !PANEL.test(q) && (namedTourPage(q) !== null || (THIS_PAGE.test(q) && !OTHER_PAGE.test(q))); };
