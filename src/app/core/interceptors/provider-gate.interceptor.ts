import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { UserRole } from '../models/auth.model';
import { AuthStore } from '../store/auth.store';
import { PROVIDER_ACCESS_STATUS_URL, ProviderAccessService, accessRedirectUrl } from '../services/provider-access.service';

export const PROVIDER_GATE_MESSAGE = 'لوحة مقدم الخدمة تفتح بعد اعتماد نموذج الاعتماد من الإدارة';

let handling = false;

/**
 * Defense in depth against a stale route shell (an old bundle / an open tab): when the backend answers a PROVIDER session with the dashboard-gate 403,
 * the access state is re-read and the app moves to the right page (wizard or status page). Once at a time, the original error still reaches the caller,
 * and no toast is raised here.
 */
export const providerGateInterceptor: HttpInterceptorFn = (req, next) => {
	const authStore = inject(AuthStore);
	const access = inject(ProviderAccessService);
	const router = inject(Router);
	return next(req).pipe(
		catchError((err: unknown) => {
			if (err instanceof HttpErrorResponse && err.status === 403 && !handling && authStore.actingRole() === UserRole.PROVIDER) {
				const body: any = err.error;
				const msg = (typeof body === 'string' ? body : body?.message) ?? '';
				// the fixed marker first (the BE contract), the exact text as before for older answers
				if ((typeof body === 'object' && body?.code === 'PROVIDER_DASHBOARD_LOCKED') || (typeof msg === 'string' && msg.trim() === PROVIDER_GATE_MESSAGE)) {
					handling = true;
					access.invalidate();
					const go = (url: string) => { if (!router.url.split(/[?#]/)[0].startsWith(url)) router.navigateByUrl(url); };
					access.load().subscribe({
						next: s => { if (s.canAccessDashboard !== true) go(accessRedirectUrl(s)); handling = false; },
						error: () => { go(PROVIDER_ACCESS_STATUS_URL); handling = false; },
					});
				}
			}
			return throwError(() => err);
		})
	);
};
