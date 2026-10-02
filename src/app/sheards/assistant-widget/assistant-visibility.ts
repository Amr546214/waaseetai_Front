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

/**
 * Pages with a fixed/sticky bottom action bar ("التالي / السابق / إلغاء") opt in with
 * `data: { assistantLift: true }`. The assistant then floats ASSISTANT_LIFT_PX above the
 * viewport floor (robot.js `floor-offset`), clearing the bar. Measured bar heights with the
 * app CSS: apply 76px, new-project 79px, create-request 87px; 96 leaves a gap on all of them.
 */
export const ASSISTANT_LIFT_PX = 96;

export function assistantLiftPx(root: ActivatedRouteSnapshot | null | undefined): number {
	for (let r: ActivatedRouteSnapshot | null | undefined = root; r; r = r.firstChild) {
		if (r.data?.['assistantLift'] === true) return ASSISTANT_LIFT_PX;
	}
	return 0;
}
