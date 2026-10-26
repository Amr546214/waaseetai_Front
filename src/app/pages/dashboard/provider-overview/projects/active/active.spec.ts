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
	{ id: '1', title: 'p1', status: 'wait', statusLabel: 'بانتظار', progress: 50, providerName: 'a', providerInitial: 'A', providerAvatarColor: '#000', currentStage: 's', escrowAmount: '100', escrowLabel: 'e', meta: 'm', heldAmount: 100, escrowFunded: true, canUploadDelivery: false, uploadBlockedReason: 'التسليم الحالي بانتظار مراجعة العميل' },
	{ id: '2', title: 'p2', status: 'run', statusLabel: 'قيد التنفيذ', progress: 30, providerName: 'b', providerInitial: 'B', providerAvatarColor: '#000', currentStage: 's', escrowAmount: '100', escrowLabel: 'e', meta: 'm', heldAmount: 0, escrowFunded: false, canUploadDelivery: true },
	{ id: '3', title: 'p3', status: 'pending', statusLabel: 'بانتظار توقيعك على العقد', progress: 0, providerName: 'c', providerInitial: 'C', providerAvatarColor: '#000', currentStage: 's', escrowAmount: '500 $', escrowLabel: 'قيمة العقد (غير ممولة بعد)', meta: 'm', heldAmount: 0, escrowFunded: false, canUploadDelivery: false, uploadBlockedReason: 'العقد بانتظار توقيعك', disputeStatus: 'OPEN' },
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

describe('Active (provider active projects) — real states, no invented labels', () => {
	it('sums only funded escrows, counts action items from canUploadDelivery, and has no invented health label', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();
		const c = component.counts() as any;
		expect(c.totalEscrowFormatted).toBe('100.00 USD');
		component.projects.set([{ ...component.projects()[0], heldAmount: 100, currency: 'USD' }, { ...component.projects()[0], heldAmount: 50, currency: 'SAR' }]);
		expect((component.counts() as any).totalEscrowFormatted).toBe('100.00 USD · 50.00 SAR');
		expect(c.needsAction).toBe(1);
		expect(c.pending).toBe(1);
		expect(c.healthStatus).toBeUndefined();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('ممتاز');
		expect(text).toContain('تحتاج إجراءً منك');
		expect(text).toContain('بانتظار رد العميل');
		expect(text).not.toContain('بانتظار التسليم');
	});

	it('shows the server reason, the dispute badge, and locks only a funded escrow', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const el = fixture.nativeElement as HTMLElement;
		expect(el.querySelectorAll('[data-testid="upload-blocked-reason"]').length).toBe(2);
		expect(el.textContent).toContain('العقد بانتظار توقيعك');
		expect(el.querySelectorAll('[data-testid="dispute-badge"]').length).toBe(1);
		expect(el.querySelectorAll('.pl-esc svg').length).toBe(1);
	});

	it('the "pending" tab lists contracts that have not started', () => {
		const { fixture, component } = setup({ filter: 'pending' });
		fixture.detectChanges();
		expect(component.activeFilter()).toBe('pending');
		expect(component.filteredProjects().map(p => p.id)).toEqual(['3']);
	});
});
