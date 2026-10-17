/// <reference types="node" />

// Static guard: required fields in the client + marketer areas show the red `ws-req` asterisk with aria-required,
// and validation messages that were not red are now red / role=alert / tied to their control.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = __dirname;
const C = 'pages/dashboard/clients-overview/';
const M = 'pages/dashboard/marketer-overview/';
const read = (p: string) => readFileSync(join(APP, p), 'utf8');
const STAR = '<span class="ws-req" aria-hidden="true">*</span>';

/** The control tag with the given id / attribute fragment. */
const tagWith = (html: string, frag: string): string => {
	const i = html.indexOf(frag);
	expect(i, frag).toBeGreaterThan(-1);
	const start = html.lastIndexOf('<', i);
	return html.slice(start, html.indexOf('>', i) + 1);
};
/** The label that points at `id` (for="id") contains the star. */
const labelFor = (html: string, id: string): string => {
	const m = new RegExp('<label[^>]*for="' + id + '"[^>]*>[\\s\\S]*?</label>').exec(html);
	expect(m, 'label for ' + id).toBeTruthy();
	return m![0];
};

describe('required asterisks (client + marketer)', () => {
	it('no legacy asterisk colours remain', () => {
		for (const f of [
			C + 'profile/profile-setup/profile-setup.html', C + 'profile/add-account/add-account.html', C + 'profile/profile-edit/profile-edit.html',
			C + 'create-request/components/step3-details/step3-details.html', C + 'create-request/components/step4-budget/step4-budget.html',
			C + 'help/new-ticket/new-ticket.html', M + 'profile/data/data.html', M + 'profile/add-account/add-account.html', M + 'profile/profile-setup/profile-setup.html',
		]) {
			const html = read(f);
			expect(html, f).not.toMatch(/<span\s+class="(?:text-amber-500|text-cyan-500|text-red-500|field-req[^"]*|req|text-\[#2BD4C7\] ml-1)">\*<\/span>/);
		}
	});

	it('client new ticket: category, subject, description', () => {
		const html = read(C + 'help/new-ticket/new-ticket.html');
		for (const id of ['tk-cat', 'tk-subj', 'tk-desc']) {
			expect(labelFor(html, id)).toContain(STAR);
			expect(tagWith(html, 'id="' + id + '"')).toContain('aria-required="true"');
		}
		expect(labelFor(html, 'tk-priority')).not.toContain('ws-req');
	});

	it('marketer help ticket: subject + description', () => {
		const html = read(M + 'help/help.html');
		expect(html).toMatch(/txt-muted">الموضوع<span class="ws-req"/);
		expect(html).toMatch(/txt-muted">وصف المشكلة<span class="ws-req"/);
		expect(tagWith(html, 'id="marketer-ticket-subject"')).toContain('aria-required="true"');
		expect(tagWith(html, 'id="marketer-ticket-description"')).toContain('aria-required="true"');
		expect(html).toMatch(/class="form-error"[^>]*data-testid="ticket-form-error"/);
	});

	it('marketer withdraw: amount, rate-limit message is red', () => {
		const html = read(M + 'withdraw/withdraw.html');
		expect(html).toMatch(/المبلغ \(\$\) <span class="ws-req"/);
		expect(tagWith(html, 'id="withdraw-amount"')).toContain('aria-required="true"');
		expect(html).toMatch(/class="form-error" role="alert" data-testid="withdraw-rate-limit"/);
	});

	it('client profile setup: details, paypal, agreements', () => {
		const html = read(C + 'profile/profile-setup/profile-setup.html');
		expect(html.split(STAR).length - 1).toBeGreaterThanOrEqual(10);
		for (const n of ['idNumber', 'dob', 'country', 'city', 'occupation', 'address', 'paypalPayoutEmail', 'accurate', 'terms', 'privacy']) {
			expect(tagWith(html, 'formControlName="' + n + '"'), n).toContain('aria-required="true"');
		}
		// ID photos are optional (pair only)
		expect(html).toContain('(اختياري)</span></label>');
	});

	it('client profile edit: password trio starred, identity country not starred', () => {
		const html = read(C + 'profile/profile-edit/profile-edit.html');
		for (const id of ['pw-current', 'pw-new', 'pw-confirm']) {
			expect(labelFor(html, id)).toContain(STAR);
			expect(tagWith(html, 'id="' + id + '"')).toContain('aria-required="true"');
		}
		expect(html).not.toMatch(/الدولة <span class="ws-req"/);
		expect(html).toMatch(/class="form-error[^"]*"[^>]*>\s*\{\{ errorMsg\(\) \}\}|data-testid="tab-error"\s+class="form-error/);
	});

	it('add-account (client + marketer): specialty / bio / channel / company fields', () => {
		for (const f of [C + 'profile/add-account/add-account.html', M + 'profile/add-account/add-account.html']) {
			const html = read(f);
			for (const n of ['specMain', 'specExp', 'portfolioBio', 'chType', 'coName', 'coCrn', 'coRole']) {
				expect(tagWith(html, 'ctl.' + n + '"'), f + n).toContain('aria-required="true"');
			}
			expect(html.split(STAR).length - 1).toBe(7);
			expect(html).toMatch(/class="form-error p-4 mb-6/);
		}
	});

	it('marketer data tab: password trio, channel add controls', () => {
		const html = read(M + 'profile/data/data.html');
		for (const id of ['mkt-pwd-old', 'mkt-pwd-new', 'mkt-pwd-conf']) {
			expect(labelFor(html, id)).toContain(STAR);
			expect(tagWith(html, 'id="' + id + '"')).toContain('aria-required="true"');
		}
		expect(tagWith(html, 'aria-label="معرف القناة"')).toContain('aria-required="true"');
	});

	it('marketer profile setup paypal + ref-links new channel', () => {
		expect(read(M + 'profile/profile-setup/profile-setup.html')).toMatch(/for="ps-paypal">بريد PayPal<span class="ws-req"/);
		const rl = read(M + 'ref-links/ref-links.html');
		expect(tagWith(rl, 'id="new-channel-name"')).toContain('aria-required="true"');
		expect(tagWith(rl, 'id="new-channel-utm"')).toContain('aria-required="true"');
	});

	it('create request: step1 title, step3 + step4 fields', () => {
		const s1 = read(C + 'create-request/components/step1-specialty/step1-specialty.html');
		expect(s1).toMatch(/اختر التخصص الرئيسي <span class="ws-req"/);
		expect(tagWith(s1, 'id="f-other-spec"')).toContain('aria-required="true"');
		const s3 = read(C + 'create-request/components/step3-details/step3-details.html');
		for (const id of ['f-title', 'f-desc', 'f-deadline']) {
			expect(labelFor(s3, id)).toContain(STAR);
			expect(tagWith(s3, 'id="' + id + '"')).toContain('aria-required="true"');
		}
		const s4 = read(C + 'create-request/components/step4-budget/step4-budget.html');
		for (const id of ['f-budget-from', 'f-budget-to', 'f-budget-fixed', 'f-budget-hourly']) {
			expect(labelFor(s4, id)).toContain(STAR);
			expect(tagWith(s4, 'id="' + id + '"')).toContain('aria-required="true"');
		}
		expect(s4).toMatch(/class="form-error mt-3 p-2.5 border[^"]*" role="alert" data-testid="ms-cap-message"/);
		expect(s4).toMatch(/class="form-error mt-3 p-2.5 border[^"]*" role="alert" data-testid="ms-add-blocked"/);
	});

	it('negotiation modal: conditional price / duration / note', () => {
		const html = read(C + 'my-request/request-details/request-details.html');
		expect(labelFor(html, 'neg-price')).toContain(STAR);
		expect(labelFor(html, 'neg-dur')).toContain(STAR);
		expect(labelFor(html, 'neg-msg')).toMatch(/@if \(negType\(\) === 'plan' \|\| negType\(\) === 'other'\)/);
		expect(tagWith(html, 'id="neg-price"')).toContain('aria-required="true"');
		expect(tagWith(html, 'id="neg-msg"')).toContain('[attr.aria-required]');
	});

	it('project amendment: conditional stars + mixed hint, red error', () => {
		const html = read(C + 'project/project-details/project-details.html');
		expect(html).not.toContain('class="rq"');
		expect(labelFor(html, 'amend-kind')).toContain(STAR);
		expect(labelFor(html, 'amend-title-in')).toContain(STAR);
		expect(labelFor(html, 'amend-desc')).toMatch(/@if\(amendKind==='SCOPE'\)/);
		expect(tagWith(html, 'id="amend-budget"')).toContain('[attr.aria-required]');
		expect(html).toContain('data-testid="amend-mixed-hint"');
		expect(html).toMatch(/class="up-err" role="alert" data-testid="amend-error"/);
	});

	it('delivery review revision note + ratings', () => {
		const dr = read(C + 'project/delivery-review/delivery-review.html');
		expect(labelFor(dr, 'dr-rev-note')).toContain(STAR);
		expect(tagWith(dr, 'id="dr-rev-note"')).toContain('aria-required="true"');
		const rp = read(C + 'project/rating-page/rating-page.html');
		expect(rp).toMatch(/التقييم العام <span class="ws-req"/);
		expect(rp).toContain('aria-required="true" [attr.aria-invalid]');
		expect(rp).toContain('id="rp-submit-err"');
		const rm = read(C + 'project/rating-modal/rating-modal.html');
		expect(rm).toMatch(/class="form-error" id="rt-star-err" role="alert"/);
		expect(rm).toContain('role="radiogroup"');
		expect(read(C + 'project/archived-projects/archived-projects.html')).toMatch(/<label>التقييم <span class="ws-req"/);
	});

	it('team invite: name, email, job title starred, phone optional, red error tied to fields', () => {
		const html = read(C + 'team/team-management.component.html');
		for (const id of ['invite-name', 'invite-email', 'invite-job']) {
			expect(labelFor(html, id)).toContain(STAR);
			expect(tagWith(html, 'id="' + id + '"')).toContain('aria-required="true"');
			expect(tagWith(html, 'id="' + id + '"')).toContain('aria-describedby');
		}
		expect(labelFor(html, 'invite-phone')).not.toContain('ws-req');
		expect(html).toMatch(/class="form-error" id="invite-err" role="alert"/);
	});

	it('contract signature ack + escrow deposit messages', () => {
		const cs = read(C + 'my-request/contract-signature/contract-signature.html');
		expect(cs).toMatch(/شروط الاستخدام<\/a> <span class="ws-req"/);
		expect(tagWith(cs, 'id="ack-ctr"')).toContain('aria-required="true"');
		const ed = read(C + 'my-request/escrow-deposit/escrow-deposit.html');
		expect(ed).toMatch(/id="ed-otp-err" class="form-error" role="alert"/);
		expect(ed).toMatch(/class="form-error" role="alert" style="margin-top:10px">\{\{ formError/);
	});

	it('settings save error is red', () => {
		expect(read(C + 'settings/account/account.html')).toMatch(/class="field-error text-\[12px\] font-bold" role="alert" data-testid="save-error"/);
	});

	it('shared dispute + deposit modals', () => {
		const d = read('sheards/dispute-modal/dispute-modal.html');
		expect(labelFor(d, 'dp-reason')).toContain(STAR);
		expect(labelFor(d, 'dp-desc')).toContain(STAR);
		expect(tagWith(d, 'id="dp-reason"')).toContain('aria-required="true"');
		expect(tagWith(d, 'id="dp-desc"')).toContain('aria-required="true"');
		expect(d).not.toContain('class="dp-error"');
		const dep = read('sheards/deposit-modal/deposit-modal.html');
		expect(dep).toMatch(/المبلغ المراد إيداعه<\/span> <span class="ws-req"|المبلغ المراد إيداعه <span class="ws-req"/);
		expect(tagWith(dep, 'id="deposit-amount"')).toContain('aria-required="true"');
		expect(tagWith(dep, 'id="deposit-terms"')).toContain('aria-required="true"');
		expect(read('shared/forms/paypal-email-confirm.component.ts')).toContain('class="form-error"');
	});
});
