import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Offers } from './offers';
import { OffersService } from '../../../../core/services/offers.service';
import { AuthStore } from '../../../../core/store/auth.store';

// The details dialog says "waiting for the client" only for an offer that is really waiting; cancelled / rejected / accepted / pending_signature say what they are.
const ROW = (o: Record<string, unknown>) => ({ offerId: 'offer-1', projectId: 'p1', projectTitle: 'تصميم هوية', offeredPrice: 1000, canWithdraw: false, ...o });

describe('provider offers: dialog text per status', () => {
	async function noteFor(row: any): Promise<string> {
		const api = { getOffers: vi.fn(() => of({ data: [row] })) };
		await TestBed.configureTestingModule({ imports: [Offers], providers: [provideRouter([]), { provide: OffersService, useValue: api }, { provide: AuthStore, useValue: { currentUser: () => null } }] }).compileComponents();
		const f = TestBed.createComponent(Offers); f.detectChanges();
		f.componentInstance.selectedPendingOffer.set(f.componentInstance.offers()[0]); f.detectChanges();
		return (f.nativeElement.querySelector('[data-testid="offer-note"]') as HTMLElement).textContent!;
	}
	afterEach(() => TestBed.resetTestingModule());

	it('cancelled: says cancelled, not waiting for review', async () => {
		const t = await noteFor(ROW({ statusKey: 'rejected', statusText: 'ملغي' }));
		expect(t).toContain('ملغي');
		expect(t).not.toContain('بانتظار مراجعة');
	});
	it('rejected: says rejected, not waiting for review', async () => {
		const t = await noteFor(ROW({ statusKey: 'rejected', statusText: 'مرفوض' }));
		expect(t).toContain('رفض');
		expect(t).not.toContain('بانتظار مراجعة');
	});
	it('accepted and pending_signature have their own text', async () => {
		expect(await noteFor(ROW({ statusKey: 'accepted', statusText: 'تم التعاقد' }))).toContain('تم التعاقد');
		TestBed.resetTestingModule();
		expect(await noteFor(ROW({ statusKey: 'pending_signature', statusText: 'قُبل — توقيعك مطلوب' }))).toContain('توقيعك');
	});
	it('a really pending offer still says it waits for the client', async () => {
		expect(await noteFor(ROW({ statusKey: 'pending', statusText: 'بانتظار الرد' }))).toContain('بانتظار مراجعة طالب الخدمة');
	});
	it('client still completing signing is not described as a plain review wait', async () => {
		const t = await noteFor(ROW({ statusKey: 'pending_response', statusText: 'اختارك العميل — يستكمل التوقيع والضمان' }));
		expect(t).toContain('يستكمل التوقيع');
	});
});
