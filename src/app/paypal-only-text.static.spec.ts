/// <reference types="node" />

// Static guard: PayPal is the only money method, so no user / admin / public page may present a bank
// account (IBAN, bank name, account holder / number, bank transfer) as a payment or withdrawal method.
// Comments are stripped first: the cleanup notes may still mention the removed fields.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES = join(__dirname, 'pages');
const read = (rel: string) => readFileSync(join(PAGES, rel), 'utf-8');

function stripComments(src: string): string {
	return src
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');
}

const FILES = [
	// user: client / marketer / provider setup + data + withdraw
	'dashboard/clients-overview/profile/profile-setup/profile-setup.html',
	'dashboard/clients-overview/profile/profile-setup/profile-setup.ts',
	'dashboard/clients-overview/profile/profile-edit/profile-edit.html',
	'dashboard/clients-overview/profile/profile-edit/profile-edit.ts',
	'dashboard/marketer-overview/profile/data/data.html',
	'dashboard/marketer-overview/profile/data/data.ts',
	'dashboard/provider-overview/profile/profile-setup/profile-setup.html',
	'dashboard/provider-overview/profile/profile-setup/profile-setup.ts',
	'dashboard/provider-overview/profile/data/data.html',
	'dashboard/provider-overview/finance/withdraw/withdraw.html',
	'dashboard/provider-overview/finance/withdraw/withdraw.ts',
	// admin
	'dashboard/supper-admin-overview/sa-withdrawals/sa-withdrawals.html',
	'dashboard/supper-admin-overview/sa-withdrawals/sa-withdrawals.ts',
	'dashboard/supper-admin-overview/sa-withdrawals/sa-withdrawal-detail/sa-withdrawal-detail.html',
	'dashboard/supper-admin-overview/sa-withdrawals/sa-withdrawal-detail/sa-withdrawal-detail.ts',
	'dashboard/supper-admin-overview/sa-users/sa-user-detail/sa-user-detail.html',
	'dashboard/supper-admin-overview/sa-users/sa-users.service.ts',
	'dashboard/supper-admin-overview/sa-kyc/sa-kyc.html',
	'dashboard/supper-admin-overview/sa-kyc/sa-kyc.ts',
	'dashboard/supper-admin-overview/supper-admin-overview/supper-admin-overview.html',
	'dashboard/supper-admin-overview/sa-team/sa-team-member-detail/sa-team-member-detail.ts',
	'dashboard/supper-admin-overview/sa-audit-trail/sa-audit-trail.ts',
	// public
	'website/privacy/privacy.component.html',
	'website/terms/terms.component.html',
	'website/legal/legal-page.component.ts',
	'website/partners/partners.html',
	'website/how-it-works/provider/provider.html',
	'website/how-it-works/marketer/marketer.html',
	'website/how-it-works/client/client.html',
	'website/blog/blog-data.ts',
	'website/marketplace/marketplace.html',
	'website/support/help-center/help-center.component.ts',
	'website/support/help-article/help-article.component.ts',
	'website/support/join-marketer/join-marketer.component.ts',
];

const FORBIDDEN: (string | RegExp)[] = ['IBAN', 'bankName', 'accountNumber', 'accountHolder', 'حساب بنكي', 'الحساب البنكي', 'اسم البنك', 'تحويل بنكي', 'بيانات بنكية'];

describe('PayPal is the only money method (no bank wording on payment pages)', () => {
	for (const rel of FILES) {
		it(rel, () => {
			const src = stripComments(read(rel));
			for (const word of FORBIDDEN) expect(src, `${rel} contains "${String(word)}"`).not.toContain(word as string);
		});
	}
});
