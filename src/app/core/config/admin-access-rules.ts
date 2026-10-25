/**
 * Which permission each admin area needs. This only decides what the app SHOWS (menu, links, route entry): the server decides every request, so a wrong entry here can never grant
 * anything - it can only hide or show a link. The ids are the registry ids of the backend (src/config/admin-permissions.ts).
 */
export interface AccessRule {
	/** every one of these */
	all?: string[];
	/** at least one of these */
	anyOf?: string[];
	/** the platform owner only */
	owner?: boolean;
	/** any team member who holds at least one permission */
	member?: boolean;
	/** the admin's OWN account pages: any admin account, even one with no permission */
	self?: boolean;
}


const OPERATIONS_DETAIL = new Set(['requests', 'offers', 'projects', 'contracts']);

/** longest matching prefix of the path after /supper-admin-overview/ wins; '' is the dashboard */
export const ADMIN_ROUTE_ACCESS: Record<string, AccessRule> = {
	'': { member: true },
	messages: { member: true },
	users: { all: ['users.view'] },
	brokers: { all: ['users.view'] },
	accreditations: { all: ['specialties.approve'] },
	'specialties-accreditation': { all: ['specialties.approve'] },
	specialties: { all: ['content.manage'] },
	categories: { all: ['content.manage'] },
	'business-models': { all: ['business_models.review'] },
	requests: { owner: true }, offers: { owner: true }, projects: { owner: true }, contracts: { owner: true },
	disputes: { all: ['disputes.view'] },
	reports: { all: ['reports.view'] },
	support: { all: ['support.review'] },
	'modification-requests': { all: ['identity.review'] },
	kyc: { all: ['identity.review'] },
	withdrawals: { all: ['withdrawals.review'] },
	revenues: { all: ['finance.read'] },
	'finance-reports': { all: ['finance.read'] },
	'analytics-hub': { all: ['finance.read'] },
	'sub-finance': { all: ['finance.read'] },
	fees: { anyOf: ['finance.read', 'packages.manage'] },
	coupons: { all: ['packages.manage'] },
	team: { all: ['team.view'] },
	roles: { owner: true },
	'super-admins': { owner: true },
	tasks: { member: true },
	'team-performance': { all: ['performance.view'] },
	'marketing-assets': { all: ['marketing_assets.manage'] },
	'system-settings': { all: ['settings.manage'] },
	'site-control': { all: ['site_control.manage'] },
	audit: { all: ['audit.view'] }, 'audit-trail': { all: ['audit.view'] },
	'my-account': { self: true },
	'no-access': { self: true },
};

export function ruleForPath(path: string): AccessRule {
	const p = path.replace(/^\/?(supper-admin-overview)?\/?/, '').split('?')[0].replace(/\/+$/, '');
	if (p === '') return ADMIN_ROUTE_ACCESS[''];
	const parts = p.split('/');
	// the LIST of an operations record is owner-only; one record opens only through a case the server lets this person hold (scope is decided there)
	if (parts.length > 1 && OPERATIONS_DETAIL.has(parts[0])) return { member: true };
	for (let n = parts.length; n >= 1; n--) { const r = ADMIN_ROUTE_ACCESS[parts.slice(0, n).join('/')]; if (r) return r; }
	return { member: true }; // pages without their own entry (IT, subscriptions, ...): any team member; their data is gated by the server
}
