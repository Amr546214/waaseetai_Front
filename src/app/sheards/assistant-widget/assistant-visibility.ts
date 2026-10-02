import type { ActivatedRouteSnapshot } from '@angular/router';

/**
 * The floating assistant (Bebo) is mounted once at the app root and shown on
 * every page EXCEPT routes that opt out with `data: { hideAssistant: true }`
 * (auth pages and error pages). The flag may sit on any route of the active
 * branch, so the whole chain is checked (a parent flag covers its children).
 */
export function isAssistantHidden(root: ActivatedRouteSnapshot | null | undefined): boolean {
	for (let r: ActivatedRouteSnapshot | null | undefined = root; r; r = r.firstChild) {
		if (r.data?.['hideAssistant'] === true) return true;
	}
	return false;
}
