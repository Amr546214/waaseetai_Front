import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { messageForBackendCode, STATUS_MESSAGES } from '../forms/http-error';

const ARABIC = /[؀-ۿ]/;

/**
 * Outermost interceptor (it sees the error last): the backend still answers some failures with a raw code in `message`
 * ("REQUIRED_PROFILE_FIELDS", "INVALID_URL:githubUrl", ...). Every screen that shows `error.message` then shows Arabic.
 * The original text is kept in `error.rawMessage` (screens that need the argument after ':' read it there), and 413/415 get a
 * fixed Arabic message when the body is not ours (a proxy page) or not Arabic.
 */
export const errorMessageInterceptor: HttpInterceptorFn = (req, next) =>
	next(req).pipe(
		catchError((err: unknown) => {
			if (!(err instanceof HttpErrorResponse) || err.status < 400) return throwError(() => err);
			const body = err.error;
			const original = typeof body === 'string' ? body : body?.message;
			let message: string | null = typeof original === 'string' ? messageForBackendCode(original) : null;
			if (!message && STATUS_MESSAGES[err.status] && !(typeof original === 'string' && ARABIC.test(original))) message = STATUS_MESSAGES[err.status];
			if (!message) return throwError(() => err);
			const next$ = body && typeof body === 'object' ? { ...body, message, rawMessage: original } : { success: false, message, rawMessage: typeof original === 'string' ? original : undefined };
			return throwError(() => new HttpErrorResponse({ error: next$, headers: err.headers, status: err.status, statusText: err.statusText, url: err.url ?? undefined }));
		})
	);
