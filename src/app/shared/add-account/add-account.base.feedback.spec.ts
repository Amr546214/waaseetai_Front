import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AddAccount } from '../../pages/dashboard/clients-overview/profile/add-account/add-account';
import { AuthStore } from '../../core/store/auth.store';
import { AccountService } from '../../core/services/account.service';
import { UiNotificationService } from '../../core/services/ui-notification.service';

// A card that cannot be chosen (the account in use, a type that is not available) used to swallow the click: now it says why. A card that can be chosen still moves on.
describe('add-account: clicking a card that cannot be chosen says why', () => {
	function mount() {
		TestBed.configureTestingModule({
			imports: [AddAccount],
			providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { currentUser: signal<any>({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT', roles: ['CLIENT'] }), token: signal('t'), updateUser: vi.fn() } },
				{ provide: AccountService, useValue: { getAvailableAccountTypes: () => of({ success: true, data: { ownedRoles: ['CLIENT'], activeRole: 'CLIENT' } }), addAccountType: vi.fn(), switchActiveRole: vi.fn() } }],
		});
		const f = TestBed.createComponent(AddAccount);
		f.detectChanges();
		return { c: f.componentInstance as any, notify: TestBed.inject(UiNotificationService) };
	}
	afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); TestBed.resetTestingModule(); });

	it('the account in use: an info message, no step change', () => {
		const { c, notify } = mount();
		c.selectType('seeker-ind');
		expect(notify.toasts().at(-1)).toMatchObject({ kind: 'info' });
		expect(notify.toasts().at(-1)!.message).toContain('حسابك النشط');
		expect(c.selectedType()).toBeNull();
	});
	it('a type that is not available: an info message, no step change', () => {
		const { c, notify } = mount();
		c.selectType('provider-co');
		expect(notify.toasts().at(-1)!.message).toContain('غير متاح');
		expect(c.selectedType()).toBeNull();
	});
	it('a type that can be added still opens its flow (no message)', () => {
		const { c, notify } = mount();
		c.selectType('provider-ind');
		expect(c.selectedType()).toBe('provider-ind');
		expect(notify.toasts().length).toBe(0);
	});
});
