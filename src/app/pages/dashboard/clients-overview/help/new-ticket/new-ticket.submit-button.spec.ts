import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { NewTicketComponent } from './new-ticket';
import { AuthStore } from '../../../../../core/store/auth.store';
import { TicketApiService } from '../../../../../core/services/ticket-api.service';
import { ClientOnboardingStateService } from '../../../../../core/services/client-onboarding-state.service';

// The ticket form must end with a submit button (it was missing), and while the identity review is pending its back link returns to the waiting page.
describe('client new ticket: submit button + back to the waiting page', () => {
	function mount(reviewing: boolean) {
		TestBed.configureTestingModule({
			imports: [NewTicketComponent],
			providers: [provideRouter([]), { provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }) } }, { provide: TicketApiService, useValue: { createTicket: () => { throw new Error('x'); } } }, { provide: ClientOnboardingStateService, useValue: { reviewing: signal(reviewing) } }],
		});
		const f = TestBed.createComponent(NewTicketComponent); f.detectChanges();
		return f.nativeElement as HTMLElement;
	}
	afterEach(() => TestBed.resetTestingModule());
	it('the form has a submit button inside it', () => {
		const el = mount(false); const b = el.querySelector('form [data-testid="ticket-submit"]') as HTMLButtonElement;
		expect(b).toBeTruthy(); expect(b.type).toBe('submit'); expect(b.textContent).toContain('فتح التذكرة');
	});
	it('under review: «العودة» and «إلغاء» lead to the waiting page', () => {
		const el = mount(true);
		expect(el.querySelector('[data-testid="back-to-review"]')?.getAttribute('href')).toBe('/client-overview/review-wait');
		expect(el.querySelector('[data-testid="ticket-cancel"]')?.getAttribute('href')).toBe('/client-overview/review-wait');
	});
	it('normally: back to the tickets list', () => {
		expect(mount(false).querySelector('[data-testid="ticket-cancel"]')?.getAttribute('href')).toBe('/client-overview/help/tickets');
	});
});
