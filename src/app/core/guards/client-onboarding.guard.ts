import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { ClientOnboardingStateService } from '../services/client-onboarding-state.service';
import { UiNotificationService } from '../services/ui-notification.service';

/** the pages of /client-overview an individual client may use before the registration path is finished and the identity passed the automatic match */
export const CLIENT_ONBOARDING_ALLOWED = ['profile-setup', 'help', 'bebo'] as const;
export const CLIENT_ONBOARDING_PAGE = '/client-overview/profile-setup';
export const CLIENT_ONBOARDING_MESSAGE = 'أكمل مسار «استكمال البيانات» وانتظر مطابقة الهوية أولًا؛ تفتح باقي صفحات لوحتك بعد ذلك.';

/**
 * An individual client enters the dashboard only after the registration path is finished and the identity matched (or was approved). Until then every page
 * under /client-overview lands on the path itself. The server state is the only source; a failed read opens (never locks anyone out). Companies are not touched.
 */
export const clientOnboardingGuard: CanActivateChildFn = (_route, state) => {
	const onboarding = inject(ClientOnboardingStateService);
	const router = inject(Router), notify = inject(UiNotificationService);
	if (!onboarding.applies()) return true;
	const target = state.url.split('?')[0].replace(/^\/client-overview\/?/, '');
	if (CLIENT_ONBOARDING_ALLOWED.some(p => target === p || target.startsWith(p + '/'))) return true;
	return onboarding.load().pipe(map(() => {
		if (onboarding.open() !== false) return true;
		notify.info(CLIENT_ONBOARDING_MESSAGE);
		return router.parseUrl(CLIENT_ONBOARDING_PAGE);
	}));
};
