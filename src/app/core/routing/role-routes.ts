// ONE place that says where each ACTIVE role lives. The sidebar logo, the top bar (messages icon, profile, settings, add account), the site navbar and the route guards
// all read from here, so a link can never send the active role to another role's area. The active role is the source of truth; the account type is only a
// fallback for an old account that has no active role.
import { AccountType, UserRole, type User } from '../models/auth.model';

type RoleSource = Pick<User, 'accountType' | 'activeRole'> | null | undefined;

/** The role the user is acting as RIGHT NOW: the active role first; only when it is missing, the role implied by the account type. */
export function resolveActiveRole(user: RoleSource): UserRole {
	if (user?.activeRole) return user.activeRole;
	switch (user?.accountType) {
		case AccountType.SUPER_ADMIN: return UserRole.SUPER_ADMIN;
		case AccountType.PROVIDER_INDIVIDUAL:
		case AccountType.PROVIDER_COMPANY: return UserRole.PROVIDER;
		case AccountType.MARKETING_BROKER: return UserRole.AFFILIATE;
		default: return UserRole.CLIENT;
	}
}

/**
 * The same rule for the route guards, but strict: a user with neither an active role nor a known account type has NO role (null), so no area opens for it
 * (the guards then send it to the login page instead of treating it as a client).
 */
export function resolveRoleStrict(user: RoleSource): UserRole | null {
	if (!user) return null;
	if (user.activeRole) return user.activeRole;
	switch (user.accountType) {
		case AccountType.SUPER_ADMIN: return UserRole.SUPER_ADMIN;
		case AccountType.PROVIDER_INDIVIDUAL:
		case AccountType.PROVIDER_COMPANY: return UserRole.PROVIDER;
		case AccountType.MARKETING_BROKER: return UserRole.AFFILIATE;
		case AccountType.CLIENT_INDIVIDUAL:
		case AccountType.CLIENT_COMPANY: return UserRole.CLIENT;
		default: return null;
	}
}

export interface RoleLinks { home: string; messages: string; profile: string; settings: string; addAccount: string }

const CLIENT: RoleLinks = { home: '/client-overview', messages: '/client-overview/messages', profile: '/client-overview/profile', settings: '/client-overview/settings/account', addAccount: '/client-overview/profile/add-account' };
const PROVIDER: RoleLinks = { home: '/provider-overview', messages: '/provider-overview/messages', profile: '/provider-overview/profile/data', settings: '/provider-overview/settings/account', addAccount: '/provider-overview/profile/add-account' };
// The marketer has no separate account-settings page: "settings" opens the profile data page (where its account data lives).
const MARKETER: RoleLinks = { home: '/marketer-overview', messages: '/marketer-overview/messages', profile: '/marketer-overview/profile/data', settings: '/marketer-overview/profile/data', addAccount: '/marketer-overview/profile/add-account' };
// The admin area has its own home and messages; it has no personal profile / account pages, so those open its home.
const ADMIN: RoleLinks = { home: '/supper-admin-overview', messages: '/supper-admin-overview/messages', profile: '/supper-admin-overview', settings: '/supper-admin-overview', addAccount: '/supper-admin-overview' };

export function roleLinks(role: UserRole): RoleLinks {
	switch (role) {
		case UserRole.PROVIDER: return PROVIDER;
		case UserRole.AFFILIATE: return MARKETER;
		case UserRole.ADMIN:
		case UserRole.SUPER_ADMIN: return ADMIN;
		default: return CLIENT;
	}
}

/** The dashboard of a role. */
export const roleHome = (role: UserRole): string => roleLinks(role).home;
