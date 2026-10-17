// Pure helpers for the destination of a SAVED notification. Old rows keep the link they were stored with, so a link written by an earlier release
// (a removed route, a differently keyed id) must still open something real. Everything here is a plain function: no router, no side effects.

/**
 * Where the old accreditation-status page now lives. The approval-requests actions log (account-actions) that replaced it; the old route redirects there. Change ONLY this constant if the log moves.
 */
export const ACCREDITATION_STATUS_REPLACEMENT_ROUTE = '/provider-overview/account-actions';

/**
 * Project messages tab (shape defined by track T4): `?tab=messages` on the project page of each side.
 *  client:   /client-overview/projects/<projectId>?tab=messages
 *  provider: /provider-overview/projects/active/progress/<projectOrContractId>?tab=messages
 */
export const projectMessagesUrl = (side: 'client' | 'provider', id: string): string =>
	side === 'client' ? `/client-overview/projects/${id}?tab=messages` : `/provider-overview/projects/active/progress/${id}?tab=messages`;

// Sibling routes under /provider-overview/projects that are never an id.
const PROVIDER_PROJECT_RESERVED = new Set(['active', 'archived', 'phases', 'progress']);

/**
 * Maps a legacy stored URL to the current real route; returns the URL unchanged when it is not a known legacy shape (and null for empty input).
 *  - /dashboard/clients-overview/... , /dashboard/client-overview/...  -> /client-overview/...   (the historical prefix)
 *  - /dashboard/provider-overview/... , /dashboard/marketer-overview/... -> same without /dashboard
 *  - /provider-overview/accreditation-status -> ACCREDITATION_STATUS_REPLACEMENT_ROUTE
 *  - /provider-overview/projects/<id>/contract  -> the offers list (the contract is signed from the offer)
 *  - /provider-overview/projects/<id>           -> /provider-overview/projects/active/progress/<id> (that bare route never existed)
 *  - /provider-overview/projects/progress/<id>  -> /provider-overview/projects/active/progress/<id>
 *  - /client-overview/projects/<id>/progress|workspace -> /client-overview/projects/<id>
 */
export function normalizeLegacyNotificationUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	let u = url.trim();
	if (!u.startsWith('/') || u.startsWith('//')) return u;
	u = u.replace(/^\/dashboard\/clients-overview(?=\/|$)/, '/client-overview').replace(/^\/dashboard\/(client|provider|marketer)-overview(?=\/|$)/, '/$1-overview');
	const [path, rest] = splitQuery(u);
	if (path === '/provider-overview/accreditation-status') return ACCREDITATION_STATUS_REPLACEMENT_ROUTE;
	let m = /^\/provider-overview\/projects\/([^/]+)\/contract$/.exec(path);
	if (m) return '/provider-overview/offers';
	m = /^\/provider-overview\/projects\/progress\/([^/]+)$/.exec(path);
	if (m) return `/provider-overview/projects/active/progress/${m[1]}${rest}`;
	m = /^\/provider-overview\/projects\/([^/]+)$/.exec(path);
	if (m && !PROVIDER_PROJECT_RESERVED.has(m[1])) return `/provider-overview/projects/active/progress/${m[1]}${rest}`;
	m = /^\/client-overview\/projects\/([^/]+)\/(?:progress|workspace)$/.exec(path);
	if (m) return `/client-overview/projects/${m[1]}${rest}`;
	return u;
}

function splitQuery(u: string): [string, string] {
	const i = u.search(/[?#]/);
	return i < 0 ? [u, ''] : [u.slice(0, i), u.slice(i)];
}
