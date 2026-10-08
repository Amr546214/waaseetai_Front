import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { MARKETER_EDIT_PAGE, MARKETER_SETUP_MESSAGE, resolveMarketerSetup } from './marketer-setup-state';

/**
 * Opening the marketer wizard by hand when the profile is 100% (or nothing is left for the wizard) lands on the profile page with a light
 * message instead. A failed read never blocks the page.
 */
export const marketerSetupGuard: CanActivateFn = () => {
	const router = inject(Router);
	const notify = inject(UiNotificationService);
	return inject(MarketerProfileService).getProfile().pipe(
		map((res) => {
			if (!res?.success || !res.data) return true;
			const r = resolveMarketerSetup(res.data);
			if (r.kind !== 'redirect') return true;
			notify.info(MARKETER_SETUP_MESSAGE[r.reason]);
			return router.parseUrl(MARKETER_EDIT_PAGE);
		}),
		catchError(() => of(true))
	);
};
