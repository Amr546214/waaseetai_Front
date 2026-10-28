import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AccessRule, ruleForPath } from '../../../../core/config/admin-access-rules';
import { AdminAccessService } from '../../../../core/services/admin-access.service';

/** the pages of «التحكم بالموقع» in menu order: «الهوية» (server-backed) first, then the nine local-only pages */
export const SITE_CONTROL_PAGES = ['identity', 'health', 'tokens', 'icons', 'accounts', 'templates', 'typography', 'style-guide', 'live-preview', 'export'] as const;

/** the first page of the section the account may open (null = none): the section link never lands on a page that would refuse the visitor */
export function firstAllowedSiteControlPage(allows: (rule: AccessRule) => boolean): (typeof SITE_CONTROL_PAGES)[number] | null {
	return SITE_CONTROL_PAGES.find(p => allows(ruleForPath(`site-control/${p}`))) ?? null;
}

/** `/site-control` itself: sends the visitor to the first page they may open. Convenience only - every page keeps its own access guard and the server enforces every request. */
export const siteControlLandingGuard: CanActivateFn = async () => {
	if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
	const access = inject(AdminAccessService), router = inject(Router);
	await access.ensure();
	if (access.status() !== 'ready') return router.createUrlTree(['/supper-admin-overview/no-access'], { queryParams: { reason: 'unavailable' } });
	const page = firstAllowedSiteControlPage(rule => access.allows(rule));
	return router.createUrlTree(page ? ['/supper-admin-overview/site-control', page] : ['/supper-admin-overview/no-access'], page ? {} : { queryParams: { reason: 'denied' } });
};
