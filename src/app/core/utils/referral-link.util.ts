import { environment } from '../../../environments/environment';

/**
 * Builds the full, shareable affiliate referral URL from a raw
 * referralSlug — e.g. `https://dev.waseetai.com/ref/amrokasha7e11` on DEV,
 * `https://waseet.ai/ref/amrokasha7e11` on production.
 *
 * Derives the origin from the app's own `environment.url_api` (stripping
 * the trailing `/api`) rather than hardcoding a domain — the same
 * environment-per-build-configuration mechanism already used everywhere
 * else in this app, so it never needs separate upkeep and is automatically
 * correct in every deployment. The backend's own `primaryLink` field is
 * NOT used for this because it is hardcoded to the production domain
 * regardless of environment.
 *
 * Returns '' for a missing/empty slug — callers must never construct
 * `/ref/undefined`.
 */
export function buildReferralUrl(slug: string | null | undefined): string {
	if (!slug) return '';
	const origin = environment.url_api.replace(/\/api\/?$/, '');
	return `${origin}/ref/${slug}`;
}
