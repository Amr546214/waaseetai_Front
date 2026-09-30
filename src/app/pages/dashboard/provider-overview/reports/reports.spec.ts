import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { Reports } from './reports';
import { AuthStore } from '../../../../core/store/auth.store';

// Regression coverage for the confirmed bug: the "طلبات العملاء" tab's
// pagination bar showed page "2"/"3" buttons with no click handlers at all,
// alongside a "يُعرض 4 من 12" count — implying more data existed than the
// page (4 real mock rows) actually had. The fix removes the dead controls
// and corrects both counts to the truthful "4", rather than faking
// pagination behavior over data that doesn't exist.
function setup() {
	TestBed.configureTestingModule({
		imports: [Reports],
		providers: [{ provide: AuthStore, useValue: { currentUser: signal(null) } }],
	});
	const fixture: ComponentFixture<Reports> = TestBed.createComponent(Reports);
	return { fixture, component: fixture.componentInstance };
}

describe('Reports (provider) — truthful pagination on the orders tab', () => {
	it('the "orders" tab count matches the actual number of rows rendered (4), not a fabricated 12', () => {
		const { component } = setup();
		const ordersTab = component.tabs().find(t => t.id === 'orders');
		expect(ordersTab?.count).toBe(4);
	});

	it('renders no page-2/3 pagination buttons on the orders tab (previously dead, unclickable controls)', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const text = (fixture.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('يُعرض 4 من 12');
		expect(text).toContain('يُعرض 4 من 4');

		const paginationButtons = Array.from(fixture.nativeElement.querySelectorAll('button'))
			.filter((el: any) => el.textContent?.trim() === '2' || el.textContent?.trim() === '3');
		expect(paginationButtons.length).toBe(0);
	});

	it('keeps the truthful "1" indicator for the single real page of mock data', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const pageOne = Array.from(fixture.nativeElement.querySelectorAll('button'))
			.find((el: any) => el.textContent?.trim() === '1');
		expect(pageOne).toBeTruthy();
	});
});
