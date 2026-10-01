/// <reference types="node" />

// AI Cleanup Batch 1: static-content regression guards. Each assertion pins
// the removal of a hardcoded, frontend-only AI claim that had no backend or
// AI behind it. Real data bindings that sit next to those claims are asserted
// to still be present, so the cleanup cannot silently drop real data.
// Same raw-markup approach as g16-marketing-ai-claims.static.spec.ts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readSrc(relativePath: string): string {
	return readFileSync(join(__dirname, relativePath), 'utf-8');
}

const navDashboardHtml = readSrc('../../sheards/dashboard/nav-dashboard/nav-dashboard.html');
const navbarHtml = readSrc('../../sheards/navbar/navbar.html');
const messagesHtmls = [
	readSrc('clients-overview/messages/messages.html'),
	readSrc('marketer-overview/messages/messages.html'),
	readSrc('provider-overview/messages/messages.html'),
];
const invoicesHtml = readSrc('clients-overview/finance/invoices/invoices.html');
const invoiceDetailsHtml = readSrc('clients-overview/finance/invoice-details/invoice-details.html');
const finalApprovalHtml = readSrc('clients-overview/project/final-approval/final-approval.html');
const contractSignatureHtml = readSrc('clients-overview/my-request/contract-signature/contract-signature.html');
const contractSignatureTs = readSrc('clients-overview/my-request/contract-signature/contract-signature.ts');
const signContractHtml = readSrc('provider-overview/offers/sign-contract/sign-contract.html');
const signContractTs = readSrc('provider-overview/offers/sign-contract/sign-contract.ts');

describe('AI Cleanup Batch 1 — fabricated AI claims removed', () => {
	it('navbars: no static "AI · 95%" / "AI is active" badge', () => {
		for (const src of [navDashboardHtml, navbarHtml]) {
			expect(src).not.toContain('AI &middot; 95%');
			expect(src).not.toContain('الذكاء الاصطناعي نشط');
		}
	});

	it('messages (client/marketer/provider): no "AI monitors all chats" claim or monitoring-accuracy percentage', () => {
		for (const src of messagesHtmls) {
			expect(src).not.toContain('مطّلع على جميع المحادثات');
			expect(src).not.toContain('دقة الرصد');
		}
	});

	it('invoices: no AI / ZATCA verification claim; real verificationScore still shown', () => {
		expect(invoicesHtml).not.toContain('هيئة الزكاة');
		expect(invoicesHtml).not.toContain('وسيط AI، التحقق من الفواتير');
		expect(invoicesHtml).toContain('verificationScore()');
	});

	it('invoice-details: no unconditional "AI verified this invoice" sentence; real verificationScore still shown', () => {
		expect(invoiceDetailsHtml).not.toContain('تم التحقق من ربط الفاتورة');
		expect(invoiceDetailsHtml).toContain('invoice()?.verificationScore');
	});

	it('final-approval: no AI auto-verify/auto-release claim, no hardcoded "high quality"; real match value and deadline kept', () => {
		expect(finalApprovalHtml).not.toContain('نيابةً عنك');
		expect(finalApprovalHtml).not.toContain('يتحقق الذكاء');
		expect(finalApprovalHtml).not.toContain('جودة عالية');
		expect(finalApprovalHtml).toContain('aiMatchPct(stage)');
		expect(finalApprovalHtml).toContain('formatDate(autoAcceptDeadline())');
	});

	it('contract-signature: no fabricated provider greeting and no "AI monitors the chat" claim', () => {
		expect(contractSignatureTs).not.toContain('أي بند ترغب بتعديله');
		expect(contractSignatureHtml).not.toContain('الذكاء يراقب المحادثة');
	});

	it('final-approval: no "auto-summarized" claim and no "AI evaluation" heading; real match binding kept', () => {
		expect(finalApprovalHtml).not.toContain('تلقائياً لمساعدتك');
		expect(finalApprovalHtml).not.toContain('تقييم الذكاء');
		expect(finalApprovalHtml).toContain('aiMatchPct(stage)');
		expect(finalApprovalHtml).toContain('qualityNote(stage)');
	});

	it('contract clause 6 (client + provider): no "via the AI layer" dispute claim; clause itself kept', () => {
		for (const src of [contractSignatureHtml, signContractHtml]) {
			expect(src).not.toContain('طبقة الذكاء');
			expect(src).toContain('6. فض النزاع:');
		}
	});

	it('provider sign-contract: no fabricated greeting and no "AI monitors the chat" claim; signing flow kept', () => {
		expect(signContractHtml).not.toContain('أي بند ترغب بتعديله');
		expect(signContractHtml).not.toContain('الذكاء يراقب المحادثة');
		expect(signContractHtml).toContain('(click)="signContract()"');
		expect(signContractHtml).toContain('chatMessages()');
	});

	it('contract screens: dead "AI extracted the agreed clause" box and its state are gone', () => {
		for (const src of [contractSignatureHtml, signContractHtml, contractSignatureTs, signContractTs]) {
			expect(src).not.toContain('استخلص الذكاء');
			expect(src).not.toContain('showAiExtract');
			expect(src).not.toContain('aiExtractText');
		}
	});

	it('contract modals: no hardcoded "نو" initials or fake "9" badge; initials come from real names', () => {
		expect(signContractHtml).not.toContain('>نو<');
		expect(signContractHtml).not.toContain('txt-navy">9<');
		expect(contractSignatureHtml).not.toContain('txt-navy">9<');
		expect(signContractHtml).toContain('counterpartyInitials()');
		expect(contractSignatureHtml).toContain('providerInitials()');
	});

	it('provider sign-contract: no fixed sample scope clause', () => {
		expect(signContractHtml).not.toContain('تصميم هوية بصرية متكاملة');
	});
});
