import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AccessRule, ruleForPath } from '../../../../core/config/admin-access-rules';
import { AdminAccessService } from '../../../../core/services/admin-access.service';

/** the pages of «التحكم بالموقع» in menu order: «الهوية» (which now holds the colours, fonts, icons and component editors as sections) first, then the pages that stay */
export const SITE_CONTROL_PAGES = ['identity', 'accounts', 'export'] as const;

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

/**
 * The old pages of the identity tools (القيم والألوان, الخطوط, مكتبة الأيقونات, القوالب) are sections of «الهوية» now. An old link, bookmark or history entry lands on the matching section of that page.
 * The ACCESS RULE of the old path is checked first: a visitor the old page would have refused is not sent anywhere by this guard (the access guard that follows refuses them as before), so the move
 * grants nothing. The server still decides every request.
 */
export const IDENTITY_SECTION_FOR: Record<string, string> = { tokens: 'colors', typography: 'typography', icons: 'icons', templates: 'components' };
export const identitySectionRedirect = (oldPage: keyof typeof IDENTITY_SECTION_FOR): CanActivateFn => async () => {
	if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
	const access = inject(AdminAccessService), router = inject(Router);
	await access.ensure();
	if (access.status() !== 'ready' || !access.allows(ruleForPath(`site-control/${oldPage}`))) return true;
	return router.createUrlTree(['/supper-admin-overview/site-control/identity'], { fragment: IDENTITY_SECTION_FOR[oldPage] });
};
