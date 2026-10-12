import { describe, expect, it } from 'vitest';
import { AccountType, UserRole } from '../models/auth.model';
import { resolveActiveRole, resolveRoleStrict, roleHome, roleLinks } from './role-routes';

const AREA: Record<string, string> = { CLIENT: '/client-overview', PROVIDER: '/provider-overview', AFFILIATE: '/marketer-overview', SUPER_ADMIN: '/supper-admin-overview', ADMIN: '/supper-admin-overview' };

describe('role routes: the ACTIVE role decides, the account type is only a fallback', () => {
	it('active role first, even when the account type says something else', () => {
		expect(resolveActiveRole({ accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole: UserRole.CLIENT })).toBe(UserRole.CLIENT);
		expect(resolveActiveRole({ accountType: AccountType.CLIENT_INDIVIDUAL, activeRole: UserRole.PROVIDER })).toBe(UserRole.PROVIDER);
		expect(resolveActiveRole({ accountType: AccountType.MARKETING_BROKER, activeRole: UserRole.CLIENT })).toBe(UserRole.CLIENT);
	});
	it('no active role (an old account): the account type decides', () => {
		expect(resolveActiveRole({ accountType: AccountType.PROVIDER_COMPANY })).toBe(UserRole.PROVIDER);
		expect(resolveActiveRole({ accountType: AccountType.MARKETING_BROKER })).toBe(UserRole.AFFILIATE);
		expect(resolveActiveRole({ accountType: AccountType.SUPER_ADMIN })).toBe(UserRole.SUPER_ADMIN);
		expect(resolveActiveRole({ accountType: AccountType.CLIENT_COMPANY })).toBe(UserRole.CLIENT);
		expect(resolveActiveRole(null)).toBe(UserRole.CLIENT);
	});
	it('the strict form (guards) has NO role for an unknown account without an active role', () => {
		expect(resolveRoleStrict({ accountType: 'SOMETHING_ELSE' as any })).toBeNull();
		expect(resolveRoleStrict(null)).toBeNull();
		expect(resolveRoleStrict({ accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole: UserRole.CLIENT })).toBe(UserRole.CLIENT);
		expect(resolveRoleStrict({ accountType: AccountType.PROVIDER_INDIVIDUAL })).toBe(UserRole.PROVIDER);
	});
	it('every link of a role stays inside that role\'s own area (a marketer never gets /client-overview, a client never /provider-overview)', () => {
		for (const role of [UserRole.CLIENT, UserRole.PROVIDER, UserRole.AFFILIATE, UserRole.SUPER_ADMIN, UserRole.ADMIN]) {
			const own = AREA[role];
			for (const [name, link] of Object.entries(roleLinks(role))) expect(link.startsWith(own), `${role}.${name} = ${link}`).toBe(true);
			expect(roleHome(role)).toBe(own);
		}
	});
	it('the marketer messages icon opens the marketer messages page', () => {
		expect(roleLinks(UserRole.AFFILIATE).messages).toBe('/marketer-overview/messages');
		expect(roleLinks(UserRole.AFFILIATE).profile).toBe('/marketer-overview/profile/data');
		expect(roleLinks(UserRole.AFFILIATE).addAccount).toBe('/marketer-overview/profile/add-account');
	});
});
