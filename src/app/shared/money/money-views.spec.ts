import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MoneyByComponent } from './money-by.component';
import { ProviderFeePreviewComponent } from '../fee-policy/provider-fee-preview.component';
import { readProviderContract } from '../../pages/dashboard/provider-overview/offers/sign-contract/sign-contract';

@Component({ standalone: true, imports: [MoneyByComponent], template: `<ws-money-by [map]="m()" />` })
class MoneyByHost { m = signal<Record<string, number> | null>({ USD: 100 }); }
@Component({ standalone: true, imports: [ProviderFeePreviewComponent], template: `<ws-provider-fee-preview [price]="p()" />` })
class PreviewHost { p = signal<number | null>(null); }

describe('ws-money-by', () => {
	it('shows nothing when only USD exists, and one line per OTHER currency otherwise (never added to the USD figure)', () => {
		const f = TestBed.createComponent(MoneyByHost); f.detectChanges();
		expect(f.nativeElement.querySelector('[data-testid="money-by-currency"]')).toBeNull();
		f.componentInstance.m.set({ USD: 100, SAR: 300 }); f.detectChanges();
		const lines = f.nativeElement.querySelectorAll('[data-testid="money-by-currency"]'); expect(lines.length).toBe(1); expect(lines[0].textContent).toContain('300.00 SAR');
		expect(f.nativeElement.textContent).not.toContain('400');
	});
});

describe('ws-provider-fee-preview', () => {
	beforeEach(() => { vi.useFakeTimers(); TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); });
	afterEach(() => vi.useRealTimers());
	it('asks the server for the commission of the typed price and shows the estimate with the "frozen at funding" note; nothing is computed in the browser', async () => {
		const f = TestBed.createComponent(PreviewHost); const http = TestBed.inject(HttpTestingController); f.detectChanges();
		f.componentInstance.p.set(1000); f.detectChanges(); await vi.advanceTimersByTimeAsync(450);
		const req = http.expectOne(r => r.url.endsWith('/provider/finance/fee-preview')); expect(req.request.params.get('price')).toBe('1000');
		req.flush({ success: true, data: { currency: 'USD', price: 1000, level: 1, ratePercent: 12.75, commission: 127.5, net: 872.5, policy: { version: 1 }, note: 'تُثبَّت النسبة نهائيًا عندما يوقّع العميل ويموّل الضمان' } }); f.detectChanges();
		const t = f.nativeElement.querySelector('[data-testid="fee-preview"]').textContent; expect(t).toContain('127.50 USD'); expect(t).toContain('872.50 USD'); expect(t).toContain('12.75'); expect(t).toContain('يموّل الضمان');
		f.componentInstance.p.set(null); f.detectChanges(); expect(f.nativeElement.querySelector('[data-testid="fee-preview"]')).toBeNull(); http.verify();
	});
	it('says so when the estimate is unavailable instead of showing a made-up figure', async () => {
		const f = TestBed.createComponent(PreviewHost); const http = TestBed.inject(HttpTestingController); f.detectChanges();
		f.componentInstance.p.set(50); f.detectChanges(); await vi.advanceTimersByTimeAsync(450);
		http.expectOne(r => r.url.endsWith('/provider/finance/fee-preview')).flush('x', { status: 500, statusText: 'err' }); f.detectChanges();
		expect(f.nativeElement.querySelector('[data-testid="fee-preview-unavailable"]')).not.toBeNull(); expect(f.nativeElement.querySelector('[data-testid="fee-preview"]')).toBeNull();
	});
});

describe('provider contract to sign', () => {
	it('reads the FINAL commission and net frozen on the escrow, and the contract currency; absent terms stay absent', () => {
		const base = { id: 'c', status: 'PENDING_PROVIDER_SIGNATURE', price: 1000, durationDays: 14, phasesCount: 1, milestones: [], escrow: { amount: 1000, status: 'HELD' } };
		const withTerms = readProviderContract({ ...base, currency: 'SAR', providerTerms: { ratePercent: 12.75, commission: 127.5, net: 872.5, final: true } })!;
		expect(withTerms.providerTerms).toEqual({ ratePercent: 12.75, commission: 127.5, net: 872.5 }); expect(withTerms.currency).toBe('SAR');
		const none = readProviderContract(base)!; expect(none.providerTerms).toBeNull(); expect(none.currency).toBe('USD');
	});
});
