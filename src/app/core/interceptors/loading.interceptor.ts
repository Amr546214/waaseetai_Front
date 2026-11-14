import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

// Pass `context: new HttpContext().set(SKIP_LOADING, true)` on a request (e.g. background
// polling like chat/notifications) to keep it from triggering the full-page loading overlay.
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
	// 1. Explicit skip via context or header
	if (req.context.get(SKIP_LOADING) || req.headers.has('X-Skip-Loading') || req.headers.has('X-Silent-Loading')) {
		return next(req);
	}

	// 1b. The identity editors (colours, fonts, icons, components, logos) show their OWN busy state on the control being used: their requests never take the whole-page loader
	// (it flashed the console on every check / apply / restore and on each section's first read).
	if (req.url.includes('/admin/site-identity/') || req.url.includes('/public/site-identity')) {
		return next(req);
	}

	// 2. File and photo uploads: uploads must NOT hijack the entire viewport with a full-page modal loader.
	// Components display their own local progress bars, upload spinners, and status badges.
	const isUpload =
		req.body instanceof FormData ||
		req.reportProgress ||
		req.url.includes('/upload') ||
		req.url.includes('/documents/upload') ||
		req.url.includes('/delivery/upload');

	if (isUpload) {
		return next(req);
	}

	// 3. In-page search queries: typing in a search bar must never trigger a full-screen loading screen takeover.
	const isSearchQuery = req.params.has('search') || req.params.has('q') || req.params.has('query');
	if (isSearchQuery) {
		return next(req);
	}

	const loadingService = inject(LoadingService);
	loadingService.start();

	return next(req).pipe(
		finalize(() => loadingService.stop())
	);
};
