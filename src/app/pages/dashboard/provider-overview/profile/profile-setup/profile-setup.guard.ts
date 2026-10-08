import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AccountType } from '../../../../../core/models/auth.model';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { PROVIDER_EDIT_PAGE, PROVIDER_SETUP_REDIRECT_MESSAGE, resolveProviderSetup } from './provider-setup-state';

/**
 * The individual provider's wizard has nothing left to do once the form AND the classification test are done: opening its URL by hand then lands on
 * the profile edit page with a light message. Companies are not touched, and a failed read never blocks the page.
 */
export const providerSetupGuard: CanActivateFn = () => {
	const authStore = inject(AuthStore);
	const router = inject(Router);
	const api = inject(ProfileApiService);
	const notify = inject(UiNotificationService);
	if (authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY) return true;
	return api.getProviderProfileSetup().pipe(
		map((res: any) => {
			const r = resolveProviderSetup(res?.data);
			if (r.kind !== 'redirect') return true;
			notify.info(PROVIDER_SETUP_REDIRECT_MESSAGE);
			return router.parseUrl(PROVIDER_EDIT_PAGE);
		}),
		catchError(() => of(true))
	);
};
