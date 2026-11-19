import { Injectable, inject } from '@angular/core';
import { AuthStore } from '../store/auth.store';
import { TourDefinition } from './tour.types';
import { ROLE_TOURS } from './tours/role-tours';
import { VISITOR_TOUR } from './tours/visitor.tour';

/** Which tour belongs to whom: a visitor gets the introduction, a signed-in user gets the tour of the role they are acting as (null until that role's tour exists). */
@Injectable({ providedIn: 'root' })
export class TourCatalogService {
	private readonly auth = inject(AuthStore);

	/** the dashboard tour of the signed-in user's current role, or null */
	roleTour(): TourDefinition | null {
		const role = this.auth.actingRole();
		return role ? ROLE_TOURS[role] ?? null : null;
	}

	/** the tour «شاهد كيف يعمل» starts: the visitor tour for a visitor, the role tour for a signed-in user; null = nothing to run (keep the old scroll) */
	mainTour(): TourDefinition | null {
		return this.auth.isAuthenticated() ? this.roleTour() : VISITOR_TOUR;
	}
}
