/// <reference types="node" />

// AI Cleanup Batch 2: static-content regression guards. Each assertion pins
// the removal of a hardcoded / frontend-invented value or a local-only action
// that pretended to succeed. Real bindings that sit next to them are asserted
// to still be present, so the cleanup cannot silently drop real data.
// Same raw-source approach as ai-cleanup-batch1.static.spec.ts.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function htmlFilesUnder(dir: string): string[] {
	return readdirSync(dir).flatMap((n) => {
		const p = join(dir, n);
		return statSync(p).isDirectory() ? htmlFilesUnder(p) : p.endsWith('.html') ? [p] : [];
	});
}

function readSrc(relativePath: string): string {
	return readFileSync(join(__dirname, relativePath), 'utf-8');
}

const createReq = 'clients-overview/create-request/';
const step6Html = readSrc(createReq + 'components/step6-review/step6-review.html');
const step6Ts = readSrc(createReq + 'components/step6-review/step6-review.ts');
const step2Html = readSrc(createReq + 'components/step2-conditions/step2-conditions.html');
const createReqTs = readSrc(createReq + 'create-request.ts');

const negotiateHtml = readSrc('provider-overview/offers/negotiate/negotiate.html');
const negotiateTs = readSrc('provider-overview/offers/negotiate/negotiate.ts');
const signContractHtml = readSrc('provider-overview/offers/sign-contract/sign-contract.html');

const applyBase = 'provider-overview/explore-requests/applay-request/';
const applyStep3Html = readSrc(applyBase + 'components/step3-review/step3-review.html');
const applyStep4Html = readSrc(applyBase + 'components/step4-success/step4-success.html');
const applyStep1Html = readSrc(applyBase + 'components/step1-general/step1-general.html');
const applyHtml = readSrc(applyBase + 'applay-request.html');
const applyTs = readSrc(applyBase + 'applay-request.ts');

const incomingHtml = readSrc('provider-overview/company/incoming-requests/incoming-requests.component.html');
const incomingTs = readSrc('provider-overview/company/incoming-requests/incoming-requests.component.ts');
const changeOrdersHtml = readSrc('provider-overview/company/change-orders/change-orders.component.html');
const changeOrdersTs = readSrc('provider-overview/company/change-orders/change-orders.component.ts');
const salesStatsHtml = readSrc('provider-overview/company/sales-stats/sales-stats.component.html');
const salesStatsTs = readSrc('provider-overview/company/sales-stats/sales-stats.component.ts');
const marketHtml = readSrc('provider-overview/business-models/market/market.html');
const marketTs = readSrc('provider-overview/business-models/market/market.ts');
const reportsHtml = readSrc('provider-overview/reports/reports.html');

const accreditationHtml = readSrc('provider-overview/business-models/center/accreditation-details/accreditation-details.html');
const marketerDataHtml = readSrc('marketer-overview/profile/data/data.html');
const marketerDataTs = readSrc('marketer-overview/profile/data/data.ts');

describe('AI Cleanup Batch 2 — Step 0: provider sign-contract clause numbering', () => {
	it('remaining clauses are numbered from 1 (no gap left by the removed sample scope clause)', () => {
		expect(signContractHtml).toContain('1. المراحل والسداد:');
		expect(signContractHtml).toContain('5. فض النزاع:');
		expect(signContractHtml).not.toContain('6. فض النزاع:');
		expect(signContractHtml).not.toContain('نطاق العمل:');
	});
});

describe('AI Cleanup Batch 2 — client create-request', () => {
	it('step 6: no hardcoded per-card AI verification percentages', () => {
		for (const v of ['96%', '89%', '88%', '94%', '97%']) {
			expect(step6Html).not.toContain(v);
		}
		expect(step6Html).not.toContain('محقق بالذكاء');
		expect(step6Html).not.toContain('اجتاز فحص الذكاء');
	});

	it('step 6: no hardcoded 92/100 request-quality score (ring or confirm modal)', () => {
		expect(step6Html).not.toContain('92');
		expect(step6Html).not.toContain('جودة AI');
		expect(step6Html).not.toContain('ai-score-num');
	});

	it('step 6: no fixed market-budget recommendation that overwrites the budget', () => {
		expect(step6Html).not.toContain('9,500');
		expect(step6Html).not.toContain('10,000');
		expect(step6Ts).not.toContain('10000');
		expect(step6Ts).not.toContain('applyRecBudget');
	});

	it('step 6: no fixed priority / "files scanned clean" / "no conflict" claims', () => {
		expect(step6Html).not.toContain('>عالية<');
		expect(step6Html).not.toContain('نظيفة');
		expect(step6Html).not.toContain('لا تعارض');
		expect(step6Html).not.toContain('اكتملت مراجعة الطلب');
	});

	it('step 6: real entered values and the publish flow are kept', () => {
		expect(step6Html).toContain('parent.title()');
		expect(step6Html).toContain('parent.deliveryDays()');
		expect(step6Html).toContain('parent.files().length');
		expect(step6Html).toContain('(click)="confirmPublish()"');
		expect(step6Ts).toContain('this.parent.submitRequest()');
	});

	it('step 2: no fixed "no conflict with system policies" verdict and no claim of an automatic policy check', () => {
		expect(step2Html).not.toContain('لا تعارض مع سياسات النظام');
		expect(step2Html).not.toContain('يفحص الشروط المخصصة تلقائيا');
		expect(step2Html).toContain('parent.customConditions()');
	});

	it('ai-suggest failure no longer auto-selects a specialty and reports it as an applied AI suggestion', () => {
		expect(createReqTs).not.toContain('تم تطبيق اقتراح AI:');
		expect(createReqTs).toContain('this.projectApi.aiSuggest(payload)');
	});
});

describe('AI Cleanup Batch 2 — provider negotiate', () => {
	it('no fabricated client round, client message, or AI confidence', () => {
		expect(negotiateTs).not.toContain('السعر أعلى قليلاً من ميزانيتنا');
		expect(negotiateTs).not.toContain('aiConfidence');
		expect(negotiateTs).not.toContain('0.88');
		expect(negotiateTs).not.toContain("actor: 'client'");
		expect(negotiateHtml).not.toContain('تحليل AI');
	});

	it('no midpoint "settlement" suggestion derived from an invented client price', () => {
		expect(negotiateTs).not.toContain('suggestedSettlement');
		expect(negotiateHtml).not.toContain('نقطة تسوية مقترحة');
	});

	it('no local-only counter-offer / accept / end actions that showed fake success', () => {
		expect(negotiateTs).not.toContain('تم إرسال عرضك المضاد');
		expect(negotiateTs).not.toContain('تم إنهاء التفاوض');
		expect(negotiateTs).not.toContain('submitCounterOffer');
		expect(negotiateTs).not.toContain('confirmAccept');
		expect(negotiateHtml).not.toContain('إرسال العرض المضاد');
		expect(negotiateHtml).toContain('غير متاح حاليا');
	});

	it('real offer load and the real conversation link are kept', () => {
		expect(negotiateTs).toContain('this.offersService.getOfferById(id)');
		expect(negotiateHtml).toContain('(click)="openConversation()"');
	});
});

describe('AI Cleanup Batch 2 — provider apply-request steps 3 & 4', () => {
	it('step 1: proposal AI suggest has no dead tooltip, hardcoded text or fake confidence', () => {
		expect(applyStep1Html).not.toContain('أحتاج إلى تطوير متجر إلكتروني متكامل');
		expect(applyStep1Html).not.toContain('دقة AI: 95%');
		expect(applyStep1Html).not.toContain('ai-tooltip');
		expect(applyStep1Html).not.toContain('showAiSuggest');
		expect(applyStep1Html).toContain('اقتراح AI');
		expect(applyStep1Html).toContain('ولا يحدد سعرًا عادلًا');
	});

	it('step 3: no fixed "optimal" price/duration panel or fixed duration note', () => {
		expect(applyStep3Html).not.toContain('4,500');
		expect(applyStep3Html).not.toContain('14 يوم');
		expect(applyStep3Html).not.toContain('10-18');
		expect(applyStep3Html).not.toContain('مثاليان');
	});

	it('step 3: no fixed "AI-improved" message and no "+35%" uplift', () => {
		expect(applyStep3Html).not.toContain('+35%');
		expect(applyStep3Html).not.toContain('98%');
		expect(applyStep3Html).not.toContain('الرسالة المُحسَّنة من AI');
		expect(applyHtml).not.toContain('acceptAiMsg');
		expect(applyHtml).not.toContain('acceptAiPrice');
	});

	it('step 3: no fixed competitive rank / win chance; real proposalsCount has no invented fallback', () => {
		expect(applyStep3Html).not.toContain('الأفضل سعرًا');
		expect(applyStep3Html).not.toContain('>مرتفعة<');
		expect(applyStep3Html).not.toContain('proposalsCount || 3');
		expect(applyStep3Html).toContain('projectDetails?.proposalsCount');
	});

	it('step 3: is a proposal QUALITY review only — no fair price, acceptance odds or fit claims', () => {
		expect(applyStep3Html).toContain('مراجعة جودة العرض');
		expect(applyStep3Html).toContain('currentAudit.finalMetrics.overallScore');
		expect(applyStep3Html).toContain('لا يقيس توافقه مع المشروع ولا عدالة السعر');
		for (const banned of ['السعر العادل', 'المدة المنطقية', 'الموصى به', 'توصية AI', 'acceptanceOdds', 'topPercentage', 'احتمال', 'مقارنة السعر والمدة', 'توافق الملف المهني', 'تنافسية السعر', 'منطقية الجدول الزمني', 'تجاهل']) {
			expect(applyStep3Html).not.toContain(banned);
		}
		expect(applyStep3Html).not.toContain('metrics.profileMatch');
		expect(applyStep3Html).not.toContain('metrics.priceCompetitiveness');
	});

	it('apply wizard sends no placeholder project/provider/price/duration to the audit', () => {
		for (const banned of ['proj-demo-101', 'prov-demo-101', '|| 4500', '|| 14', 'عرض فني وتطويري']) {
			expect(applyTs).not.toContain(banned);
		}
		expect(applyTs).toContain('overallScore: null');
	});

	it('step 4: no fixed 93% / 97% / +35% / "best priced among N" claims', () => {
		expect(applyStep4Html).not.toContain('93%');
		expect(applyStep4Html).not.toContain('97%');
		expect(applyStep4Html).not.toContain('+35%');
		expect(applyStep4Html).not.toContain('الأفضل سعرًا');
		expect(applyStep4Html).not.toContain('— مرتفع');
	});

	it('step 4: only the real quality score is shown; no style/profile/competitiveness figures', () => {
		expect(applyStep4Html).toContain('currentAudit.finalMetrics.overallScore');
		expect(applyStep4Html).toContain('مراجعة جودة العرض');
		for (const banned of ['messageClarity', 'profileMatch', 'topPercentage', 'التنافسية', 'acceptanceOdds', 'تقييم AI للعرض']) {
			expect(applyStep4Html).not.toContain(banned);
		}
	});
});

describe('AI Cleanup Batch 2 — company-mode provider pages', () => {
	it('incoming-requests: no mock requests, team members, AI match or local-only assign', () => {
		for (const src of [incomingHtml, incomingTs]) {
			expect(src).not.toContain('سارة الزهراني');
			expect(src).not.toContain('RQ-001');
			expect(src).not.toContain('aiMatch');
			expect(src).not.toContain('doAssign');
		}
		expect(incomingHtml).toContain('na-card');
	});

	it('change-orders: no mock orders, KPIs or "AI:" notes', () => {
		for (const src of [changeOrdersHtml, changeOrdersTs]) {
			expect(src).not.toContain('CO-001');
			expect(src).not.toContain('aiNote');
			expect(src).not.toContain('23,500');
		}
		expect(changeOrdersHtml).toContain('na-card');
	});

	it('sales-stats: no mock revenue, funnel, conversion or per-member performance', () => {
		for (const src of [salesStatsHtml, salesStatsTs]) {
			expect(src).not.toContain('87,400');
			expect(src).not.toContain('38%');
			expect(src).not.toContain('teamPerf');
			expect(src).not.toContain('funnel');
		}
		expect(salesStatsHtml).toContain('na-card');
	});

	it('market (company mode): KPIs bound to real stats; fixed numbers and fake member filter removed', () => {
		for (const v of ['>12<', '2,841', '↑ 22%', '>94<', '>58<', '36٪']) {
			expect(marketHtml).not.toContain(v);
		}
		expect(marketHtml).toContain('stats().totalModels');
		expect(marketHtml).toContain('stats().totalViews');
		expect(marketHtml).not.toContain('companyMembers');
		expect(marketTs).not.toContain("name: 'سارة'");
	});

	it('reports: no fixed "acceptance rate up 12%" AI recommendation', () => {
		expect(reportsHtml).not.toContain('ارتفع 12%');
		expect(reportsHtml).not.toContain('5k–20k');
	});
});

describe('AI Cleanup Batch 2 — single score not shown as six independent metrics', () => {
	it('accreditation-details: aiScore shown once, no six-bar fake breakdown', () => {
		const repeats = accreditationHtml.split('sampleDetails()?.aiScore || 0 }}%').length - 1;
		expect(repeats).toBe(0);
		for (const label of ['جودة التنفيذ', 'أصالة العمل', 'توافق مع السوق', 'دقة التفاصيل', 'ملاءمة التخصص', 'إثبات الملكية']) {
			expect(accreditationHtml).not.toContain(label);
		}
		expect(accreditationHtml).toContain("sampleDetails()?.aiScore || '-'");
	});

	it('marketer profile: no hardcoded "LinkedIn raises commissions by 32%" AI claim', () => {
		expect(marketerDataHtml).not.toContain('32%');
		expect(marketerDataHtml).not.toContain('useAiChannelSuggestion');
		expect(marketerDataTs).not.toContain('useAiChannelSuggestion');
	});
});

describe('AI Cleanup Batch 2 — no hardcoded AI accuracy badges', () => {
	const appRoot = join(process.cwd(), 'src/app');
	const htmlFiles = htmlFilesUnder;

	it('no template shows a literal "دقة NN%" badge', () => {
		const offenders = htmlFiles(appRoot).filter((f) => /دقة\s*\d+(\.\d+)?\s*%/.test(readFileSync(f, 'utf8')));
		expect(offenders).toEqual([]);
	});
});

describe('AI Cleanup Batch 2 — no locally computed AI confidence/review claims', () => {
	const setupHtml = readSrc('provider-overview/profile/profile-setup/profile-setup.html');
	const setupTs = readSrc('provider-overview/profile/profile-setup/profile-setup.ts');

	it('setup test result shows no AI confidence, no AI-review promise, and labels the level by score', () => {
		expect(setupHtml).not.toContain('ثقة AI');
		expect(setupHtml).not.toContain('سيراجع نتيجتك');
		expect(setupHtml).not.toContain('testAiConfidence');
		expect(setupHtml).not.toContain('testNeedsAdminReview');
		expect(setupTs).not.toContain('testAiConfidence');
		expect(setupTs).not.toContain('testNeedsAdminReview');
		expect(setupHtml).toContain('مستوى حسب الدرجة');
		expect(setupHtml).toContain('بناءً على درجتك، يظهر مستواك كمقدم خدمة');
		expect(setupHtml).not.toContain('مراجعة AI');
	});

	it('setup flow never says AI classifies/approves/reviews the provider', () => {
		expect(setupHtml).not.toMatch(/(AI|الذكاء)[^<{]{0,25}(صنفك|يصنفك|سيصنفك|يصنّفك|تصنيف|اعتماد|مراجعة)/);
	});

	it('no template says AI classified the user', () => {
		const offenders = htmlFilesUnder(join(process.cwd(), 'src/app')).filter((f) => /(AI|الذكاء)\s*(صنفك|صنّفك|يصنفك|سيصنفك)/.test(readFileSync(f, 'utf8')));
		expect(offenders).toEqual([]);
	});

	it('no template shows an "AI confidence" label', () => {
		const offenders = htmlFilesUnder(join(process.cwd(), 'src/app')).filter((f) => /(ثقة|دقة)\s*(AI|الذكاء)/.test(readFileSync(f, 'utf8')));
		expect(offenders).toEqual([]);
	});
});

describe('AI Cleanup Batch 2 — bio suggestion stays disabled while the backend answers AI_FEATURE_UNAVAILABLE', () => {
	const setupHtml = readSrc('provider-overview/profile/profile-setup/profile-setup.html');
	const setupTs = readSrc('provider-overview/profile/profile-setup/profile-setup.ts');
	const profileSvc = readFileSync(join(process.cwd(), 'src/app/core/services/provider-profile.service.ts'), 'utf8');

	it('the bio AI button is disabled, has no click handler and says it is unavailable', () => {
		const btn = /<button[^>]*data-testid="bio-suggest-disabled"[^>]*>/.exec(setupHtml)?.[0] ?? '';
		expect(btn).toContain(' disabled');
		expect(btn).not.toContain('(click)');
		expect(setupHtml).toContain('اقتراح النبذة غير متاح حاليًا');
	});

	it('nothing in the profile setup page or service can call suggest-bio', () => {
		for (const src of [setupHtml, setupTs, profileSvc]) {
			expect(src).not.toContain('suggest-bio');
			expect(src).not.toContain('suggestBio');
			expect(src).not.toContain('applyBioSuggestion');
		}
		expect(setupHtml).not.toContain('bio-preview');
	});
});

describe('AI Cleanup Batch 2 — proposal AI suggest requires title and message together', () => {
	it('apply page uses the shared check and no longer accepts a single field', () => {
		expect(applyTs).toContain('aiSuggestInputError(current.title, current.message)');
		expect(applyTs).not.toContain('أو نصه أولاً');
		expect(applyTs).not.toMatch(/!current\.title\?\.trim\(\) && !current\.message\?\.trim\(\)/);
	});
});
