import { resolveActiveRole, roleAreaOfUrl } from './role-routes';
import type { AccountType, UserRole } from '../models/auth.model';

const KEY = 'returnUrl';
const AT_KEY = 'returnUrlAt';
/** A remembered target older than this is forgotten: a link opened yesterday must not hijack today's login. */
export const RETURN_URL_MAX_AGE_MS = 30 * 60_000;

/** True only for a plain app path: no scheme, no `//host`, no backslash / control character, not an auth page, bounded length. */
export function isSafeReturnUrl(url: unknown): url is string {
	if (typeof url !== 'string') return false;
	const u = url.trim();
	if (!u.startsWith('/') || u.startsWith('//') || u.length > 600) return false;
	if (/[\\\u0000-\u001f\s]/.test(u)) return false;
	const path = u.split(/[?#]/)[0];
	if (path === '/auth' || path.startsWith('/auth/')) return false;
	return true;
}

/** The guard calls this when it sends a logged-out visitor to the login page: after the login the visitor returns to THIS page. */
export function rememberReturnUrl(url: string, now: number = Date.now()): void {
	if (!isSafeReturnUrl(url)) return;
	try { localStorage.setItem(KEY, url); localStorage.setItem(AT_KEY, String(now)); } catch { /* storage unavailable: the login simply lands on the dashboard */ }
}

/**
 * After a successful sign-in: the remembered page, only if it is fresh, safe, and either public or inside the area of the role the user is signed in as
 * (a provider link opened by a client lands on the client dashboard, never on a 403). One shot: it is removed whether or not it is used.
 */
export function consumeReturnUrl(user: { accountType?: AccountType; activeRole?: UserRole } | null | undefined, now: number = Date.now()): string | null {
	let url: string | null = null, at = 0;
	try { url = localStorage.getItem(KEY); at = Number(localStorage.getItem(AT_KEY)); localStorage.removeItem(KEY); localStorage.removeItem(AT_KEY); } catch { return null; }
	if (!isSafeReturnUrl(url)) return null;
	if (!Number.isFinite(at) || at <= 0 || now - at > RETURN_URL_MAX_AGE_MS || now < at) return null;
	const area = roleAreaOfUrl(url);
	if (area && area !== resolveActiveRole(user as any)) return null;
	return url;
}
