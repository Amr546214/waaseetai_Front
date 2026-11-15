// Where the marketer "استكمال البيانات" wizard opens, decided from the SAVED profile (GET /marketer/profile: completionPercentage + missingItems),
// never from a hard-coded step 1. Pure functions shared by the route guards, the wizard, the sidebar and the tests.
//
// Required onboarding items before entering the marketer dashboard: avatar + bio (step 2) and one channel (step 3).
// PayPal email (step 4) remains optional and can be completed later from profile-setup or the edit page.

export const MARKETER_EDIT_PAGE = '/marketer-overview/profile/data';
export const MARKETER_SETUP_PAGE = '/marketer-overview/profile-setup';
export const MARKETER_ONBOARDING_ALLOWED_PATHS: readonly string[] = ['profile-setup', 'help', 'notifications', 'bebo'];

export interface MarketerSetupItem { key: string; status?: 'missing' | 'pending_review' | string }
export interface MarketerSetupData {
	completionPercentage?: number | null;
	missingItems?: MarketerSetupItem[] | null;
	avatarUrl?: string | null;
	bio?: string | null;
	marketingChannels?: readonly unknown[] | null;
	user?: { avatarUrl?: string | null } | null;
}

export type MarketerSetupResolution =
	| { kind: 'step'; step: 2 | 3 | 4 }
	| { kind: 'redirect'; reason: 'complete' | 'nothing-to-collect' };

const STEP_OF: Record<string, 2 | 3 | 4> = { avatar: 2, bio: 2, channel: 3, payout: 4 };
const REQUIRED_SETUP_KEYS = ['avatar', 'bio', 'channel'] as const;

export function isMarketerOnboardingAllowedPath(url: string): boolean {
	const path = (url || '').split(/[?#]/)[0].replace(/^\/?marketer-overview\/?/, '').replace(/^\/+|\/+$/g, '');
	return MARKETER_ONBOARDING_ALLOWED_PATHS.some(p => path === p || path.startsWith(p + '/'));
}

function hasMissingItem(data: MarketerSetupData | null | undefined, key: string): boolean {
	return (data?.missingItems ?? []).some(i => i.key === key && (i.status ?? 'missing') === 'missing');
}

function isDirectRequiredMissing(data: MarketerSetupData, key: typeof REQUIRED_SETUP_KEYS[number]): boolean {
	if (key === 'avatar' && ('avatarUrl' in data || 'user' in data)) {
		return !(data.avatarUrl ?? data.user?.avatarUrl ?? '').trim();
	}
	if (key === 'bio' && 'bio' in data) {
		return !(data.bio ?? '').trim();
	}
	if (key === 'channel' && 'marketingChannels' in data) {
		return !Array.isArray(data.marketingChannels) || data.marketingChannels.length === 0;
	}
	return false;
}

function hasAnyRequiredMissing(data: MarketerSetupData): boolean {
	return REQUIRED_SETUP_KEYS.some(key => hasMissingItem(data, key) || isDirectRequiredMissing(data, key));
}

/**
 * Whether the marketer has finished the required onboarding items (avatar, bio, and one channel)
 * needed to enter the dashboard. PayPal stays optional.
 */
export function isMarketerOnboardingComplete(data: MarketerSetupData | null | undefined): boolean {
	if (!data) return false;
	if (REQUIRED_SETUP_KEYS.some(key => hasMissingItem(data, key))) return false;
	if (Number(data.completionPercentage) >= 100) return true;
	if (REQUIRED_SETUP_KEYS.some(key => isDirectRequiredMissing(data, key))) return false;
	const hasAllDirectFields = ('avatarUrl' in data || 'user' in data) && 'bio' in data && 'marketingChannels' in data;
	return !!data.missingItems || hasAllDirectFields;
}

export function resolveMarketerSetup(data: MarketerSetupData | null | undefined): MarketerSetupResolution {
	const d = data ?? {};
	if (Number(d.completionPercentage) >= 100 && !REQUIRED_SETUP_KEYS.some(k => hasMissingItem(d, k))) {
		return { kind: 'redirect', reason: 'complete' };
	}
	for (const key of ['avatar', 'bio', 'channel', 'payout'] as const) {
		if (hasMissingItem(d, key) || (key !== 'payout' && isDirectRequiredMissing(d, key))) {
			return { kind: 'step', step: STEP_OF[key] };
		}
	}
	// nothing the wizard collects is missing (e.g., payout is pending_review and required items are done)
	const hasAllDirectFields = ('avatarUrl' in d || 'user' in d) && 'bio' in d && 'marketingChannels' in d;
	if (data && (d.missingItems || (hasAllDirectFields && !hasAnyRequiredMissing(d)))) {
		return { kind: 'redirect', reason: 'nothing-to-collect' };
	}
	// no report at all (an unusual answer): start at the beginning of the form steps
	return { kind: 'step', step: 2 };
}

export const MARKETER_SETUP_MESSAGE: Record<'complete' | 'nothing-to-collect', string> = {
	complete: 'ملفك التسويقي مكتمل 100% — يمكنك تعديل بياناتك من هنا.',
	'nothing-to-collect': 'لا يوجد ما يلزم استكماله هنا — ما تبقّى يُستكمل من صفحة الملف.',
};
