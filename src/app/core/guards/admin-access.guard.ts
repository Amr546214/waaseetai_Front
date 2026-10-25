import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAccessService } from '../services/admin-access.service';
import { AccessRule } from '../config/admin-access-rules';

/**
 * Entry to an admin page: needs the rule in `route.data.access`. Convenience only (the server refuses the data anyway): a direct link, a refresh or a bookmark lands on the clear
 * «no access» page instead of an empty or half-working screen. When the access state cannot be read the answer is NO (never open by default).
 */
export const adminAccessGuard: CanActivateFn = async (route, state) => {
	if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
	const access = inject(AdminAccessService), router = inject(Router);
	await access.ensure();
	const rule = (route.data?.['access'] ?? { member: true }) as AccessRule;
	if (access.status() !== 'ready') return router.createUrlTree(['/supper-admin-overview/no-access'], { queryParams: { reason: 'unavailable', from: state.url } });
	if (access.allows(rule)) return true;
	return router.createUrlTree(['/supper-admin-overview/no-access'], { queryParams: { reason: access.state() === 'ACTIVE' || access.state() === 'OWNER' ? 'denied' : (access.state() ?? 'denied'), from: state.url } });
};
