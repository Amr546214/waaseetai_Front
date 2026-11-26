import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { ClientOnboardingStateService } from '../services/client-onboarding-state.service';
import { UiNotificationService } from '../services/ui-notification.service';

/** the pages of /client-overview an individual client may use before the registration path is finished and the identity passed the automatic match */
export const CLIENT_ONBOARDING_ALLOWED = ['profile-setup', 'finance/payment-methods', 'help', 'bebo'] as const;
export const CLIENT_ONBOARDING_PAGE = '/client-overview/profile-setup';
/** the path is finished, the identity is still under review: the only page + the support contact pages */
export const CLIENT_REVIEW_PAGE = '/client-overview/review-wait';
export const CLIENT_REVIEW_ALLOWED = ['review-wait', 'finance/payment-methods', 'help/tickets'] as const;
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
	const within = (list: readonly string[]) => list.some(p => target === p || target.startsWith(p + '/'));
	const isWait = target === 'review-wait';
	return onboarding.load().pipe(map(() => {
		// reading failed / unknown: never lock anyone out (the waiting page itself is then pointless)
		if (onboarding.reviewing()) return within(CLIENT_REVIEW_ALLOWED) ? true : router.parseUrl(CLIENT_REVIEW_PAGE);
		if (isWait) return router.parseUrl(onboarding.open() === false ? CLIENT_ONBOARDING_PAGE : '/client-overview');
		if (onboarding.open() !== false) return true;
		if (within(CLIENT_ONBOARDING_ALLOWED)) return true;
		notify.info(CLIENT_ONBOARDING_MESSAGE);
		return router.parseUrl(CLIENT_ONBOARDING_PAGE);
	}));
};
