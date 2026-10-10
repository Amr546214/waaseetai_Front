// Where the individual provider's "استكمال البيانات" wizard opens, decided from what is ALREADY SAVED (GET /provider/profile/setup), never from a
// hard-coded step 1. Pure functions shared by the route guard, the component and the tests.
//
// The wizard has 7 steps and two saved milestones: the form (steps 1-6) is saved in ONE request at step 6 (-> isProfileSetupComplete), then
// step 7 is the classification test (-> setupTestStatus COMPLETED). "Complete" therefore means BOTH are done — a provider at 100% completion
// who has not taken the test still has the test step to do.

export const PROVIDER_EDIT_PAGE = '/provider-overview/profile/data';
export const PROVIDER_SETUP_PAGE = '/provider-overview/profile/setup';

export interface ProviderSetupData {
	headline?: string | null;
	industry?: string | null;
	yearsOfExperience?: number | null;
	country?: string | null;
	city?: string | null;
	bio?: string | null;
	mainSpecialty?: string | null;
	subSpecialties?: string[] | null;
	paypalPayoutEmail?: string | null;
	frontIdUrl?: string | null;
	frontIdUrlAccess?: { private?: boolean } | null;
	kycStatus?: string | null;
	/** the admin's reason when kycStatus is REJECTED */
	kycRejectionReason?: string | null;
	portfolioItems?: Array<{ title?: string | null; description?: string | null }> | null;
	isProfileSetupComplete?: boolean | null;
	setupTestStatus?: string | null;
}

export type ProviderSetupResolution = { kind: 'step'; step: 1 | 2 | 3 | 4 | 5 | 6 | 7 } | { kind: 'redirect'; reason: 'complete' };

const filled = (v: unknown) => typeof v === 'string' ? v.trim().length > 0 : v !== null && v !== undefined && v !== '';
const specOf = (title?: string | null) => String(title || '').replace(/^نموذج أعمال\s*-\s*/, '').trim();

export function resolveProviderSetup(data: ProviderSetupData | null | undefined): ProviderSetupResolution {
	const d = data ?? {};
	const testDone = d.setupTestStatus === 'COMPLETED';
	// a rejected identity review while the wizard is still in progress opens the documents step first (reason shown, files can be sent again)
	if (d.kycStatus === 'REJECTED' && !d.isProfileSetupComplete) return { kind: 'step', step: 4 };
	if (d.isProfileSetupComplete && testDone) return { kind: 'redirect', reason: 'complete' };
	// everything was submitted: only the classification test is left
	if (d.isProfileSetupComplete) return { kind: 'step', step: 7 };

	if (!(filled(d.headline) || filled(d.industry)) || !d.yearsOfExperience || !filled(d.country) || !filled(d.city) || !filled(d.bio)) return { kind: 'step', step: 1 };
	const subs = Array.isArray(d.subSpecialties) ? d.subSpecialties.filter(Boolean) : [];
	if (!filled(d.mainSpecialty) || subs.length === 0) return { kind: 'step', step: 2 };
	if (!filled(d.paypalPayoutEmail)) return { kind: 'step', step: 3 };
	// an ID document that was sent counts (a private one is not visible here, only marked); "under review" is not "missing"
	if (!filled(d.frontIdUrl) && !d.frontIdUrlAccess?.private) return { kind: 'step', step: 4 };
	const withSample = new Set((d.portfolioItems ?? []).filter(i => filled(i?.description)).map(i => specOf(i?.title)));
	if (!subs.every(s => withSample.has(s))) return { kind: 'step', step: 5 };
	return { kind: 'step', step: 6 };
}

export const PROVIDER_SETUP_REDIRECT_MESSAGE = 'بيانات الاستكمال والاختبار مكتملة — يمكنك تعديل ملفك المهني من هنا.';
