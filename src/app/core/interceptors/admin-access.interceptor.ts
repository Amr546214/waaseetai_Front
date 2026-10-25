import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ADMIN_DENIED_CODES, AdminAccessService } from '../services/admin-access.service';

/**
 * When the server refuses an ADMIN request with a permission code, the account's permissions were withdrawn (or never existed): read them again so the menu, the page and the buttons
 * follow at once instead of staying as they were when the page opened. The refusal itself is passed on untouched (the page shows its own message).
 */
export const adminAccessInterceptor: HttpInterceptorFn = (req, next) => {
	const access = inject(AdminAccessService);
	return next(req).pipe(catchError((e: unknown) => {
		if (e instanceof HttpErrorResponse && e.status === 403 && /\/admin\//.test(req.url) && !/\/admin\/team\/access\/me/.test(req.url) && ADMIN_DENIED_CODES.includes(String((e.error as { code?: unknown })?.code ?? ''))) void access.refresh();
		return throwError(() => e);
	}));
};
