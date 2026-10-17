import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Offers } from './offers';
import { OffersService } from '../../../../core/services/offers.service';
import { AuthStore } from '../../../../core/store/auth.store';

// A valid offer never disappears from the provider's list: under "الكل" every status shows (cancelled, selected by the client, negotiating, pending),
// and each status tab shows exactly its own offers; going back to "الكل" brings all of them back.
const row = (id: string, o: Record<string, unknown>) => ({ offerId: id, projectId: `p-${id}`, projectTitle: `QA ${id}`, projectRef: `#R-${id}`, offeredPrice: 900, clientType: 'INDIVIDUAL', canWithdraw: true, ...o });
const ROWS = [
	row('sel', { status: 'PENDING_CLIENT_SIGNATURE', statusKey: 'pending_response', statusText: 'اختارك العميل — يستكمل التوقيع والضمان' }),
	row('neg', { status: 'UNDER_NEGOTIATION', statusKey: 'nego', statusText: 'تفاوض جارٍ' }),
	row('can', { status: 'CANCELLED', statusKey: 'rejected', statusText: 'ملغي' }),
	row('pen', { status: 'SUBMITTED', statusKey: 'pending', statusText: 'بانتظار الرد' })
];

describe('provider offers list: no valid offer disappears', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('shows every status under "all" and each tab shows its own offers', async () => {
		const api = { getOffers: vi.fn(() => of({ data: ROWS })) };
		await TestBed.configureTestingModule({ imports: [Offers], providers: [provideRouter([]), { provide: OffersService, useValue: api }, { provide: AuthStore, useValue: { currentUser: () => null } }] }).compileComponents();
		const f = TestBed.createComponent(Offers); f.detectChanges();
		const c = f.componentInstance;
		const ids = () => c.filteredOffers().map(o => o.id ?? (o as any).offerId).sort();
		expect(c.filteredOffers().length).toBe(4);
		c.activeStatus.set('nego'); expect(c.filteredOffers().length).toBe(1);
		c.activeStatus.set('pending'); expect(c.filteredOffers().length).toBe(2); // pending + pending_response (the client selected it)
		c.activeStatus.set('all'); expect(c.filteredOffers().length).toBe(4);
		void ids;
	});
});
