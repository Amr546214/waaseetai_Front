/// <reference types="node" />

// Pricing/legal must not state commission rates, score bands or suspension thresholds the backend does not implement.
// Backend truth (progression-calculators.ts): fixed 15-level ladder per role, qualification = points AND completed
// projects AND avg rating; no 0–100 bands, no individual/company split, no "below 20" suspension rule. The commission
// model is not approved, so no promise of a commission reduction is published; details live in the dashboard and the payments
// policy. (The hero's "pay only on success" wording is deliberately untouched here: an open product decision, since checkout
// charges fees at escrow deposit.)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf-8');

const FILES = [
	'pricing/pricing.html', 'pricing/pricing.ts', 'legal/legal-page.component.ts',
	'how-it-works/provider/provider.html', 'how-it-works/how-it-works.ts', 'blog/blog-data.ts', 'press/press.html',
	'../dashboard/provider-overview/profile/level/level.html',
];

const FORBIDDEN: Array<[string, RegExp]> = [
	['old commission range ٪7 / ٪18 (and plan rates ٪8/٪11/٪13/٪16)', /٪\s?(7|8|11|13|16|18)\b/],
	['0–100 level bands (خبير 90–100 …)', /90\s?[–-]\s?100|75\s?[–-]\s?89|55\s?[–-]\s?74|0\s?[–-]\s?54/],
	['suspension below 20', /دون 20|لدون 20/],
	['levels tied to a 0–100 score', /0 إلى 100|من 0 إلى 100/],
	['level bands as tier names with rates', /خبير \(|محترف \(|متقدم \(|مبتدئ \(/],
	['commission-reduction promises (unproven: level commission is not confirmed as deducted)', /تنخفض (نسبة )?العمولة|انخفضت نسبة العمولة|كلما انخفضت|تخفيض العمولة|تخفيض العمولة|أقل نسبة|نسبة أقل|تُحسب نسبة العمولة تلقائياً|تحسب نسبة العمولة تلقائياً|تنخفض نسبة العمولة|انخفاض (نسبة )?العمولة|تنخفض معه نسبة|كلما ارتفع مستواك انخفضت|انخفضت نسبة العمولة|خفض (نسبة )?(ال)?عمولة|لخفض عمولة|تنخفض حتى|تُضاف لمحفظتك فوراً|لمحفظتك فوراً/],
	['fee-free-until-success FAQ promise (checkout charges fees at escrow deposit)', /لا تدفع أي شيء حتى/],
	['AI audit tied to a pricing level (every service is audited regardless of level)', /تدقيق AI لخدماتك/],
	['unsupported search-priority promise', /أولوية قصوى في (البحث|ترتيب|نتائج)/],
];

describe('pricing/legal level & commission copy matches backend rules', () => {
	for (const f of FILES) {
		it(`${f} has no unbacked rates/bands/thresholds`, () => {
			const src = read(f);
			for (const [label, re] of FORBIDDEN) expect(re.test(src), `${f}: ${label}`).toBe(false);
		});
	}

	it('pricing shows no hard-coded commission percentage on plan cards', () => {
		const ts = read('pricing/pricing.ts');
		for (const m of ts.matchAll(/commission:\s*'([^']*)'/g)) expect(/[\d٠-٩]/.test(m[1]), `commission: ${m[1]}`).toBe(false);
	});

	it('legal describes the 15-level fixed-rule ladder generically', () => {
		const legal = read('legal/legal-page.component.ts');
		expect(legal).toContain('سلّماً من 15 مستوى');
		expect(legal).toContain('ببلوغ الحدود الثلاثة معاً');
		expect(legal).toContain('تُعرض تفاصيل العمولة والرسوم داخل لوحة التحكم وسياسة المدفوعات');
		expect(legal).toContain('لا تُنشر نسب رقمية قبل اعتماد نموذج العمولة النهائي');
	});
});
