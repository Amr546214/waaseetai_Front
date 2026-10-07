import { signal } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetupDashboard } from './profile-setup';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { SetupTestService } from '../../../../../core/services/setup-test.service';
import { KycDocumentService } from '../../../../../core/services/kyc-document.service';
import { AuthStore } from '../../../../../core/store/auth.store';

// #15 — stage 5 refills the saved portfolio from GET setup (so a re-save never starts empty and wipes it), and "إضافة نموذج" works on ONE click.
const ROWS = [
	{ id: 'i1', title: 'نموذج أعمال - تصميم شعارات', description: 'https://res.cloudinary.com/c/image/upload/v1/w/work%201.png', coverImage: 'https://res.cloudinary.com/c/image/upload/v1/w/proof-a.pdf', tags: ['https://res.cloudinary.com/c/image/upload/v1/w/proof-a.pdf', 'https://res.cloudinary.com/c/image/upload/v1/w/proof-b.pdf'] },
	{ id: 'i2', title: 'نموذج أعمال - تصميم شعارات', description: 'https://res.cloudinary.com/c/image/upload/v1/w/work2.png', coverImage: null, tags: [] },
];

describe('provider setup wizard — stage 5 portfolio (#15)', () => {
	let fixture: ComponentFixture<ProfileSetupDashboard>;
	let component: ProfileSetupDashboard;
	let save: ReturnType<typeof vi.fn>;

	const setup = (data: any) => {
		save = vi.fn(() => of({ success: true }));
		TestBed.configureTestingModule({
			imports: [ProfileSetupDashboard],
			providers: [
				provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => null } },
				{ provide: ProfileApiService, useValue: { getProviderProfileSetup: () => of({ data }), saveProviderProfileSetup: save } },
				{ provide: ProviderProfileService, useValue: { uploadDocument: vi.fn() } },
				{ provide: KycDocumentService, useValue: { createAccessLink: vi.fn() } },
				{ provide: SpecialtyService, useValue: { getCategories: () => of({ success: true, data: [] }), getPublicSpecialties: () => of({ success: true, data: [] }) } },
				{ provide: SetupTestService, useValue: { warningMsg: signal(null), errorMsg: signal(null), bannedMsg: signal(null), result: signal(null), totalQuestions: signal(0), currentQuestion: signal(null), isGenerating: signal(false), statusMsg: signal(''), disconnect: vi.fn() } },
			],
		});
		fixture = TestBed.createComponent(ProfileSetupDashboard);
		component = fixture.componentInstance;
		fixture.detectChanges();
	};
	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('the saved portfolio rows come back into stage 5, grouped by sub-specialty, with the work file and its proof files', () => {
		setup({ mainSpecialty: 'design', subSpecialties: ['تصميم شعارات'], portfolioItems: ROWS });
		const items = component.portfolioItems()['تصميم شعارات'];
		expect(items.length).toBe(2);
		expect(items[0].review).toBe(ROWS[0].description);
		expect(items[0].reviewDisplayName).toBe('work 1.png');
		expect(items[0].proofs).toEqual(ROWS[0].tags);
		expect(items[0].proofDisplayNames).toEqual(['proof-a.pdf', 'proof-b.pdf']);
		expect(items[1].review).toBe(ROWS[1].description);
		expect(items[1].proofs).toEqual([]);
	});

	it('a row with only a coverImage (no tags) still yields its proof; rows with an empty title are ignored; non-array input is safe', () => {
		setup({ subSpecialties: ['تصميم شعارات'], portfolioItems: [{ title: 'نموذج أعمال - تصميم شعارات', description: 'https://x/y/w.png', coverImage: 'https://x/y/p.png', tags: [] }, { title: '', description: 'x' }] });
		expect(component.portfolioItems()['تصميم شعارات'][0].proofs).toEqual(['https://x/y/p.png']);
		expect(Object.keys(component.portfolioItems()).length).toBe(1);
		expect(component.portfolioFromServer(undefined)).toEqual({});
	});

	it('re-saving without touching stage 5 sends the saved portfolio back (so the server-side replace does not wipe it)', () => {
		setup({ mainSpecialty: 'design', subSpecialties: ['تصميم شعارات'], portfolioItems: ROWS });
		const sent = (component as any).sanitizePortfolioForPayload(component.portfolioItems());
		expect(sent['تصميم شعارات'].map((i: any) => i.review)).toEqual([ROWS[0].description, ROWS[1].description]);
		expect(sent['تصميم شعارات'][0].proofs).toEqual(ROWS[0].tags);
	});

	it('"إضافة نموذج" adds a card on ONE click and gives the template a new array each time', () => {
		setup({ subSpecialties: ['تصميم شعارات'], portfolioItems: ROWS });
		component.currentStep.set(5);
		fixture.detectChanges();
		const before = component.getPortfolioItems('تصميم شعارات');
		const cards = () => (fixture.nativeElement as HTMLElement).querySelectorAll('.pw-item').length;
		expect(cards()).toBe(2);
		const btn = (fixture.nativeElement as HTMLElement).querySelector('.pw-add-item-btn') as HTMLButtonElement;
		btn.click();
		fixture.detectChanges();
		expect(cards()).toBe(3);
		expect(component.getPortfolioItems('تصميم شعارات')).not.toBe(before);
		expect(before.length).toBe(2);
		btn.click();
		fixture.detectChanges();
		expect(cards()).toBe(4);
	});

	it('removing a card / a proof file also produces new arrays and never leaves an empty list', () => {
		setup({ subSpecialties: ['تصميم شعارات'], portfolioItems: [ROWS[0]] });
		const first = component.getPortfolioItems('تصميم شعارات');
		component.removePortfolioProof('تصميم شعارات', 0, 0);
		expect(component.getPortfolioItems('تصميم شعارات')).not.toBe(first);
		expect(component.getPortfolioItems('تصميم شعارات')[0].proofs).toEqual([ROWS[0].tags[1]]);
		component.removePortfolioItem('تصميم شعارات', 0);
		expect(component.getPortfolioItems('تصميم شعارات').length).toBe(1);
		expect(component.getPortfolioItems('تصميم شعارات')[0].review).toBe('');
	});
});
