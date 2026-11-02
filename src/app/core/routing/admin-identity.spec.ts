import { adminRoleOf, resolveActiveRole, resolveRoleStrict } from './role-routes';
import { consumeReturnUrl, rememberReturnUrl } from './return-url';
import { getDefaultDashboard } from '../guards/auth.guards';
import { AccountType, UserRole } from '../models/auth.model';

// An ADMIN / SUPER_ADMIN account acts as admin whatever its stored active role says (it is often CLIENT): login lands in the admin area, the role is the admin role, return links obey it.
describe('admin identity', () => {
	const superAsClient: any = { accountType: AccountType.SUPER_ADMIN, activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT] };
	const adminAsClient: any = { accountType: 'ADMIN', activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT, UserRole.ADMIN] };

	it('the acting role of an admin account is its admin role (never the other admin role, never CLIENT)', () => {
		expect(adminRoleOf(superAsClient)).toBe(UserRole.SUPER_ADMIN);
		expect(adminRoleOf(adminAsClient)).toBe(UserRole.ADMIN);
		expect(resolveActiveRole(superAsClient)).toBe(UserRole.SUPER_ADMIN);
		expect(resolveActiveRole(adminAsClient)).toBe(UserRole.ADMIN);
		expect(resolveRoleStrict(adminAsClient)).toBe(UserRole.ADMIN);
	});

	it('other accounts are untouched (provider acting as client stays a client)', () => {
		const p: any = { accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole: UserRole.CLIENT, roles: [UserRole.CLIENT, UserRole.PROVIDER] };
		expect(adminRoleOf(p)).toBeNull();
		expect(resolveActiveRole(p)).toBe(UserRole.CLIENT);
	});

	it('login / verify land an admin account in the admin area even when the stored role is CLIENT', () => {
		expect(getDefaultDashboard(AccountType.SUPER_ADMIN, UserRole.CLIENT)).toBe('/supper-admin-overview');
		expect(getDefaultDashboard('ADMIN' as any, UserRole.CLIENT)).toBe('/supper-admin-overview');
		expect(getDefaultDashboard(AccountType.CLIENT_INDIVIDUAL, UserRole.CLIENT)).toBe('/client-overview');
		expect(getDefaultDashboard(AccountType.PROVIDER_INDIVIDUAL, UserRole.PROVIDER)).toBe('/provider-overview');
	});

	it('a remembered client-area link is NOT used for an admin (it lands on the admin dashboard); an admin link is', () => {
		rememberReturnUrl('/client-overview/my-requests'); expect(consumeReturnUrl(superAsClient)).toBeNull();
		rememberReturnUrl('/supper-admin-overview/users'); expect(consumeReturnUrl(adminAsClient)).toBe('/supper-admin-overview/users');
	});
});
