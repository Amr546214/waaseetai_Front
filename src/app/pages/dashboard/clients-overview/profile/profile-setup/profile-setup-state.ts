// Where the client "استكمال البيانات" wizard should open, decided from what is ALREADY SAVED (GET /client/profile/setup), never from a
// hard-coded step 1. Pure functions, so the route guard, the component and the tests share one rule.

export const CLIENT_EDIT_PAGE = '/client-overview/profile/edit';
export const CLIENT_SETUP_PAGE = '/client-overview/profile-setup';

export interface ClientSetupData {
	idNumber?: string | null;
	dob?: string | null;
	country?: string | null;
	city?: string | null;
	industry?: string | null;
	address?: string | null;
	paypalPayoutEmail?: string | null;
	accurateAgreed?: boolean | null;
	termsAgreed?: boolean | null;
	privacyAgreed?: boolean | null;
	kycStatus?: string | null;
	completionPercentage?: number | null;
}

/**
 * - `complete`: the profile is 100% — the wizard must not show at all.
 * - `nothing-to-collect`: everything the wizard collects is already saved (what is left, e.g. the avatar or the bio, lives in the edit page).
 * - `step`: the first step that is really missing: 1 (details) -> 3 (PayPal) -> 5 (agreements). Steps 2 (ID documents) and 4 (optional documents)
 *   never block: a document that was sent is "under review" (kycStatus PENDING), not "empty".
 */
export type ClientSetupResolution = { kind: 'step'; step: 1 | 3 | 5 } | { kind: 'redirect'; reason: 'complete' | 'nothing-to-collect' };

const filled = (v: unknown) => typeof v === 'string' ? v.trim().length > 0 : v !== null && v !== undefined && v !== '';

export function resolveClientSetup(data: ClientSetupData | null | undefined): ClientSetupResolution {
	const d = data ?? {};
	if (Number(d.completionPercentage) >= 100) return { kind: 'redirect', reason: 'complete' };
	const detailsMissing = !(filled(d.idNumber) && filled(d.dob) && filled(d.country) && filled(d.city) && filled(d.industry) && filled(d.address));
	if (detailsMissing) return { kind: 'step', step: 1 };
	if (!filled(d.paypalPayoutEmail)) return { kind: 'step', step: 3 };
	if (!(d.accurateAgreed && d.termsAgreed && d.privacyAgreed)) return { kind: 'step', step: 5 };
	return { kind: 'redirect', reason: 'nothing-to-collect' };
}

export const SETUP_REDIRECT_MESSAGE: Record<'complete' | 'nothing-to-collect', string> = {
	complete: 'ملفك مكتمل 100% — يمكنك تعديل بياناتك من هنا.',
	'nothing-to-collect': 'بيانات الاستكمال محفوظة بالفعل — أكمل ما تبقّى من صفحة تعديل الملف.',
};
