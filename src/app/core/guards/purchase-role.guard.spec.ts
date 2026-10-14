import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { purchaseRoleGuard } from './purchase-role.guard';
import { AuthStore } from '../store/auth.store';
import { NotificationEngineService } from '../services/notification-engine.service';

describe('purchaseRoleGuard (cart / checkout / payment are the CLIENT role)', () => {
	const canPurchase = signal(true);
	const toast = vi.fn();
	function run() {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthStore, useValue: { canPurchase: computed(() => canPurchase()) } }, { provide: NotificationEngineService, useValue: { triggerToast: toast } }] });
		return TestBed.runInInjectionContext(() => purchaseRoleGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
	}
	it('lets a client (or a guest) through', () => { canPurchase.set(true); expect(run()).toBe(true); });
	it('a user acting as a provider is sent back to the marketplace with a clear message', () => {
		canPurchase.set(false);
		const r = run() as UrlTree;
		expect(TestBed.inject(Router).serializeUrl(r)).toBe('/marketplace');
		expect(toast).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('بدّل إلى حساب طالب الخدمة لإتمام الشراء') }));
	});
	it('the guard sits on the cart and on checkout review / payment / confirm', () => {
		const src = readFileSync(join(__dirname, '../../pages/website/website.routes.ts'), 'utf8');
		for (const p of ['cart', 'checkout/review', 'checkout/payment', 'checkout/confirm']) {
			const i = src.indexOf(`path: '${p}'`); expect(i, p).toBeGreaterThan(-1);
			expect(src.slice(i, i + 300), p).toContain('purchaseRoleGuard');
		}
	});
	it('the payment page never reads the wallet balance while acting as a provider, and the navbar cart follows canPurchase', () => {
		const pay = readFileSync(join(__dirname, '../../pages/website/checkout/payment/payment.ts'), 'utf8');
		expect(pay).toContain('if (!this.authStore.canPurchase()) { this.walletBalance.set(null); return; }');
		const nav = readFileSync(join(__dirname, '../../sheards/navbar/navbar.html'), 'utf8');
		expect(nav).toMatch(/@if \(authStore\.canPurchase\(\)\)\s*\{\s*<a routerLink="\/cart"/);
	});
});
