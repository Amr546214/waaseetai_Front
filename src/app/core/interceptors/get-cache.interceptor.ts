import { adminDataChanges } from '../services/admin-data-changes';
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
// Only public catalog data may fall back to an earlier answer. Financial,
// permission and workflow reads must expose a failed refresh to their caller.
export const STALE_ON_429_PATHS = /\/api\/(?:levels\/?|specialties\/(?:public|categories)\/?)$/;
const MAX_ENTRIES = 80;

interface Entry { res: HttpResponse<unknown>; at: number }
const fresh = new Map<string, Entry>();
const lastGood = new Map<string, Entry>();
const inflight = new Map<string, Observable<HttpEvent<unknown>>>();
let generation = 0;

/** test hook */
export function resetGetCache(): void { generation++; fresh.clear(); lastGood.clear(); inflight.clear(); }

function remember(map: Map<string, Entry>, key: string, res: HttpResponse<unknown>): void {
	map.delete(key);
	map.set(key, { res, at: Date.now() });
	if (map.size > MAX_ENTRIES) map.delete(map.keys().next().value as string);
}

/**
 * GETs only. (1) Identical GETs in flight at the same time share ONE request (guards, layout and the page often ask for the same thing).
 * (2) A small allow-list of stable reads is served from memory for FRESH_CACHE_TTL_MS; any successful write clears it.
 * (3) Only allow-listed public catalogs can use an earlier answer on 429.
 *     All financial, access and workflow errors pass through unchanged.
 * Keys carry the account id and acting role, so one account never sees another's data. Writes are never cached, retried or shared.
 */
export const getCacheInterceptor: HttpInterceptorFn = (req, next) => {
	const auth = inject(AuthStore);
	if (req.method !== 'GET' || req.context.get(SKIP_GET_CACHE) || req.responseType !== 'json' || req.reportProgress) {
		return next(req).pipe(tap(e => { if (req.method !== 'GET' && e instanceof HttpResponse && e.status >= 200 && e.status < 300) { resetGetCache(); if(/\/(?:disputes|reports|support|modification-requests|profile-change)/.test(req.url))adminDataChanges.next(); } }));
	}
	const u: any = auth.currentUser?.();
	const key = `${u?.id ?? 'anon'}|${u?.activeRole ?? ''}|${req.urlWithParams}`;
	const cacheable = FRESH_CACHE_PATHS.test(req.urlWithParams);
	const staleAllowed = STALE_ON_429_PATHS.test(req.url.split('?')[0]);
	const requestGeneration = generation;

	if (cacheable) {
		const hit = fresh.get(key);
		if (hit && Date.now() - hit.at < FRESH_CACHE_TTL_MS) return of(hit.res.clone());
	}
	const running = inflight.get(key);
	if (running) return running;

	const shared: Observable<HttpEvent<unknown>> = next(req).pipe(
		tap(e => {
			if (generation === requestGeneration && e instanceof HttpResponse && e.status === 200) {
				if (staleAllowed) remember(lastGood, key, e);
				if (cacheable) remember(fresh, key, e);
			}
		}),
		catchError((err: unknown) => {
			if (staleAllowed && generation === requestGeneration && err instanceof HttpErrorResponse && isRateLimitError(err)) {
				const prev = lastGood.get(key);
				if (prev && Date.now() - prev.at < STALE_ON_429_TTL_MS) return of(prev.res.clone());
			}
			return throwError(() => err);
		}),
		finalize(() => { if (inflight.get(key) === shared) inflight.delete(key); }),
		shareReplay({ bufferSize: 1, refCount: false })
	);
	inflight.set(key, shared);
	return shared;
};
