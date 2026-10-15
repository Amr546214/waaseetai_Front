import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, throwError, timer } from 'rxjs';
import { UiNotificationService } from '../services/ui-notification.service';
import { isRateLimitError, rateLimitToastMessage, retryAfterSeconds } from '../utils/rate-limit.util';
import { AUTH_ATTEMPT_URLS } from './auth.interceptor';

export const RATE_LIMIT_TOAST_GAP_MS = 10_000;
export const RATE_LIMIT_MAX_AUTO_RETRY_SECONDS = 3;
let lastToastAt = 0;
/** test hook */
export function resetRateLimitToastClock(): void { lastToastAt = 0; }

/**
 * Innermost interceptor. A 429 is a TEMPORARY condition: this only (a) retries an idempotent GET once when the wait is short (a POST/PUT/PATCH/DELETE, a payment, a withdrawal or an OTP request is NEVER retried automatically),
 * (b) shows ONE deduplicated warning toast, and (c) passes the original HttpErrorResponse (status 429) on so consumers use isRateLimitError().
 * It never logs out, redirects, or touches any access/role state. Auth attempts (login / OTP ...) keep their own specific messages: no toast, no retry.
 */
export const rateLimitInterceptor: HttpInterceptorFn = (req, next) => {
	const ui = inject(UiNotificationService);
	const isAuthAttempt = AUTH_ATTEMPT_URLS.some(u => req.url.includes(u));
	let stream$ = next(req);
	if (req.method === 'GET' && !isAuthAttempt) {
		stream$ = stream$.pipe(retry({
			count: 1,
			delay: (err) => {
				const wait = retryAfterSeconds(err);
				if (!isRateLimitError(err) || wait == null || wait > RATE_LIMIT_MAX_AUTO_RETRY_SECONDS) return throwError(() => err);
				return timer(Math.max(wait, 1) * 1000);
			},
		}));
	}
	return stream$.pipe(
		catchError((err: unknown) => {
			if (err instanceof HttpErrorResponse && isRateLimitError(err) && !isAuthAttempt) {
				const now = Date.now();
				if (now - lastToastAt >= RATE_LIMIT_TOAST_GAP_MS) {
					lastToastAt = now;
					ui.warning(rateLimitToastMessage(err));
				}
			}
			return throwError(() => err);
		})
	);
};
