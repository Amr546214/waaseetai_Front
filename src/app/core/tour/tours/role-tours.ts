import { UserRole } from '../../models/auth.model';
import { TourDefinition } from '../tour.types';
import { CLIENT_TOUR, CLIENT_DASHBOARD_ROUTE } from './client.tour';
import { PROVIDER_TOUR, PROVIDER_DASHBOARD_ROUTE } from './provider.tour';

/**
 * The dashboard tour of each role (what every page, tab and button does). A role with no entry has no tour yet; «شاهد كيف يعمل» then keeps its old behaviour for that role.
 * Filled in role by role: client, provider (marketer / admin have none yet).
 */
export const ROLE_TOURS: Partial<Record<UserRole, TourDefinition>> = {
	[UserRole.CLIENT]: CLIENT_TOUR,
	[UserRole.PROVIDER]: PROVIDER_TOUR,
};

/** the dashboard area (URL prefix) each role's tour lives in: the «جولة في لوحتك» chip is offered only there */
export const ROLE_TOUR_AREAS: Partial<Record<UserRole, string>> = {
	[UserRole.CLIENT]: CLIENT_DASHBOARD_ROUTE,
	[UserRole.PROVIDER]: PROVIDER_DASHBOARD_ROUTE,
};
