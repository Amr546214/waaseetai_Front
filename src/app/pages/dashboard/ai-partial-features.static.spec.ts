/// <reference types="node" />

// Partial-AI features must show only what the backend really returns (see the code audit of AI.pdf / AI2.pdf):
//  #4  project analysis: recommendedImprovements=[] and suggestedPricingStrategy=null always
//  #11 proposal audit: only overallScore (+ badge) is real; acceptanceOdds is the fixed 'غير مدعوم'
//  #12 proposal score = 0.6 × WaseetAI text quality + 0.4 × budget closeness; aiPriceTag/fairPrice are null
//  #16 performance metrics: nullable (no `|| 0` percentages), 5-star-review rate, not stored (1h in-memory cache)
//  #22/#23 service audit: advisory, manual, rare; most services have aiScore=null
// Static template scan, no TestBed.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf-8');

const step5 = 'pages/dashboard/provider-overview/business-models/new-project/components/step5-evaluation/step5-evaluation.component.html';
const applyTs = 'pages/dashboard/provider-overview/explore-requests/applay-request/applay-request.ts';
const applyStep3 = 'pages/dashboard/provider-overview/explore-requests/applay-request/components/step3-review/step3-review.html';
const applyStep4 = 'pages/dashboard/provider-overview/explore-requests/applay-request/components/step4-success/step4-success.html';
const reqDetails = 'pages/dashboard/clients-overview/my-request/request-details/request-details.html';
const profile = 'pages/website/marketplace/provider-profile/provider-profile.html';
const publicProfile = 'pages/dashboard/provider-overview/profile/public/public.html';
const card = 'sheards/card/card.html';
const offer = 'pages/website/marketplace/offer/offer.html';
const market = 'pages/dashboard/provider-overview/business-models/market/market.html';
const about = 'pages/website/about/about.html';
const joinProvider = 'pages/website/support/join-provider/join-provider.component.html';
const setup = 'pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html';

describe('partial AI features show only what the backend returns', () => {
	it('#4 step5 evaluation makes no pricing/market claims and hides empty milestone sections', () => {
		const t = read(step5);
		expect(t).not.toContain('تحسينات على التسعير');
		expect(t).not.toContain('بمعطيات السوق');
		expect(t).not.toContain('تحليل السعر والمراحل المقترحة');
		expect(t).toContain('@if (eval.suggestedPricingStrategy || eval.suggestedMilestones?.length)');
		expect(t).toContain('@if (eval.recommendedImprovements && eval.recommendedImprovements.length > 0)');
		expect(t.match(/@if \(eval\.suggestedMilestones\?\.length\)/g)?.length).toBeGreaterThanOrEqual(3);
	});

	it('#11 apply flow models and shows only the score + badge (no acceptance odds / compatibility / extra metrics)', () => {
		const ts = read(applyTs);
		for (const dead of ['acceptanceOdds', 'profileMatch', 'messageClarity', 'priceCompetitiveness', 'timelineFeasibility', 'completeness', 'compatibilityScore'])
			expect(ts, dead).not.toContain(dead);
		for (const f of [applyStep3, applyStep4])
			for (const banned of ['acceptanceOdds', 'compatibilityScore', 'احتمال القبول', 'finalMetrics.profileMatch'])
				expect(read(f), `${f}: ${banned}`).not.toContain(banned);
	});

	it('#12 offers: no market-comparison claim, no price/duration placeholders, verdict only when it exists', () => {
		const t = read(reqDetails);
		expect(t).not.toContain('مقارنة بالسوق');
		expect(t).not.toContain('تحليل الذكاء للسعر والمدة العادلين');
		expect(t).toContain('وسيط AI، تقييم جودة العروض');
		expect(t).toContain('@if (offer.aiAnalysis.verdict)');
		expect(t).not.toContain("offer.aiAnalysis.verdict || 'غير متاح'");
		expect(t).toContain('@if (offer.aiAnalysis.fairPrice || offer.aiAnalysis.priceNote)');
		expect(t).not.toMatch(/تطابق AI|توافق AI/);
	});

	it('#16 performance metrics are null-aware, labelled for the real field, and not called "recorded"', () => {
		const t = read(profile);
		expect(t).not.toMatch(/aiMetrics\?\.\w+ \|\| 0 \}\}/);
		expect(t).toContain('نسبة التقييمات بخمس نجوم');
		expect(t).not.toContain('نسبة الخدمات فوق 4.8 نجمة');
		expect(t).not.toContain('AI · ملخص مسجّل');
		expect(t).toContain("'غير متاح'");
		const p = read(publicProfile);
		expect(p).not.toContain('تدقيق تلقائي بالذكاء الاصطناعي');
		expect(p).not.toContain('(كفاءة خبير)');
		expect(p).not.toMatch(/averageTestScore \|\| 0|codeMatchingIndex \|\| 0/);
	});

	it('#22/#23 service-audit wording is advisory and conditional', () => {
		const c = read(card);
		expect(c).not.toContain('model.aiScore ?? 0');
		expect(c.match(/@if \(model\.aiScore\)/g)?.length).toBe(2);
		const o = read(offer);
		expect(o).not.toContain('تدقيق الذكاء الاصطناعي للخدمة');
		expect(o).not.toContain('ملخص تدقيق AI');
		expect(o).toContain('تقييم AI الاسترشادي للخدمة');
		expect(read(market)).not.toContain('ونتيجة التدقيق الآلي لكل نموذج');
		expect(read(about)).not.toContain('من تدقيق الخدمات');
		const j = read(joinProvider);
		expect(j).not.toContain('يساعدك في التسعير');
		expect(j).toContain('صياغة عروضك واقتراح مراحل التسليم');
	});

	it('setup-test info card does not show an invented 10 questions / 10 minutes', () => {
		const t = read(setup);
		expect(t).not.toContain("totalQuestions() || 10");
		expect(t).not.toContain('testTotalTime / 60 : 10');
	});
});
