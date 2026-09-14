import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

// Pass `context: new HttpContext().set(SKIP_LOADING, true)` on a request (e.g. background
// polling like chat/notifications) to keep it from triggering the full-page loading overlay.
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
	if (req.context.get(SKIP_LOADING)) {
		return next(req);
	}

	const loadingService = inject(LoadingService);
	loadingService.start();

	return next(req).pipe(
		finalize(() => loadingService.stop())
	);
};
