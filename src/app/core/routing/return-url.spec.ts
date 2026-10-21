import { AccountType, UserRole } from '../models/auth.model';
import { RETURN_URL_MAX_AGE_MS, consumeReturnUrl, isSafeReturnUrl, rememberReturnUrl } from './return-url';

const provider = { accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole: UserRole.PROVIDER };
const client = { accountType: AccountType.CLIENT_INDIVIDUAL, activeRole: UserRole.CLIENT };
const APPLY = '/provider-overview/explore-requests/49786375-4db1-44ef-aa10-83cdeac5c65c/apply';

describe('return to the page the visitor came for, after login', () => {
	beforeEach(() => { localStorage.removeItem('returnUrl'); localStorage.removeItem('returnUrlAt'); });

	it('the project-opportunity link: remembered by the guard, used once after the provider signs in, then forgotten', () => {
		rememberReturnUrl(APPLY, 1_000);
		expect(consumeReturnUrl(provider, 2_000)).toBe(APPLY);
		expect(consumeReturnUrl(provider, 2_001)).toBeNull();
		expect(localStorage.getItem('returnUrl')).toBeNull();
	});

	it('another role never lands in a page it cannot open: a client gets null (the dashboard) and the memory is cleared', () => {
		rememberReturnUrl(APPLY, 1_000);
		expect(consumeReturnUrl(client, 2_000)).toBeNull();
		expect(localStorage.getItem('returnUrl')).toBeNull();
	});

	it('the acting role decides, not the account type (a provider account acting as a client)', () => {
		rememberReturnUrl(APPLY, 1_000);
		expect(consumeReturnUrl({ accountType: AccountType.PROVIDER_INDIVIDUAL, activeRole: UserRole.CLIENT }, 2_000)).toBeNull();
	});

	it('a public page (marketplace) is allowed for any role', () => {
		rememberReturnUrl('/marketplace/offers/abc?x=1', 1_000);
		expect(consumeReturnUrl(client, 2_000)).toBe('/marketplace/offers/abc?x=1');
	});

	it('a remembered page older than 30 minutes (or from the future) is ignored', () => {
		rememberReturnUrl(APPLY, 1_000);
		expect(consumeReturnUrl(provider, 1_000 + RETURN_URL_MAX_AGE_MS + 1)).toBeNull();
		rememberReturnUrl(APPLY, 10_000);
		expect(consumeReturnUrl(provider, 5_000)).toBeNull();
	});

	it('only plain app paths are ever remembered or followed (no scheme, //host, backslash, auth pages, whitespace)', () => {
		for (const bad of ['https://evil.test/x', '//evil.test/x', 'javascript:alert(1)', '/a\\b', '/auth/login', '/auth', '/a b', '', 'relative/path', '/' + 'x'.repeat(700), null, undefined, 5]) {
			expect(isSafeReturnUrl(bad), String(bad)).toBe(false);
		}
		expect(isSafeReturnUrl(APPLY)).toBe(true);
		rememberReturnUrl('//evil.test/x', 1_000);
		expect(localStorage.getItem('returnUrl')).toBeNull();
		localStorage.setItem('returnUrl', 'https://evil.test/x'); localStorage.setItem('returnUrlAt', '1000');
		expect(consumeReturnUrl(provider, 2_000)).toBeNull();
	});
});
