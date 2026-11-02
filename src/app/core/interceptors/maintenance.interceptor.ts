import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { PlatformInfoService } from '../services/platform-info.service';

/** The server answers 503 {code:'MAINTENANCE'} to everything but the exempt areas while maintenance mode is on: remember the message so the banner can explain it. The error itself still reaches the caller. */
export const maintenanceInterceptor: HttpInterceptorFn = (req, next) => {
	const info = inject(PlatformInfoService);
	return next(req).pipe(catchError((e: unknown) => {
		if (e instanceof HttpErrorResponse && e.status === 503 && e.error?.code === 'MAINTENANCE') info.setMaintenance(String(e.error?.message ?? ''));
		return throwError(() => e);
	}));
};
