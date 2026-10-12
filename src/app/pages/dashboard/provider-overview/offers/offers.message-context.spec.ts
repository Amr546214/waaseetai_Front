import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Offers } from './offers';
import { OfferNegotiate } from './negotiate/negotiate';
import { OffersService } from '../../../../core/services/offers.service';
import { AuthStore } from '../../../../core/store/auth.store';

// "Message the client" from the offers pages must pass the PROJECT's id (an offer id is not a project id), so the messages page opens that
// project's conversation. The old code passed the offer id, which could never match any conversation.
const ITEM = { offerId: 'offer-1', id: 'offer-1', projectId: 'project-9', projectTitle: 'تصميم هوية', projectRef: '#ORD-9', offeredPrice: 1000, statusKey: 'pending', status: 'SUBMITTED', clientName: 'سارة', clientType: 'INDIVIDUAL', duration: '10 يوم', actionText: 'فتح العرض' };

describe('provider offers: message context carries the real project id', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('offers list: "message the client" navigates with projectId = the project\'s id, not the offer id', async () => {
		TestBed.configureTestingModule({ imports: [Offers], providers: [provideRouter([]), { provide: OffersService, useValue: { getOffers: () => of({ data: [ITEM] }) } }, { provide: AuthStore, useValue: { currentUser: () => null } }] });
		const f = TestBed.createComponent(Offers); f.detectChanges();
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		const offer = f.componentInstance.offers()[0];
		expect(offer.projectId).toBe('project-9');
		f.componentInstance.messageOfferClient(offer);
		const [cmd, extras] = nav.mock.calls[0] as any[];
		expect(cmd).toEqual(['/provider-overview/messages']);
		expect(extras.state.messageContext).toMatchObject({ type: 'PROJECT', projectId: 'project-9', projectTitle: 'تصميم هوية' });
		expect(extras.state.messageContext.projectId).not.toBe('offer-1');
	});

	it('offers list: an item without a projectId passes none (the messages page then opens nothing and explains) — never the offer id', async () => {
		const { projectId, ...noProject } = ITEM; void projectId;
		TestBed.configureTestingModule({ imports: [Offers], providers: [provideRouter([]), { provide: OffersService, useValue: { getOffers: () => of({ data: [noProject] }) } }, { provide: AuthStore, useValue: { currentUser: () => null } }] });
		const f = TestBed.createComponent(Offers); f.detectChanges();
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		f.componentInstance.messageOfferClient(f.componentInstance.offers()[0]);
		expect((nav.mock.calls[0] as any[])[1].state.messageContext.projectId).toBeUndefined();
	});

	it('negotiate page: opens the conversation with the offer\'s project id, not the offer id', async () => {
		TestBed.configureTestingModule({ imports: [OfferNegotiate], providers: [provideRouter([]), { provide: OffersService, useValue: { getOfferById: () => of(ITEM) } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
			{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'offer-1' })), snapshot: { paramMap: convertToParamMap({ id: 'offer-1' }) } } }] });
		const f = TestBed.createComponent(OfferNegotiate); f.detectChanges(); await f.whenStable();
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		f.componentInstance.openConversation();
		const ctx = (nav.mock.calls[0] as any[])[1].state.messageContext;
		expect(ctx).toMatchObject({ type: 'PROJECT', projectId: 'project-9' });
		expect(ctx.projectId).not.toBe('offer-1');
	});
});
