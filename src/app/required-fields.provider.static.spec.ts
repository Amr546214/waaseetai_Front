/// <reference types="node" />

// Static guard (provider area): required fields show the red `ws-req` asterisk and the control carries
// aria-required; validation messages are role=alert, use a global red class and are wired with aria-invalid.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const P = join(__dirname, 'pages/dashboard/provider-overview');
const read = (rel: string) => readFileSync(join(P, rel), 'utf8');
const STAR = /<span class="ws-req" aria-hidden="true">\*<\/span>/;

/** The label text containing `labelText` also carries the ws-req star, and the control `id` is aria-required. */
function expectRequired(html: string, labelText: string, controlId: string) {
	const esc = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	expect(new RegExp(esc + '[^<]{0,120}<span\\s+class="ws-req" aria-hidden="true">\\*</span>').test(html), `star after "${labelText}"`).toBe(true);
	const m = new RegExp(`<(?:input|select|textarea|ws-select)\\b[^>]*\\bid="${controlId}"[^>]*>`).exec(html);
	expect(m, `control #${controlId}`).not.toBeNull();
	expect(m![0]).toMatch(/aria-required="true"/);
}

const FORMS: Array<[string, Array<[string, string]>]> = [
	['profile/profile-setup/profile-setup.html', [['المسمى الوظيفي', 'job-title'], ['سنوات الخبرة', 'exp-years'], ['الدولة', 'pr-country'], ['المدينة', 'pr-city'], ['النبذة المهنية', 'bio'], ['التخصص الرئيسي', 'main-spec'], ['بريد PayPal', 'pr-paypal']]],
	['profile/data/data.html', [['الاسم الأول', 'pr-fname'], ['اسم العائلة', 'pr-lname'], ['المسمى المهني', 'pr-title'], ['التخصص الرئيسي', 'pr-spec'], ['الدولة', 'pr-country'], ['المدينة', 'pr-city'], ['بريد PayPal', 'pp-email'], ['كلمة المرور الجديدة', 'pwd-new']]],
	['marketing/offer-form/offer-form.html', [['اسم العرض', 'of-name'], ['نسبة الخصم', 'of-disc'], ['تاريخ البداية', 'of-start'], ['نص الشارة', 'of-badge']]],
	['marketing/coupon-form/coupon-form.html', [['قيمة الخصم', 'cp-val'], ['تاريخ البداية', 'cp-start'], ['الحد الأقصى للعميل الواحد', 'cp-per']]],
	['help/new-ticket/new-ticket.html', [['عنوان التذكرة', 'tk-subj'], ['وصف المشكلة', 'tk-desc']]],
	['finance/withdraw/withdraw.html', [['المبلغ', 'wdAmt']]],
	['hr/provider-hr.component.html', [['الاسم الكامل', 'hr-name'], ['المسمى الوظيفي', 'hr-job'], ['البريد الإلكتروني', 'hr-email']]],
	['settings/account/account.html', [['كلمة المرور الحالية', 'pw-current'], ['تأكيد كلمة المرور الجديدة', 'pw-confirm']]],
	['offers/negotiate/negotiate.html', [['السعر المقترح', 'counter-price'], ['مدة التنفيذ', 'counter-days']]],
	['finance/wallet/deposit-modal/deposit-modal.html', [['المبلغ', 'dpmAmt']]],
	['explore-requests/applay-request/components/step1-general/step1-general.html', [['عنوان عرضك', 'f-title'], ['رسالة عرضك', 'f-desc']]],
	['explore-requests/applay-request/components/step2-pricing/step2-pricing.html', [['سعر عرضك الإجمالي', 'f-total-price']]],
	['business-models/accreditation/new/components/step2-upload/step2-upload.component.html', [['عنوان نموذج العمل الفني', 'acc-title'], ['الوصف الفني والمعماري', 'acc-description']]],
	['business-models/new-project/components/step1-details/step1-details.component.html', [['اسم المشروع', 'np-name']]],
	['profile/specialties/specialties.html', [['عنوان المشروع', 'spec-other-text']]],
];

describe('provider forms: required labels carry the red ws-req star + aria-required', () => {
	for (const [file, fields] of FORMS) {
		if (file.includes('specialties')) continue;
		it(file, () => {
			const html = read(file);
			for (const [label, id] of fields) expectRequired(html, label, id);
		});
	}

	it('no legacy asterisk styles remain in the provider area templates', () => {
		for (const f of ['profile/profile-setup/profile-setup.html', 'profile/data/data.html', 'marketing/offer-form/offer-form.html', 'hr/provider-hr.component.html', 'business-models/new-project/components/step4-stages/step4-stages.component.html']) {
			const html = read(f);
			expect(html).not.toMatch(/class="(f-req|req|req-star|up-req|wd-req)"/);
			expect(html).not.toMatch(/text-\[#2BD4C7\][^"]*"[^>]*>\*<\/span>/);
		}
	});

	it('specialty samples star title / tech / description and the files', () => {
		const html = read('profile/specialties/specialties.html');
		for (const t of ['عنوان المشروع', 'التقنيات والأدوات', 'وصف العمل ودورك فيه', 'نموذج العمل · للسوق العام', 'وثائق الإثبات · للمراجعة فقط']) {
			const i = html.indexOf(t);
			expect(i, t).toBeGreaterThan(-1);
			expect(STAR.test(html.slice(i, i + t.length + 90)), t).toBe(true);
		}
		expect(html).toMatch(/id="spec-other-text"[^>]*aria-required="true"|aria-required="true"[^>]*id="spec-other-text"|id="spec-other-text" aria-required="true"/);
	});

	it('conditionally required fields are starred only while the condition holds', () => {
		expect(read('marketing/coupon-form/coupon-form.html')).toMatch(/@if \(!editId\(\)\) \{<span class="ws-req"/);
		expect(read('profile/data/data.html')).toMatch(/@if \(!identityPending\(\)\) \{<span class="ws-req"/);
		expect(read('profile/profile-setup/profile-setup.html')).toMatch(/@if \(!kycPending\(\) && !kycVerified\(\)\) \{<span class="ws-req"/);
		expect(read('projects/active/progress/progress.html')).toMatch(/\[attr\.aria-required\]="amendKind==='SCOPE'/);
	});

	it('step 3 acknowledgements and rating groups are starred / aria-required', () => {
		const ack = read('explore-requests/applay-request/components/step3-review/step3-review.html');
		expect(ack.match(/role="checkbox" aria-required="true"/g)?.length).toBe(3);
		expect(read('projects/rating-page/provider-rating-page.html')).toMatch(/role="radiogroup" aria-required="true"/);
		expect(read('projects/active/progress/provider-rating-modal/provider-rating-modal.html')).toMatch(/role="radiogroup" aria-required="true"/);
	});
});

describe('provider forms: validation messages are red, role=alert and tied to the field', () => {
	it('price + duration missing message (pricing step + counter offer)', () => {
		const pricing = read('explore-requests/applay-request/components/step2-pricing/step2-pricing.html');
		expect(pricing).toMatch(/id="pricing-missing-err" role="alert"[^>]*form-error/);
		expect(pricing).toContain('يرجى تحديد السعر والمدة المطلوبة');
		const neg = read('offers/negotiate/negotiate.html');
		expect(neg).toMatch(/class="form-error" id="counter-missing-err"[^>]*role="alert">يرجى تحديد السعر والمدة المطلوبة/);
		expect(neg).toMatch(/id="counter-price"[^>]*\[attr\.aria-invalid\][^>]*\[attr\.aria-describedby\]="counterFieldsMissing\(\) \? 'counter-missing-err'/);
	});

	it('proposal title / message / total price errors use field-err + role=alert + aria-invalid wiring', () => {
		const s1 = read('explore-requests/applay-request/components/step1-general/step1-general.html');
		expect(s1).toMatch(/id="f-title-err" role="alert"[^>]*field-err/);
		expect(s1).toMatch(/id="f-desc-err" role="alert"[^>]*field-err/);
		expect(s1).toMatch(/\[attr\.aria-invalid\]="titleModel\.invalid/);
		expect(s1).not.toMatch(/field-err-msg[^>]*text-\[#FF8080\]|text-\[#FF8080\][^>]*field-err-msg/);
		const s2 = read('explore-requests/applay-request/components/step2-pricing/step2-pricing.html');
		expect(s2).toMatch(/id="f-total-price-err" role="alert"[^>]*field-err/);
		expect(s2).toMatch(/\[attr\.aria-invalid\]="mDaysModel\.invalid/);
		expect(s2).not.toMatch(/mt-\[5px\]" \*ngIf/);
	});

	it('accreditation upload errors use the global red class (no hardcoded hex)', () => {
		const html = read('business-models/accreditation/new/components/step2-upload/step2-upload.component.html');
		expect(html).not.toMatch(/role="alert"[^>]*text-\[#FF6B6B\]/);
		expect(html).toMatch(/id="acc-title-err" role="alert" class="[^"]*field-err/);
	});

	it('inline hex-coloured messages in profile-setup / specialties / new project were moved to the red classes', () => {
		const setup = read('profile/profile-setup/profile-setup.html');
		expect(setup).not.toMatch(/style="[^"]*color:#ff8c69/);
		expect(setup).toMatch(/class="f-err" id="sub-specs-error" role="alert"/);
		expect(setup).toMatch(/id="pr-paypal-hint" role="alert"/);
		const spec = read('profile/specialties/specialties.html');
		expect(spec).toMatch(/data-testid="sample-description-error" class="field-err/);
		expect(spec).toMatch(/data-testid="step-error"\s*class="mt-4 form-error"/);
		expect(read('business-models/new-project/new-project.html')).toMatch(/data-testid="specialty-error" class="inline-error"/);
		expect(read('business-models/new-project/components/step3-model/step3-model.component.html')).toMatch(/inline-error" data-testid="model-error"/);
	});

	it('delivery form blocker is red + alert once the provider started filling, and the note is wired', () => {
		const html = read('projects/active/progress/progress.html');
		expect(html).toMatch(/id="dlv-blocker" \[class\.up-err\]="!!showDeliveryBlocker\(\)" \[attr\.role\]="showDeliveryBlocker\(\) \? 'alert' : null" data-testid="delivery-blocker"/);
		expect(html).toMatch(/id="dlv-note" aria-required="true" \[attr\.aria-invalid\]/);
	});

	it('other messages: return note, deposit, password, team form, rating modal', () => {
		expect(read('projects/active/delivery-review/delivery-review.html')).toMatch(/class="form-error" id="dr-return-err" role="alert"/);
		expect(read('finance/wallet/deposit-modal/deposit-modal.html')).toMatch(/class="dpm-hint field-err" id="dpmAmt-err" role="alert"/);
		expect(read('settings/account/account.html')).toMatch(/data-testid="form-error" class="form-error/);
		expect(read('projects/active/progress/provider-rating-modal/provider-rating-modal.html')).toMatch(/id="pr-error" class="inline-error"[^>]*role="alert"/);
		expect(read('company/team-management/team-management.component.css')).toMatch(/\.form-err \{[^}]*var\(--red\)/);
		expect(read('marketing/coupon-form/coupon-form.html')).toMatch(/state-box err form-error" id="cp-form-error"/);
	});
});
