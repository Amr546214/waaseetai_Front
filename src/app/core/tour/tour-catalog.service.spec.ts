import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthStore } from '../store/auth.store';
import { UserRole } from '../models/auth.model';
import { TourCatalogService } from './tour-catalog.service';
import { VISITOR_TOUR } from './tours/visitor.tour';
import { ROLE_TOURS } from './tours/role-tours';

describe('TourCatalogService', () => {
	const make = (authed: boolean, role: UserRole | null) => {
		TestBed.configureTestingModule({ providers: [{ provide: AuthStore, useValue: { isAuthenticated: signal(authed), actingRole: signal(role) } }] });
		return TestBed.inject(TourCatalogService);
	};
	it('a visitor gets the introduction tour', () => { expect(make(false, null).mainTour()).toBe(VISITOR_TOUR); });
	it('a signed-in user gets the tour of the role they act as; a role without a tour gets null (keeps the old scroll)', () => {
		const svc = make(true, UserRole.CLIENT);
		expect(svc.mainTour()).toBe(ROLE_TOURS[UserRole.CLIENT] ?? null);
		const demo = { id: 'demo-client', title: 'd', steps: [{ id: 'd1', title: 't', text: 'نص' }] };
		(ROLE_TOURS as any)[UserRole.CLIENT] = demo;
		expect(svc.mainTour()).toBe(demo); expect(svc.roleTour()).toBe(demo);
		delete (ROLE_TOURS as any)[UserRole.CLIENT];
	});
});
