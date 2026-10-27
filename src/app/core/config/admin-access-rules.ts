/**
 * Which permission each admin area needs. This only decides what the app SHOWS (menu, links, route entry): the server decides every request, so a wrong entry here can never grant
 * anything - it can only hide or show a link. The ids are the registry ids of the backend (src/config/admin-permissions.ts).
 */
export interface AccessRule {
	/** every one of these */
	all?: string[];
	/** at least one of these */
	anyOf?: string[];
	/** SUPER_ADMIN accounts only (the type read from the server) */
	superAdmin?: boolean;
	/** any team member who holds at least one permission */
	member?: boolean;
	/** the admin's OWN account pages: any admin account, even one with no permission */
	self?: boolean;
}


const OPERATIONS_DETAIL = new Set(['requests', 'offers', 'projects', 'contracts']);

/** longest matching prefix of the path after /supper-admin-overview/ wins; '' is the dashboard */
export const ADMIN_ROUTE_ACCESS: Record<string, AccessRule> = {
	'': { member: true },
	messages: { all: ['messages.use'] },
	users: { all: ['users.view'] },
	brokers: { all: ['users.view'] },
	accreditations: { all: ['specialties.approve'] },
	'specialties-accreditation': { all: ['specialties.approve'] },
	specialties: { all: ['content.manage'] },
	categories: { all: ['content.manage'] },
	'business-models': { all: ['business_models.review'] },
	requests: { superAdmin: true }, offers: { superAdmin: true }, projects: { superAdmin: true }, contracts: { superAdmin: true },
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
	fees: { anyOf: ['finance.read', 'packages.manage', 'fees.view', 'fees.manage'] },
	coupons: { all: ['packages.manage'] },
	team: { all: ['team.view'] },
	roles: { superAdmin: true },
	'super-admins': { superAdmin: true },
	tasks: { member: true },
	'team-performance': { all: ['performance.view'] },
	'marketing-assets': { all: ['marketing_assets.manage'] },
	'system-settings': { anyOf: ['settings.view', 'settings.manage'] },
	// «التحكم بالموقع»: the section opens for the identity permissions too; the nine local-only design pages keep the older site_control.manage.
	// «الهوية» opens for site.view / site.manage AND for the legacy site_control.manage. Round 5: the legacy grant («manage التحكم بالموقع») IS the edit capability of the identity manager
	// (the server accepts site.manage OR site_control.manage on every write and answers canManage:true for both); site.view alone stays read-only.
	'site-control': { anyOf: ['site_control.manage', 'site.view', 'site.manage'] },
	'site-control/identity': { anyOf: ['site.view', 'site.manage', 'site_control.manage'] },
	...Object.fromEntries(['health', 'tokens', 'icons', 'accounts', 'templates', 'typography', 'style-guide', 'live-preview', 'export'].map(p => [`site-control/${p}`, { all: ['site_control.manage'] } as AccessRule])),
	audit: { all: ['audit.view'] }, 'audit-trail': { all: ['audit.view'] },
	// every remaining page of the console has its own explicit rule (nothing is opened to "any team member" by omission)
	subscriptions: { all: ['packages.manage'] }, 'subscriptions/invoices': { all: ['finance.read'] },
	it: { superAdmin: true }, 'it/security': { all: ['audit.view'] },
	ai: { superAdmin: true },
	communication: { superAdmin: true },
	analytics: { all: ['finance.read'] }, 'analytics/coupons': { all: ['packages.manage'] },
	'risk-center': { all: ['finance.read'] },
	'my-account': { self: true },
	'no-access': { self: true },
};

/** true when the path (or a parent prefix) has its own entry: used by the structural spec, so a page can never rely on the closed default */
export function hasExplicitRule(path: string): boolean {
	const p = path.replace(/^\/?(supper-admin-overview)?\/?/, '').split('?')[0].replace(/\/+$/, '');
	if (p === '') return true;
	const parts = p.split('/');
	for (let n = parts.length; n >= 1; n--) if (parts.slice(0, n).join('/') in ADMIN_ROUTE_ACCESS) return true;
	return false;
}

export function ruleForPath(path: string): AccessRule {
	const p = path.replace(/^\/?(supper-admin-overview)?\/?/, '').split('?')[0].replace(/\/+$/, '');
	if (p === '') return ADMIN_ROUTE_ACCESS[''];
	const parts = p.split('/');
	// the LIST of an operations record is SUPER_ADMIN-only; one record opens only through a case the server lets this person hold (scope is decided there)
	if (parts.length > 1 && OPERATIONS_DETAIL.has(parts[0])) return { member: true };
	for (let n = parts.length; n >= 1; n--) { const r = ADMIN_ROUTE_ACCESS[parts.slice(0, n).join('/')]; if (r) return r; }
	return { superAdmin: true }; // an unlisted page is closed (SUPER_ADMIN only) until it gets its own rule: a structural spec lists every route and fails if one is missing
}
