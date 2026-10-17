import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Offers } from './offers';
import { OffersService } from '../../../../core/services/offers.service';
import { AuthStore } from '../../../../core/store/auth.store';

// Withdrawing from the offers list: only where the server says the offer can be withdrawn, with a confirmation, never a false success.
const ROW = (o: Record<string, unknown> = {}) => ({ offerId: 'offer-1', projectId: 'p1', statusKey: 'pending', statusText: 'بانتظار الرد', projectTitle: 'تصميم هوية', offeredPrice: 1000, canWithdraw: true, ...o });

describe('provider offers list: withdraw', () => {
	async function setup(rows: any[], withdraw: any = () => of({ success: true })) {
		const api = { getOffers: vi.fn(() => of({ data: rows })), withdrawOffer: vi.fn(withdraw) };
		await TestBed.configureTestingModule({ imports: [Offers], providers: [provideRouter([]), { provide: OffersService, useValue: api }, { provide: AuthStore, useValue: { currentUser: () => null } }] }).compileComponents();
		const f = TestBed.createComponent(Offers); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, api, q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement | null };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('a withdrawable offer: the detail modal offers "سحب العرض" and asks to confirm first', async () => {
		const s = await setup([ROW()]);
		s.c.handleOfferAction(s.c.offers()[0]); s.f.detectChanges();
		expect(s.q('withdraw-offer')).not.toBeNull();
		s.q('withdraw-offer')!.click(); s.f.detectChanges();
		expect(s.api.withdrawOffer).not.toHaveBeenCalled();
		expect(s.q('withdraw-confirm')!.textContent).toContain('لا يمكن التراجع');
		s.q('withdraw-confirm-no')!.click(); s.f.detectChanges();
		expect(s.q('withdraw-offer')).not.toBeNull();
	});

	it('confirming calls the real endpoint, closes the modal and reloads the list', async () => {
		const s = await setup([ROW()]);
		s.c.handleOfferAction(s.c.offers()[0]); s.f.detectChanges();
		s.q('withdraw-offer')!.click(); s.f.detectChanges();
		s.q('withdraw-confirm-yes')!.click(); s.f.detectChanges();
		expect(s.api.withdrawOffer).toHaveBeenCalledWith('offer-1');
		expect(s.c.selectedPendingOffer()).toBeNull();
		expect(s.api.getOffers).toHaveBeenCalledTimes(2);
	});

	it('a failed withdraw keeps the modal open with the server message', async () => {
		const s = await setup([ROW()], () => throwError(() => ({ error: { message: 'حالة العرض تغيّرت، حدّث الصفحة وحاول مرة أخرى' } })));
		s.c.handleOfferAction(s.c.offers()[0]); s.f.detectChanges();
		s.q('withdraw-offer')!.click(); s.f.detectChanges();
		s.q('withdraw-confirm-yes')!.click(); s.f.detectChanges();
		expect(s.q('withdraw-error')!.textContent).toContain('حالة العرض تغيّرت');
		expect(s.c.selectedPendingOffer()).not.toBeNull();
		expect(s.api.getOffers).toHaveBeenCalledTimes(1);
	});

	it('not withdrawable (server says so): no withdraw button; a CANCELLED offer shows «ملغي», not «مرفوض»', async () => {
		const s = await setup([ROW({ canWithdraw: false, statusKey: 'rejected', statusText: 'ملغي' })]);
		expect(s.el.textContent).toContain('ملغي');
		expect(s.el.textContent).not.toContain('مرفوض');
		s.c.handleOfferAction(s.c.offers()[0]); s.f.detectChanges();
		expect(s.q('withdraw-offer')).toBeNull();
	});
});
