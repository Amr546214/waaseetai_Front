import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { Active } from './active';
import { ActiveProjectsService } from '../../../../../core/services/active.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// Regression coverage for the provider dashboard's "awaiting delivery" deep
// link: the dashboard cards now pass ?filter=wait, and this page must read
// it on load and pre-select the matching tab — previously the query param
// was ignored entirely and the page always opened on the unfiltered "all" tab.

const projects = [
	{ id: '1', title: 'p1', status: 'wait', statusLabel: 'بانتظار', progress: 50, providerName: 'a', providerInitial: 'A', providerAvatarColor: '#000', currentStage: 's', escrowAmount: '100', escrowLabel: 'e', meta: 'm' },
	{ id: '2', title: 'p2', status: 'run', statusLabel: 'قيد التنفيذ', progress: 30, providerName: 'b', providerInitial: 'B', providerAvatarColor: '#000', currentStage: 's', escrowAmount: '100', escrowLabel: 'e', meta: 'm' },
];

function setup(queryParams: Record<string, string> = {}) {
	const fakeActiveProjectsService = { getActiveProjects: () => of({ success: true, data: projects }) };
	const fakeAuthStore = { currentUser: signal(null) };

	TestBed.configureTestingModule({
		imports: [Active],
		providers: [
			{ provide: ActiveProjectsService, useValue: fakeActiveProjectsService },
			{ provide: AuthStore, useValue: fakeAuthStore },
			{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
		],
	});

	const fixture: ComponentFixture<Active> = TestBed.createComponent(Active);
	const component = fixture.componentInstance;
	return { fixture, component };
}

describe('Active (provider active projects) — awaiting-delivery deep link', () => {
	it('defaults to the "all" filter when no query param is present', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();
		expect(component.activeFilter()).toBe('all');
	});

	it('pre-selects the "wait" (awaiting delivery) tab when ?filter=wait is present', () => {
		const { fixture, component } = setup({ filter: 'wait' });
		fixture.detectChanges();
		expect(component.activeFilter()).toBe('wait');
		expect(component.filteredProjects().every(p => p.status === 'wait')).toBe(true);
	});

	it('ignores an unrecognized filter value and falls back to "all" rather than crashing', () => {
		const { fixture, component } = setup({ filter: 'not-a-real-status' });
		fixture.detectChanges();
		expect(component.activeFilter()).toBe('all');
	});
});
