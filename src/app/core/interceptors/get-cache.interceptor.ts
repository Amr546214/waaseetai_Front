import { HttpContextToken, HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthStore } from '../store/auth.store';
import { isRateLimitError } from '../utils/rate-limit.util';

/** Pass `context: new HttpContext().set(SKIP_GET_CACHE, true)` for a GET that must always reach the server (and never be served from memory). */
export const SKIP_GET_CACHE = new HttpContextToken<boolean>(() => false);

/** Stable reads that every page needs and that change rarely: served from memory for a few seconds. Nothing money / access / state related. */
export const FRESH_CACHE_TTL_MS = 15_000;
export const FRESH_CACHE_PATHS = /\/(provider|marketer|client)\/statistics(\?|$)|\/(skills|levels|public-settings|specialties)(\?|\/?$)/;
/** The last good answer kept only to survive a 429 (HTTP rate limit) without blanking the page. */
export const STALE_ON_429_TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 80;

interface Entry { res: HttpResponse<unknown>; at: number }
const fresh = new Map<string, Entry>();
const lastGood = new Map<string, Entry>();
const inflight = new Map<string, Observable<HttpEvent<unknown>>>();

/** test hook */
export function resetGetCache(): void { fresh.clear(); lastGood.clear(); inflight.clear(); }

function remember(map: Map<string, Entry>, key: string, res: HttpResponse<unknown>): void {
	map.delete(key);
	map.set(key, { res, at: Date.now() });
	if (map.size > MAX_ENTRIES) map.delete(map.keys().next().value as string);
}

/**
 * GETs only. (1) Identical GETs in flight at the same time share ONE request (guards, layout and the page often ask for the same thing).
 * (2) A small allow-list of stable reads is served from memory for FRESH_CACHE_TTL_MS; any successful write clears it.
 * (3) When the server answers 429 and this exact read succeeded before (same account + role), the earlier answer is returned instead of the
 *     error, so the page keeps its data. Without an earlier answer the 429 passes through untouched (pages show their retry state).
 * Keys carry the account id and acting role, so one account never sees another's data. Writes are never cached, retried or shared.
 */
export const getCacheInterceptor: HttpInterceptorFn = (req, next) => {
	const auth = inject(AuthStore);
	if (req.method !== 'GET' || req.context.get(SKIP_GET_CACHE) || req.responseType !== 'json' || req.reportProgress) {
		return next(req).pipe(tap(e => { if (e instanceof HttpResponse && e.status >= 200 && e.status < 300) fresh.clear(); }));
	}
	const u: any = auth.currentUser?.();
	const key = `${u?.id ?? 'anon'}|${u?.activeRole ?? ''}|${req.urlWithParams}`;
	const cacheable = FRESH_CACHE_PATHS.test(req.urlWithParams);

	if (cacheable) {
		const hit = fresh.get(key);
		if (hit && Date.now() - hit.at < FRESH_CACHE_TTL_MS) return of(hit.res.clone());
	}
	const running = inflight.get(key);
	if (running) return running;

	const shared = next(req).pipe(
		tap(e => {
			if (e instanceof HttpResponse && e.status === 200) {
				remember(lastGood, key, e);
				if (cacheable) remember(fresh, key, e);
			}
		}),
		catchError((err: unknown) => {
			if (err instanceof HttpErrorResponse && isRateLimitError(err)) {
				const prev = lastGood.get(key);
				if (prev && Date.now() - prev.at < STALE_ON_429_TTL_MS) return of(prev.res.clone());
			}
			return throwError(() => err);
		}),
		finalize(() => inflight.delete(key)),
		shareReplay({ bufferSize: 1, refCount: false })
	);
	inflight.set(key, shared);
	return shared;
};
