import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { Offers } from './offers';
import { OffersService } from '../../../../core/services/offers.service';
import { AuthStore } from '../../../../core/store/auth.store';

// Before the first response the offers page must not show invented numbers (8/4/2/2) or a canned "وسيط AI: لديك عرضان قيد التفاوض" line.
// After the response the counts and the banner text come from the API / the loaded rows only.
function render(getOffers: () => any) {
	TestBed.configureTestingModule({
		imports: [Offers],
		providers: [provideRouter([]), { provide: OffersService, useValue: { getOffers } }, { provide: AuthStore, useValue: { currentUser: () => null } }],
	});
	const f = TestBed.createComponent(Offers);
	f.detectChanges();
	return f;
}

describe('Offers page - no fabricated initial state', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('before the response: all status counts are 0 and the banner makes no AI / negotiation claim', () => {
		const f = render(() => NEVER);
		expect(f.componentInstance.statusOptions.map(o => o.count)).toEqual([0, 0, 0, 0]);
		const text = (f.nativeElement as HTMLElement).textContent || '';
		expect(text).not.toContain('لديك عرضان قيد التفاوض');
		expect(text).not.toContain('وسيط AI:');
		expect(f.componentInstance.bannerText()).toBe('تابع عروضك المرسلة وردود العملاء من هنا.');
	});

	it('after the response without server counts: counts are derived from the loaded rows', () => {
		const rows = [
			{ offerId: 'a', statusKey: 'pending', projectTitle: 'x', offeredPrice: 10 },
			{ offerId: 'b', statusKey: 'pending', projectTitle: 'y', offeredPrice: 20 },
			{ offerId: 'c', statusKey: 'nego', projectTitle: 'z', offeredPrice: 30 },
		];
		const f = render(() => of({ data: rows }));
		const byId = Object.fromEntries(f.componentInstance.statusOptions.map(o => [o.id, o.count]));
		expect(byId).toEqual({ all: 3, pending: 2, accepted: 0, nego: 1 });
	});

	it('server counts and the server banner text win when they are sent', () => {
		const f = render(() => of({ data: [], counts: { all: 5, pending: 3, accepted: 1, nego: 1 }, aiBannerText: 'نص من الخادم' }));
		expect(f.componentInstance.statusOptions.map(o => o.count)).toEqual([5, 3, 1, 1]);
		expect(f.componentInstance.bannerText()).toBe('نص من الخادم');
	});
});
