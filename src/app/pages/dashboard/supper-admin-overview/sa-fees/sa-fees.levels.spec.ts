import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SaFees } from './sa-fees';
import { LevelsService, LevelsPayload, LevelRow } from '../../../../core/levels/levels.service';

const row = (level: number, name: string, percent: number): LevelRow => ({ level, name, percent, station: 1, color: { dark: '#000000', light: '#FFFFFF' }, thresholds: { points: 0 } });
const payload = {
	roles: {
		PROVIDER: { levels: [row(1, 'مبتدئ', 12.75), row(15, 'مرجع', 8.15)] },
		CLIENT: { levels: [row(1, 'زائر', 1), row(15, 'مؤسسي', 5)] },
		MARKETER: { levels: [row(1, 'مسوق', 1), row(15, 'رابط مؤسسي', 4.5)] },
	},
	payments: { clientDeposit: { mada: 4.25, visa_mastercard: 5.5, paypal: 7, international_transfer: 7.5, other: 8.5 }, marketerWithdrawal: { bank_transfer: 8.25, paypal: 7.75, usdt: 4 } },
} as unknown as LevelsPayload;

describe('admin fees page: the official percentages (نظام النقاط و الولاء.xlsx / نسب الدفع.xlsx), read-only', () => {
	const mount = (p: LevelsPayload | null) => {
		TestBed.configureTestingModule({ imports: [SaFees], providers: [{ provide: LevelsService, useValue: { payload: signal(p), ensureLoaded: () => undefined } }] });
		const f = TestBed.createComponent(SaFees);
		f.detectChanges();
		return { el: f.nativeElement as HTMLElement, c: f.componentInstance };
	};
	afterEach(() => TestBed.resetTestingModule());

	it('provider commission 12.75% – 8.15%, cashback 1% – 5%, marketer commission 1% – 4.5%, deposit and withdrawal fees from the table', () => {
		const { c } = mount(payload);
		const byLabel = Object.fromEntries(c.platformFees().map(f => [f.label, f]));
		expect(byLabel['عمولة المنصة على مقدم الخدمة (الخصم النهائي)'].value).toBe('8.15% – 12.75%');
		expect(byLabel['نسبة الكاش باك لطالب الخدمة'].value).toBe('1% – 5%');
		expect(byLabel['عمولة الوسيط'].value).toBe('1% – 4.5%');
		expect(byLabel['رسوم إيداع طالب الخدمة'].desc).toBe('مدى 4.25% · فيزا/ماستر 5.5% · PayPal 7% · تحويل دولي 7.5% · غير ذلك 8.5%');
		expect(byLabel['رسوم سحب الوسيط'].desc).toBe('تحويل بنكي 8.25% · PayPal 7.75% · USDT 4%');
	});

	it('no invented rows (10% deal fee, 200 $ minimum, 72 h escrow, 49 $ boost, 2% cashback, 0% withdrawal) and no edit button', () => {
		const { el, c } = mount(payload);
		const text = el.textContent || '';
		for (const old of ['رسوم إتمام الصفقة', '200 $', '72 ساعة', '49 $', 'حد السحب الأدنى', 'تعزيز الظهور']) expect(text, old).not.toContain(old);
		expect(text).not.toMatch(/(?<![\d.])(10|2|0)%/); // the invented 10% / 2% / 0% figures (churn and the official ranges are not matched)
		expect(el.querySelector('.fe-fee-edit')).toBeNull();
		expect(c.platformFees().length).toBe(5);
	});

	it('before the table answers nothing is shown; the package texts carry no percentage claim', () => {
		const { el, c } = mount(null);
		expect(c.platformFees()).toEqual([]);
		expect(el.querySelectorAll('.fe-fee-item').length).toBe(0);
		const src = readFileSync(join(__dirname, 'sa-fees.ts'), 'utf8');
		for (const old of ['كاش باك 3%', 'كاش باك 5%', 'عمولة 8%', '+1%']) expect(src).not.toContain(old);
	});
});
