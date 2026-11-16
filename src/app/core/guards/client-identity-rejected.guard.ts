import { HttpClient, HttpContext } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AccountType } from '../models/auth.model';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import { AuthStore } from '../store/auth.store';
import { UiNotificationService } from '../services/ui-notification.service';

/** The identity step of the setup wizard: the only page of /client-overview a client with a REJECTED identity may use until new documents are sent. */
export const CLIENT_REJECTED_IDENTITY_PAGE = '/client-overview/profile-setup';
export const CLIENT_REJECTED_IDENTITY_MESSAGE = 'رُفضت وثيقة الهوية: ارفع وثيقة جديدة واضحة لمتابعة استخدام المنصة.';
const ALLOWED = new Set(['profile-setup']);
const CACHE_MS = 15_000;
let cache: { uid: string; at: number; rejected: boolean } | null = null;
/** after new documents were sent / the identity was decided, the next navigation must read the real state again */
export function resetClientIdentityRejectedCache() { cache = null; }

/**
 * A client whose identity documents the admin REJECTED stays on the identity page: every other page under /client-overview (typed URL, bookmark, reopened site, new login)
 * lands on the wizard's identity step until new documents are sent (the review then runs again and the lock opens). The server state is the only source (GET
 * /client/profile/setup/identity -> status REJECTED); a failed read never locks anyone out. Companies are not touched (their setup is not open).
 */
export const clientIdentityRejectedGuard: CanActivateChildFn = (_route, state) => {
	const router = inject(Router), notify = inject(UiNotificationService), httpClient = inject(HttpClient);
	const target = state.url.split('?')[0].replace(/^\/client-overview\/?/, '');
	if (ALLOWED.has(target)) return true;
	const user = inject(AuthStore).currentUser();
	if (user?.accountType === AccountType.CLIENT_COMPANY) return true;
	const uid = String(user?.id ?? '');
	const redirect = () => { notify.info(CLIENT_REJECTED_IDENTITY_MESSAGE); return router.parseUrl(CLIENT_REJECTED_IDENTITY_PAGE); };
	if (cache && cache.uid === uid && Date.now() - cache.at < CACHE_MS) return cache.rejected ? redirect() : true;
	return httpClient.get<{ data?: { status?: string } }>(`${environment.url_api}/client/profile/setup/identity`, { context: new HttpContext().set(SKIP_LOADING, true) }).pipe(
		map(r => r?.data?.status === 'REJECTED'),
		catchError(() => of(false)),
		tap(rejected => { cache = { uid, at: Date.now(), rejected }; }),
		map(rejected => rejected ? redirect() : true)
	);
};
