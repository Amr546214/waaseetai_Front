/// <reference types="node" />

// Final G16 marketing/trust claim cleanup batch: these are plain static-content
// assertions over the raw markup, not component-render tests. The finding was
// about literal text on public pages promising AI capabilities (fraud
// monitoring, dispute resolution, contract-violation detection, predictive
// alerts, a fabricated review banner, a static fake AI mediator) that have no
// backing implementation anywhere in the backend. Reading the template file
// content directly is a stronger and more direct proof of removal than
// mounting the component, and avoids the project's known unrelated
// TestBed/jsdom DI issues.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readSrc(relativePath: string): string {
	return readFileSync(join(__dirname, relativePath), 'utf-8');
}

const aboutHtml = readSrc('about/about.html');
const partnersHtml = readSrc('partners/partners.html');
const aiFeaturesHtml = readSrc('home/components/ai-features/ai-features.html');
const paymentHtml = readSrc('checkout/payment/payment.html');
const successHtml = readSrc('checkout/success/success.html');
const reviewHtml = readSrc('checkout/review/review.html');
const cartHtml = readSrc('checkout/cart/cart.html');
const customRequestHtml = readSrc('checkout/custom-request/custom-request.html');
const howItWorksProviderHtml = readSrc('how-it-works/provider/provider.html');
const howItWorksClientHtml = readSrc('how-it-works/client/client.html');
const howItWorksMarketerHtml = readSrc('how-it-works/marketer/marketer.html');
const offerHtml = readSrc('marketplace/offer/offer.html');
const compareServicesHtml = readSrc('marketplace/compare-services/compare-services.html');
const compareProvidersHtml = readSrc('marketplace/compare-providers/compare-providers.html');
const pricingHtml = readSrc('pricing/pricing.html');

// Batch 2: dispute-workflow-accuracy fixes, traced against the real backend
// dispute.service.ts (manual create -> admin-review -> admin-resolve, zero
// AI/Gemini involvement, no preliminary verdict, no appeal window, no
// monetary threshold — confirmed by reading the actual backend code).
const helpArticleTs = readSrc('support/help-article/help-article.component.ts');
const helpCenterTs = readSrc('support/help-center/help-center.component.ts');
const termsHtml = readSrc('terms/terms.component.html');
const privacyHtml = readSrc('privacy/privacy.component.html');
const legalPageTs = readSrc('legal/legal-page.component.ts');
const policyHubTs = readSrc('legal/policy-hub/policy-hub.ts');
const pressHtml = readSrc('press/press.html');
const marketerProfileTs = readSrc('marketplace/marketer-profile/marketer-profile.ts');
const marketerProfileHtml = readSrc('marketplace/marketer-profile/marketer-profile.html');
const howItWorksTs = readSrc('how-it-works/how-it-works.ts');

// Batch 6 additions.
const kpiHtml = readSrc('home/components/kpi/kpi.html');
const providerProfileHtml = readSrc('marketplace/provider-profile/provider-profile.html');
const saApisHtml = readSrc('../dashboard/supper-admin-overview/it/sa-apis/sa-apis.html');
const saBackupsHtml = readSrc('../dashboard/supper-admin-overview/it/sa-backups/sa-backups.html');
const saCdnHtml = readSrc('../dashboard/supper-admin-overview/it/sa-cdn/sa-cdn.html');
const saDatabaseHtml = readSrc('../dashboard/supper-admin-overview/it/sa-database/sa-database.html');
const saMonitoringTs = readSrc('../dashboard/supper-admin-overview/it/sa-monitoring/sa-monitoring.ts');
const saPerformanceHtml = readSrc('../dashboard/supper-admin-overview/it/sa-performance/sa-performance.html');
const saSecurityHtml = readSrc('../dashboard/supper-admin-overview/it/sa-security/sa-security.html');
const saSecurityTs = readSrc('../dashboard/supper-admin-overview/it/sa-security/sa-security.ts');
const saAuditTrailHtml = readSrc('../dashboard/supper-admin-overview/sa-audit-trail/sa-audit-trail.html');
const saFinanceReportsHtml = readSrc('../dashboard/supper-admin-overview/sa-finance-reports/sa-finance-reports.html');
const saSubFinanceReportsHtml = readSrc('../dashboard/supper-admin-overview/sub-finance/sa-sub-finance-reports/sa-sub-finance-reports.html');
const saMessagesHtml = readSrc('../dashboard/supper-admin-overview/sa-messages/sa-messages.html');
const saOffersHtml = readSrc('../dashboard/supper-admin-overview/sa-offers/sa-offers.html');
const saOffersTs = readSrc('../dashboard/supper-admin-overview/sa-offers/sa-offers.ts');
const saReportsHtml = readSrc('../dashboard/supper-admin-overview/sa-reports/sa-reports.html');
const saSuperAdminsTs = readSrc('../dashboard/supper-admin-overview/sa-super-admins/sa-super-admins.ts');
const saSupportHtml = readSrc('../dashboard/supper-admin-overview/sa-support/sa-support.html');
const saCashbackHtml = readSrc('../dashboard/supper-admin-overview/sub-finance/sa-cashback/sa-cashback.html');

describe('G16 marketing/trust claim cleanup — no unsupported AI capability claims remain', () => {
	it('payment.html: no AI fraud-monitoring claim remains', () => {
		expect(paymentHtml).not.toContain('مراقبة احتيال بالذكاء الاصطناعي');
		expect(paymentHtml).not.toContain('احتيال');
	});

	it('partners.html: no AI transaction/fraud-monitoring claim remains', () => {
		expect(partnersHtml).not.toContain('الذكاء الاصطناعي يراقب كل المعاملات');
		expect(partnersHtml).not.toContain('يكشف أي نشاط غير طبيعي');
		expect(partnersHtml).not.toContain('حماية نشطة');
	});

	it('about.html: no AI dispute-resolution claim remains', () => {
		expect(aboutHtml).not.toContain('نزاعات محلولة بالذكاء الاصطناعي');
		expect(aboutHtml).not.toContain('كل خطوة مراقبة ومحللة');
		expect(aboutHtml).not.toContain('يتتبع مراحل التسليم ويُنبه');
	});

	it('ai-features.html: no predictive contract/delay AI claim remains', () => {
		expect(aiFeaturesHtml).not.toContain('كشف مخالفات العقد');
		expect(aiFeaturesHtml).not.toContain('تنبيه قبل حدوث المشكلة');
		expect(aiFeaturesHtml).not.toContain('يكتشف مؤشرات التأخير والنزاع');
	});

	it('checkout/success.html: no AI project-monitoring/alert claim remains', () => {
		expect(successHtml).not.toContain('الذكاء الاصطناعي يراقب مشاريعك');
	});

	it('checkout/review.html: no fabricated AI review-success banner remains', () => {
		expect(reviewHtml).not.toContain('الذكاء الاصطناعي راجع طلبك');
		expect(reviewHtml).not.toContain('مراقبة الذكاء الاصطناعي للجودة');
	});

	it('checkout/custom-request.html: no static AI mediator/suggestion panel remains', () => {
		expect(customRequestHtml).not.toContain('وسيط AI الذكي');
		expect(customRequestHtml).not.toContain('ai-suggestion-panel');
		expect(customRequestHtml).not.toContain('تحليل ذكي');
	});

	it('same-file sweep: how-it-works pages no longer claim AI monitors quality with real-time alerts', () => {
		for (const html of [howItWorksProviderHtml, howItWorksClientHtml, howItWorksMarketerHtml]) {
			expect(html).not.toContain('AI يراقب الجودة');
			expect(html).not.toContain('مراقبة AI للجودة');
			expect(html).not.toContain('يرصد أي انحراف عن المعايير');
		}
	});

	it('same-file sweep: marketplace comparison/offer pages no longer claim AI monitors delivery quality', () => {
		for (const html of [offerHtml, compareServicesHtml, compareProvidersHtml]) {
			expect(html).not.toContain('مراقبة AI لجودة التسليم');
		}
	});

	it('pricing.html: no longer claims AI monitors in real time', () => {
		expect(pricingHtml).not.toContain('AI يراقب ويحسب بدقة');
	});

	it('preserves the real, backend-sourced aiScore passthrough in cart/review', () => {
		expect(reviewHtml).toContain('item.aiScore');
		expect(cartHtml).toContain('item.aiScore');
	});
});

describe('G16 batch 2 — dispute-workflow accuracy (traced against real dispute.service.ts)', () => {
	const disputeAiFictionPhrases = [
		'قرار نزاع أولي',
		'يُحلل AI الأدلة',
		'قرار AI في النزاع',
		'الاعتراض على قرار AI',
		'كسر قرار AI',
	];

	it('help-article.component.ts: no AI dispute verdict/arbitration wording remains', () => {
		for (const phrase of disputeAiFictionPhrases) {
			expect(helpArticleTs).not.toContain(phrase);
		}
	});

	it('help-center.component.ts: no AI dispute verdict/arbitration wording remains', () => {
		for (const phrase of disputeAiFictionPhrases) {
			expect(helpCenterTs).not.toContain(phrase);
		}
	});

	it('legal-page.component.ts: no AI dispute verdict/arbitration wording remains', () => {
		for (const phrase of disputeAiFictionPhrases) {
			expect(legalPageTs).not.toContain(phrase);
		}
		expect(legalPageTs).not.toContain('وجود قرار AI أو إداري يتطلب مراجعة');
	});

	it('policy-hub.ts: nav description no longer references the removed AI dispute-appeal section', () => {
		expect(policyHubTs).not.toContain('الاعتراض على قرار AI');
	});

	it('terms.component.html: no AI preliminary dispute decision claim remains', () => {
		expect(termsHtml).not.toContain('قرار نزاع أولي');
	});

	it('privacy.component.html: no AI dispute-decision wording remains', () => {
		expect(privacyHtml).not.toContain('قرارات النزاع');
		expect(privacyHtml).not.toContain('وقرارات AI');
	});

	it('no unsupported 48-hour AI appeal claim remains in dispute-support content', () => {
		for (const src of [helpArticleTs, helpCenterTs, legalPageTs]) {
			expect(src).not.toContain('القرار قابل للاعتراض خلال 48 ساعة');
		}
	});

	it('no unsupported 10,000 SAR AI mandatory-review threshold remains', () => {
		expect(helpArticleTs).not.toContain('10,000 ريال');
		expect(helpCenterTs).not.toContain('10,000 ريال');
	});

	it('marketer-profile: fabricated "AI Verified" percentage and AI analytics layer are removed', () => {
		expect(marketerProfileTs).not.toContain('AI Verified');
		expect(marketerProfileTs).not.toContain('aiScore');
		expect(marketerProfileTs).not.toContain('aiRings');
		expect(marketerProfileTs).not.toContain('aiBars');
		expect(marketerProfileHtml).not.toContain('تحليل AI للأداء التسويقي');
		expect(marketerProfileHtml).not.toContain('نقاط AI');
		expect(marketerProfileHtml).not.toContain('متابعون حقيقيون');
	});

	it('press.html: unverifiable security-certification assertion is removed', () => {
		expect(pressHtml).not.toContain('يحصل على اعتماد أمان المعاملات الرقمية');
	});

	it('how-it-works.ts: unsupported AI analytics labels are reclassified to match real backend behavior', () => {
		expect(howItWorksTs).not.toContain('تحليلات AI للإنفاق');
		expect(howItWorksTs).not.toContain('تحليلات AI لأداء الوكالة');
		expect(howItWorksTs).not.toContain('AI يحلل قنواتك');
	});
});

describe('Batch 6 — final key-boundary blockers fixed (semantic, not just wording)', () => {
	it('offer.html: no literal "fair" AI price verdict remains (live sidebar or dead duplicate block)', () => {
		expect(offerHtml).not.toContain('النطاق العادل');
		expect(offerHtml).not.toContain('عادل ومطابق');
		expect(offerHtml).not.toMatch(/>عادل</);
	});

	it('help-center/help-article: AI review is never described as a condition for automatic escrow release', () => {
		for (const src of [helpCenterTs, helpArticleTs]) {
			expect(src).not.toMatch(/مراجعة AI للتسليم/);
			// The real release conditions are delivery + human approval/deadline + no open dispute — three, not four.
			expect(src).not.toContain('اجتماع أربعة شروط');
		}
	});

	it('help-center/help-article/legal-page: no hidden "anti-manipulation weights" AI system implied', () => {
		for (const src of [helpCenterTs, helpArticleTs, legalPageTs]) {
			expect(src).not.toContain('أوزان مكافحة التلاعب');
		}
	});

	it('legal-page.component.ts: accreditation wording does not imply Gemini itself grants the final decision', () => {
		expect(legalPageTs).not.toContain('تحليل AI ثم اعتماد أو طلب استكمال');
		expect(legalPageTs).toContain('قرار الاعتماد النهائي بشري دائماً');
	});

	it('how-it-works/marketer: no claim that AI analyzes marketing channels/audiences', () => {
		expect(howItWorksMarketerHtml).not.toMatch(/يحلل[\s\S]{0,10}(قنوات|جمهور)/);
		expect(howItWorksMarketerHtml).not.toContain('AI يحلل جمهورك');
		expect(howItWorksMarketerHtml).not.toContain('أفضل قناة لك');
	});

	it('how-it-works.ts: registration, payment, wallet-crediting, commission-transfer and plain dashboard-tracking steps carry no AI tag', () => {
		// These exact real, non-AI step titles must never be paired with an aiTag in the source.
		const nonAiSteps = ['سجّل وتصفح', 'اختر وادفع', 'تابع في لوحتك', 'اعتمد وقيّم', 'سجّل حساب شركة', 'أدر المشاريع مؤسسياً', 'اعتمد وتلقّ الفواتير', 'سجّل وأكمل ملفك', 'احصل على أرباحك', 'سجّل وكالتك', 'أدر المشاريع مركزياً', 'وزّع الأرباح', 'سجّل كوسيط', 'اربط الأطراف', 'أشرف على التنفيذ', 'احصل على عمولتك'];
		for (const title of nonAiSteps) {
			const line = howItWorksTs.split('\n').find(l => l.includes(`title: '${title}'`));
			expect(line, `step "${title}" not found`).toBeTruthy();
			expect(line).not.toMatch(/aiTag/);
		}
	});

	it('provider how-it-works: no "AI guarantees reaching the best clients" claim', () => {
		const providerHtml = howItWorksProviderHtml;
		expect(providerHtml).not.toContain('يضمن وصول مشاريعك لأفضل العملاء');
	});

	it('kpi.html: no fabricated "95% قرارات مدعومة بـ AI" statistic', () => {
		expect(kpiHtml).not.toContain('95%');
		expect(kpiHtml).not.toContain('قرارات مدعومة بـ');
	});

	it('provider-profile.html: identity verification is never attributed to AI', () => {
		expect(providerProfileHtml).not.toContain('هوية مدققة من وسيط AI');
		expect(providerProfileHtml).not.toMatch(/مدققة من وسيط AI/);
	});

	it('press.html: no fixed six-axis/real-time Trust Score formula and no "AI as arbiter/judge" wording', () => {
		expect(pressHtml).not.toContain('ستة محاور أساسية');
		expect(pressHtml).not.toContain('بشكل شفاف وآني');
		expect(pressHtml).not.toContain('يعتمد الذكاء الاصطناعي محكّماً');
	});

	it('super-admin IT pages: no fabricated autonomous AI infrastructure claims remain', () => {
		expect(saApisHtml).not.toContain('AI Anomaly');
		expect(saApisHtml).not.toMatch(/AI يراقب حركة API/);
		expect(saBackupsHtml).not.toMatch(/AI يضمن سلامة البيانات/);
		expect(saBackupsHtml).not.toMatch(/AI يجدول النسخ/);
		expect(saCdnHtml).not.toMatch(/AI يحسن Cache/);
		expect(saCdnHtml).not.toMatch(/AI يحلل أنماط الاستخدام الجغرافي/);
		expect(saDatabaseHtml).not.toMatch(/AI يكتشف الاستعلامات البطيئة/);
		expect(saDatabaseHtml).not.toContain('AI Optimization');
		expect(saMonitoringTs).not.toMatch(/AI يتوقع وصوله/);
		expect(saPerformanceHtml).not.toMatch(/AI يكتشف الاختناقات/);
		expect(saPerformanceHtml).not.toContain('AI Bottleneck');
	});

	it('sa-security: no automatic AI threat-detection-and-blocking claim remains', () => {
		expect(saSecurityHtml).not.toContain('AI يكشف التهديدات تلقائياً');
		expect(saSecurityHtml).not.toMatch(/AI يحلل أنماط الدخول[\s\S]*يحجب التهديدات تلقائياً/);
		expect(saSecurityHtml).not.toContain('AI Threat');
		expect(saSecurityTs).not.toContain('حجب تلقائي بـ AI');
	});

	it('sa-audit-trail: anomaly detection is not attributed to AI', () => {
		expect(saAuditTrailHtml).not.toMatch(/AI اكتشف \d+ عمليات/);
	});

	it('sa-finance-reports/sub-finance: no "AI forecasts revenue with high accuracy" claim', () => {
		for (const src of [saFinanceReportsHtml, saSubFinanceReportsHtml]) {
			expect(src).not.toContain('بدقة عالية');
		}
	});

	it('sa-messages: no claim that AI is aware of/monitors every conversation, no fabricated monitoring-accuracy percentage', () => {
		expect(saMessagesHtml).not.toMatch(/مطّلع على جميع المحادثات/);
		expect(saMessagesHtml).not.toContain('دقة الرصد');
	});

	it('sa-offers: no AI fake-account/fraud detection claim on price outliers', () => {
		expect(saOffersHtml).not.toMatch(/<th>AI<\/th>/);
		expect(saOffersTs).not.toMatch(/رصد AI سعراً شاذاً/);
		expect(saOffersTs).not.toContain('احتمال حساب وهمي');
	});

	it('sa-reports: fraud/abuse detection is not attributed to AI', () => {
		expect(saReportsHtml).not.toContain('كُشف بـ AI تلقائياً');
		expect(saReportsHtml).not.toMatch(/>AI: /);
		expect(saReportsHtml).not.toContain('AI Risk:');
	});

	it('sa-super-admins: no fictional "AI Fraud Detection" / "AI Content Moderation" toggle, and "AI Dispute Resolution" is relabeled as an advisory summary', () => {
		expect(saSuperAdminsTs).not.toContain("label: 'AI Fraud Detection'");
		expect(saSuperAdminsTs).not.toContain("label: 'AI Content Moderation'");
		expect(saSuperAdminsTs).not.toContain('AI Dispute Resolution');
		expect(saSuperAdminsTs).not.toContain('تفعيل AI Fraud Detection');
		expect(saSuperAdminsTs).not.toMatch(/AI يفلتر الرسائل/);
		expect(saSuperAdminsTs).not.toMatch(/AI يرصد تسجيل الدخول/);
	});

	it('sa-support: the "resolved automatically by AI" claim is removed (it also contradicted the page\'s own "handled manually" disclaimer)', () => {
		expect(saSupportHtml).not.toContain('حُلّت بـ AI تلقائياً');
	});

	it('sa-cashback: cashback distribution is not attributed to autonomous AI', () => {
		expect(saCashbackHtml).not.toMatch(/AI يحسب النسب تلقائياً/);
		expect(saCashbackHtml).not.toContain('AI Distribution');
		expect(saCashbackHtml).not.toMatch(/AI يحسب توزيع الكاش باك/);
	});
});
