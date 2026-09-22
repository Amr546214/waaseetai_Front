import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { RequestDetails } from './request-details';
import { ThemeService } from '../../../../../core/services/theme.service';
import { ChatService } from '../../../../../core/services/chat.service';

function makeOffer(overrides: Partial<any> = {}): any {
	return {
		id: overrides['id'] ?? 'o1',
		status: 'PENDING',
		providerName: overrides['providerName'] ?? 'مقدم الخدمة',
		providerInitials: 'مخ',
		providerLevel: 'مستوى 3',
		levelColor: '#2BD4C7',
		specialty: 'تطوير',
		projectsCount: 4,
		rating: null,
		matchScore: null,
		price: '1,000 ريال',
		duration: '5 أيام',
		description: 'وصف العرض',
		plan: 'خطة العمل',
		files: [],
		aiAnalysis: {
			fairPrice: null,
			priceNote: null,
			priceNoteType: 'fair',
			fairDuration: null,
			durationNote: null,
			durationNoteType: 'fair',
			verdict: null,
			verdictType: 'fair'
		},
		...overrides
	};
}

describe('RequestDetails — Compare Offers', () => {
	let component: RequestDetails;
	let fixture: ComponentFixture<RequestDetails>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [RequestDetails],
			providers: [
				{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
				{ provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
				{ provide: HttpClient, useValue: { get: () => of({ success: false }), post: () => of({ success: false }) } },
				{ provide: ThemeService, useValue: { theme: () => 'dark' } },
				{ provide: ChatService, useValue: {} }
			]
		}).compileComponents();

		fixture = TestBed.createComponent(RequestDetails);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('hides the compare button when there are 0 offers', async () => {
		component.offers.set([]);
		fixture.detectChanges();
		await fixture.whenStable();
		const html: string = fixture.nativeElement.innerHTML;
		expect(html).not.toContain('مقارنة العروض');
	});

	it('hides the compare button when there is only 1 offer', async () => {
		component.offers.set([makeOffer({ id: 'o1' })]);
		fixture.detectChanges();
		await fixture.whenStable();
		const html: string = fixture.nativeElement.innerHTML;
		expect(html).not.toContain('مقارنة العروض');
	});

	it('shows the compare button when there are 2 or more offers', async () => {
		component.offers.set([makeOffer({ id: 'o1' }), makeOffer({ id: 'o2', providerName: 'مقدم 2' })]);
		fixture.detectChanges();
		await fixture.whenStable();
		const html: string = fixture.nativeElement.innerHTML;
		expect(html).toContain('مقارنة العروض');
	});

	it('does not enter compare mode selection state until toggled', () => {
		expect(component.isCompareMode()).toBe(false);
		expect(component.selectedForCompare()).toEqual([]);
	});

	it('toggleCompare flips compare mode and clears selection on exit', () => {
		component.toggleCompare();
		expect(component.isCompareMode()).toBe(true);

		component.selectedForCompare.set(['مقدم 1']);
		component.toggleCompare();
		expect(component.isCompareMode()).toBe(false);
		expect(component.selectedForCompare()).toEqual([]);
	});

	it('cannot select offers while compare mode is off', () => {
		component.toggleSelectOffer('مقدم 1');
		expect(component.selectedForCompare()).toEqual([]);
	});

	it('toggles offer selection on and off while in compare mode', () => {
		component.toggleCompare();
		component.toggleSelectOffer('مقدم 1');
		expect(component.selectedForCompare()).toEqual(['مقدم 1']);

		component.toggleSelectOffer('مقدم 1');
		expect(component.selectedForCompare()).toEqual([]);
	});

	it('enforces a maximum of 3 selected offers', () => {
		component.toggleCompare();
		component.toggleSelectOffer('مقدم 1');
		component.toggleSelectOffer('مقدم 2');
		component.toggleSelectOffer('مقدم 3');
		component.toggleSelectOffer('مقدم 4');

		expect(component.selectedForCompare()).toEqual(['مقدم 1', 'مقدم 2', 'مقدم 3']);
		expect(component.selectedForCompare().length).toBe(3);
	});

	it('confirmCompare requires at least 2 selected offers before opening the comparison view', () => {
		component.toggleCompare();
		component.toggleSelectOffer('مقدم 1');
		component.confirmCompare();
		expect(component.showComparisonView()).toBe(false);

		component.toggleSelectOffer('مقدم 2');
		component.confirmCompare();
		expect(component.showComparisonView()).toBe(true);
	});

	it('closeComparisonView hides the comparison view', () => {
		component.toggleCompare();
		component.toggleSelectOffer('مقدم 1');
		component.toggleSelectOffer('مقدم 2');
		component.confirmCompare();
		expect(component.showComparisonView()).toBe(true);

		component.closeComparisonView();
		expect(component.showComparisonView()).toBe(false);
	});

	it('cancelCompare exits compare mode and clears the selection', () => {
		component.toggleCompare();
		component.toggleSelectOffer('مقدم 1');
		component.cancelCompare();
		expect(component.isCompareMode()).toBe(false);
		expect(component.selectedForCompare()).toEqual([]);
	});

	it('comparisonOffers derives only the selected offers, in the same shape as offers()', () => {
		const offerA = makeOffer({ id: 'a', providerName: 'مقدم أ' });
		const offerB = makeOffer({ id: 'b', providerName: 'مقدم ب' });
		const offerC = makeOffer({ id: 'c', providerName: 'مقدم ج' });
		component.offers.set([offerA, offerB, offerC]);

		component.toggleCompare();
		component.toggleSelectOffer('مقدم أ');
		component.toggleSelectOffer('مقدم ج');

		const result = component.comparisonOffers();
		expect(result.map(o => o.id)).toEqual(['a', 'c']);
	});

	it('renders "غير متاح" instead of a fabricated value for null rating, matchScore and AI analysis fields', async () => {
		const offerA = makeOffer({ id: 'a', providerName: 'مقدم أ' });
		const offerB = makeOffer({ id: 'b', providerName: 'مقدم ب' });
		component.offers.set([offerA, offerB]);
		component.selectedForCompare.set(['مقدم أ', 'مقدم ب']);
		component.showComparisonView.set(true);
		fixture.detectChanges();
		await fixture.whenStable();

		const html: string = fixture.nativeElement.innerHTML;
		expect(html).toContain('غير متاح');
		expect(html).not.toContain('null%');
		expect(html).not.toContain('دقة 95%');
	});

	it('never displays a hardcoded fake AI confidence score', async () => {
		const offerA = makeOffer({ id: 'a', providerName: 'مقدم أ', matchScore: 42 });
		const offerB = makeOffer({ id: 'b', providerName: 'مقدم ب' });
		component.offers.set([offerA, offerB]);
		fixture.detectChanges();
		await fixture.whenStable();

		const html: string = fixture.nativeElement.innerHTML;
		expect(html).toContain('42%');
		expect(html).not.toContain('85%');
		expect(html).not.toContain('95%');
	});
});
