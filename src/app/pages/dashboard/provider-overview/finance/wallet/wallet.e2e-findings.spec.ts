import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Wallet, PROVIDER_ONLY_FINANCE_MESSAGE } from './wallet';
import { AuthStore } from '../../../../../core/store/auth.store';
import { UserRole } from '../../../../../core/models/auth.model';

describe('provider wallet: role-aware (e2e findings)', () => {
	async function setup(role: UserRole | null, get: any) {
		await TestBed.configureTestingModule({ imports: [Wallet], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get } },
			{ provide: AuthStore, useValue: { actingRole: () => role, isAuthenticated: () => true, currentUser: () => null } }] }).compileComponents();
		const f = TestBed.createComponent(Wallet); f.detectChanges(); await f.whenStable(); f.detectChanges();
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('never calls /provider/finance/wallet while acting as a client', async () => {
		const get = vi.fn(() => of({ success: true, data: null }));
		const s = await setup(UserRole.CLIENT, get);
		expect(get).not.toHaveBeenCalled();
		expect(s.el.textContent).toContain(PROVIDER_ONLY_FINANCE_MESSAGE);
		expect(s.el.querySelector('[data-testid="wallet-error-text"]')).not.toBeNull();
	});

	it('a 403 shows the provider-only message without a retry loop or console error', async () => {
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const get = vi.fn(() => throwError(() => ({ status: 403, error: { message: 'x' } })));
		const s = await setup(UserRole.PROVIDER, get);
		expect(get).toHaveBeenCalledTimes(1);
		expect(s.c.error()).toBe(PROVIDER_ONLY_FINANCE_MESSAGE);
		expect(s.el.textContent).toContain(PROVIDER_ONLY_FINANCE_MESSAGE);
		expect(Array.from(s.el.querySelectorAll('button')).some(b => /اعادة المحاولة/.test(b.textContent || ''))).toBe(false);
		expect(errSpy).not.toHaveBeenCalled();
		errSpy.mockRestore();
	});
});
