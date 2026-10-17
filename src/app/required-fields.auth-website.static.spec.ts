/// <reference types="node" />

// Static guard: required-field asterisks (ws-req + aria-required) and validation-message wiring for auth + website forms.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = __dirname;
const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');
const STAR = '<span class="ws-req" aria-hidden="true">*</span>';

/** The label whose `for` is `id` carries the red star. */
function labelHasStar(html: string, id: string) {
	const m = html.match(new RegExp(`<label[^>]*for="${id}"[^>]*>[\\s\\S]*?</label>`));
	expect(m, `label for ${id} missing`).toBeTruthy();
	expect(m![0], `label for ${id} has no ws-req`).toContain(STAR);
}
/** The control with this id has aria-required. */
function controlRequired(html: string, id: string) {
	const m = html.match(new RegExp(`<(?:input|textarea|select)[^>]*id="${id}"[^>]*>`));
	expect(m, `control ${id} missing`).toBeTruthy();
	expect(m![0], `control ${id} lacks aria-required`).toContain('aria-required="true"');
}

describe('auth forms', () => {
	const login = read('pages/auth/login/login.html');
	const reg = read('pages/auth/register/register.html');
	const rp = read('pages/auth/rest-password/rest-password.html');
	const otp = read('pages/auth/verify-otp/verify-otp.html');

	it('login stars email + password, wires aria-invalid and role=alert', () => {
		for (const id of ['identifier', 'password']) { labelHasStar(login, id); controlRequired(login, id); }
		expect(login).not.toMatch(/class="req"/);
		expect(login).toMatch(/id="err-identifier" role="alert"/);
		expect(login).toMatch(/id="err-password" role="alert"/);
		expect(login).toContain(`[attr.aria-describedby]="fieldError('email') ? 'err-identifier' : null"`);
		expect(login).toContain(`[attr.aria-invalid]="fieldError('password')`);
	});

	it('register stars every required field and the two consents', () => {
		for (const id of ['first-name', 'last-name', 'email', 'mobile', 'password', 'password-confirm']) labelHasStar(reg, id);
		for (const id of ['first-name', 'last-name', 'email', 'password', 'password-confirm']) controlRequired(reg, id);
		expect(reg).toContain('<app-phone-input formControlName="phone" aria-required="true">');
		expect(reg).not.toMatch(/field-req/);
		expect((reg.match(/ws-req/g) ?? []).length).toBeGreaterThanOrEqual(9);
		for (const id of ['err-first-name', 'err-last-name', 'err-email', 'err-mobile', 'err-password', 'err-confirm', 'err-agree-data', 'err-agree-terms'])
			expect(reg, id).toContain(`id="${id}" role="alert"`);
		expect(reg).toContain(`[attr.aria-describedby]="fieldError('email') ? 'err-email' : null"`);
	});

	it('reset password stars email, new password, confirmation and the OTP', () => {
		for (const id of ['field-email', 'new-password', 'confirm-password']) { labelHasStar(rp, id); controlRequired(rp, id); }
		expect(rp).not.toMatch(/field-req/);
		expect(rp).toMatch(/otp-card-title">رمز التحقق <span class="ws-req"/);
		expect(rp).toMatch(/class="otp-box" aria-required="true"/);
		for (const id of ['err-email', 'err-new-pw', 'err-confirm-pw']) expect(rp).toContain(`id="${id}" role="alert"`);
		expect(rp).toContain(`'pw-rules err-new-pw'`);
	});

	it('verify-otp stars the code and marks every box required', () => {
		expect(otp).toMatch(/otp-card-title">رمز التحقق <span class="ws-req"/);
		expect(otp).toMatch(/class="otp-box" aria-required="true"/);
		expect(otp).toContain(`[attr.aria-invalid]="errorMsg ? 'true' : null"`);
	});

	it('auth css has no blue on error / invalid rules', () => {
		for (const f of ['login/login.css', 'register/register.css', 'verify-otp/verify-otp.css', 'rest-password/rest-password.css']) {
			const css = read(`pages/auth/${f}`).replace(/\/\*[\s\S]*?\*\//g, '');
			for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
				if (!/err|error|invalid/i.test(rule[1])) continue;
				expect(rule[2], `${f}: ${rule[1].trim()}`).not.toMatch(/var\(--blue|rgba\(\s*43\s*,\s*127\s*,\s*255/);
			}
		}
	});
});

describe('website forms', () => {
	const cr = read('pages/website/checkout/custom-request/custom-request.html');
	const rpb = read('pages/website/support/report-problem/report-problem.component.html');
	const contact = read('pages/website/contact/contact.html');
	const pay = read('pages/website/checkout/payment/payment.html');
	const conf = read('pages/website/checkout/confirm/confirm.html');
	const offer = read('pages/website/marketplace/offer/offer.html');
	const track = read('pages/website/support/track-request/track-request.component.html');

	it('custom request stars title, category, description, budget, days', () => {
		for (const id of ['req-title', 'req-cat', 'req-desc', 'req-budget', 'req-deadline']) { labelHasStar(cr, id); controlRequired(cr, id); }
		expect(cr).not.toMatch(/<span class="req">/);
		expect(cr).toMatch(/class="form-error" role="alert"/);
		expect(read('pages/website/checkout/custom-request/custom-request.css')).not.toMatch(/invalid\s*\{[^}]*255,140,105/);
	});

	it('report problem stars type group once and the four text fields', () => {
		for (const id of ['rp-name', 'rp-email', 'rp-subject', 'rp-desc']) { labelHasStar(rpb, id); controlRequired(rpb, id); expect(rpb).toContain(`id="${id}-err" role="alert"`); }
		expect(rpb).toMatch(/نوع المشكلة <span class="ws-req"/);
		expect(rpb).toContain('id="rp-category-err" role="alert"');
		expect(rpb).toContain(`[attr.aria-describedby]="invalid('category')`);
		expect(rpb).not.toContain('rp-project" aria-required');
	});

	it('contact stars name, e-mail and message but not the optional type', () => {
		for (const id of ['f-name', 'f-email', 'f-msg']) { labelHasStar(contact, id); controlRequired(contact, id); }
		expect(contact).not.toMatch(/for="f-type"[^>]*>[^<]*<span class="ws-req"/);
	});

	it('payment terms checkbox is starred, red via class (no hardcoded colour)', () => {
		expect(pay).toMatch(/id="terms-chk" aria-required="true"/);
		expect(pay).toContain(STAR);
		expect(pay).not.toMatch(/#ef4444/);
		expect(pay).toMatch(/class="form-error" role="alert"/);
	});

	it('confirm OTP is starred and boxes are required', () => {
		expect(conf).toMatch(/otp-title">تحقق من هويتك <span class="ws-req"/);
		expect(conf).toMatch(/#otpInput\s+aria-required="true"/);
		expect(conf).toContain('class="form-msg err" id="otp-error" role="alert"');
	});

	it('offer question / negotiation are required and their messages are red + alert', () => {
		expect(offer).toMatch(/ask-box-title">[^<]*<span class="ws-req"/);
		expect(offer).toMatch(/id="ask-message" aria-required="true"/);
		expect(offer).toMatch(/id="neg-message" aria-required="true"/);
		expect(offer).not.toMatch(/#ef4444/);
		expect(offer).toMatch(/id="ask-request-err" class="field-error" role="alert"/);
		expect(offer).toMatch(/id="neg-request-err" class="field-error" role="alert"/);
	});

	it('track request input is marked required and invalid', () => {
		expect(track).toContain('aria-required="true"');
		expect(track).toContain('[attr.aria-invalid]');
	});
});
