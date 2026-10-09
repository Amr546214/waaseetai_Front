// Where the marketer "استكمال البيانات" wizard opens, decided from the SAVED profile (GET /marketer/profile: completionPercentage + missingItems),
// never from a hard-coded step 1. Pure functions shared by the route guard, the wizard, the sidebar and the tests.
//
// Every wizard step is saved on its own, so what is saved is exactly what the backend reports. Wizard-fixable items: bio (step 2), channel
// (step 3), PayPal email (step 4). The avatar lives in the edit page.

export const MARKETER_EDIT_PAGE = '/marketer-overview/profile/data';
export const MARKETER_SETUP_PAGE = '/marketer-overview/profile-setup';

export interface MarketerSetupItem { key: string; status?: 'missing' | 'pending_review' | string }
export interface MarketerSetupData { completionPercentage?: number | null; missingItems?: MarketerSetupItem[] | null }

export type MarketerSetupResolution =
	| { kind: 'step'; step: 2 | 3 | 4 }
	| { kind: 'redirect'; reason: 'complete' | 'nothing-to-collect' };

const STEP_OF: Record<string, 2 | 3 | 4> = { bio: 2, channel: 3, payout: 4 };

export function resolveMarketerSetup(data: MarketerSetupData | null | undefined): MarketerSetupResolution {
	const d = data ?? {};
	if (Number(d.completionPercentage) >= 100) return { kind: 'redirect', reason: 'complete' };
	const missing = (d.missingItems ?? []).filter(i => (i.status ?? 'missing') === 'missing');
	for (const key of ['bio', 'channel', 'payout']) {
		if (missing.some(i => i.key === key)) return { kind: 'step', step: STEP_OF[key] };
	}
	// nothing the wizard collects is missing (what is left is the avatar)
	if (data && d.missingItems) return { kind: 'redirect', reason: 'nothing-to-collect' };
	// no report at all (an unusual answer): start at the beginning of the form steps
	return { kind: 'step', step: 2 };
}

export const MARKETER_SETUP_MESSAGE: Record<'complete' | 'nothing-to-collect', string> = {
	complete: 'ملفك التسويقي مكتمل 100% — يمكنك تعديل بياناتك من هنا.',
	'nothing-to-collect': 'لا يوجد ما يلزم استكماله هنا — ما تبقّى يُستكمل من صفحة الملف.',
};
