import { UserRole } from '../../models/auth.model';
import { TourDefinition } from '../tour.types';

/**
 * The dashboard tour of each role (what every page, tab and button does). A role with no entry has no tour yet; «شاهد كيف يعمل» then keeps its old behaviour for that role.
 * Filled in role by role: client, then provider.
 */
export const ROLE_TOURS: Partial<Record<UserRole, TourDefinition>> = {};
