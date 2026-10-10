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
	supportingDocsUrl?: string | null;
	supportingDocsUrlAccess?: { private?: boolean } | null;
	notes?: string | null;
	kycStatus?: string | null;
	/** the admin's reason when kycStatus is REJECTED */
	kycRejectionReason?: string | null;
	completionPercentage?: number | null;
}

/**
 * - `complete`: the profile is 100% — the wizard must not show at all.
 * - `nothing-to-collect`: everything the wizard collects is already saved (what is left, e.g. the avatar or the bio, lives in the edit page).
 * - `step`: a REJECTED identity review always opens step 2 (ID documents) first, with the admin's reason; otherwise the first step that is really missing, from what each "التالي" stored: 1 (details) -> 3 (PayPal) -> 4 (optional documents) -> 5 (final review). Steps 2 (ID documents) and 4 (optional documents)
 *   never block: a document that was sent is "under review" (kycStatus PENDING), not "empty".
 */
export type ClientSetupResolution = { kind: 'step'; step: 1 | 2 | 3 | 4 | 5 } | { kind: 'redirect'; reason: 'complete' | 'nothing-to-collect' };

const filled = (v: unknown) => typeof v === 'string' ? v.trim().length > 0 : v !== null && v !== undefined && v !== '';

export function resolveClientSetup(data: ClientSetupData | null | undefined): ClientSetupResolution {
	const d = data ?? {};
	// a rejected review is work for the user even at 100%: open the documents step so the reason is seen and the files can be sent again
	if (d.kycStatus === 'REJECTED') return { kind: 'step', step: 2 };
	if (Number(d.completionPercentage) >= 100) return { kind: 'redirect', reason: 'complete' };
	const detailsMissing = !(filled(d.idNumber) && filled(d.dob) && filled(d.country) && filled(d.city) && filled(d.industry) && filled(d.address));
	if (detailsMissing) return { kind: 'step', step: 1 };
	if (!filled(d.paypalPayoutEmail)) return { kind: 'step', step: 3 };
	if (!(d.accurateAgreed && d.termsAgreed && d.privacyAgreed)) {
		// details + PayPal are saved (each step is stored when the user moves on): the user is standing at the optional documents (4), or, when
		// something was already saved there, at the final review (5). Step 2 (ID documents) is optional and never decides where to open.
		const step4Saved = filled(d.supportingDocsUrl) || !!d.supportingDocsUrlAccess?.private || filled(d.notes);
		return { kind: 'step', step: step4Saved ? 5 : 4 };
	}
	return { kind: 'redirect', reason: 'nothing-to-collect' };
}

export const SETUP_REDIRECT_MESSAGE: Record<'complete' | 'nothing-to-collect', string> = {
	complete: 'ملفك مكتمل 100% — يمكنك تعديل بياناتك من هنا.',
	'nothing-to-collect': 'بيانات الاستكمال محفوظة بالفعل — أكمل ما تبقّى من صفحة تعديل الملف.',
};
