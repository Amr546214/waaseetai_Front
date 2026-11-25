import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { AccountType } from '../../../../../core/models/auth.model';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { ClientOnboardingStateService } from '../../../../../core/services/client-onboarding-state.service';
import { CLIENT_EDIT_PAGE, SETUP_REDIRECT_MESSAGE, resolveClientSetup } from './profile-setup-state';

/**
 * The wizard is for an INDIVIDUAL client who still has something to collect. At 100% (or nothing left for the wizard) opening its URL by hand
 * lands on the edit page with a light message instead. Companies are not touched (their setup is "coming soon"), and a failed read never blocks.
 */
export const clientSetupGuard: CanActivateFn = () => {
	const authStore = inject(AuthStore);
	const router = inject(Router);
	const api = inject(ProfileApiService);
	const notify = inject(UiNotificationService);
	if (authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY) return true;
	const onboarding = inject(ClientOnboardingStateService);
	return api.getClientProfileSetup().pipe(
		switchMap((res: any) => {
			const r = resolveClientSetup(res?.data);
			if (r.kind !== 'redirect') return of(true as boolean | ReturnType<Router['parseUrl']>);
			// nothing left to collect, but the identity has not matched / been approved yet: the wizard (its identity step) is where the person waits
			return onboarding.load(true).pipe(map(() => {
				if (onboarding.closed()) return true as boolean | ReturnType<Router['parseUrl']>;
				notify.info(SETUP_REDIRECT_MESSAGE[r.reason]);
				return router.parseUrl(CLIENT_EDIT_PAGE);
			}));
		}),
		catchError(() => of(true))
	);
};
