import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Marketplace + service pages: an AI wording must be backed by the backend.
//   real:  ServiceCatalog.aiScore = the WaseetAI business-model audit score (labelled "جودة AI"); aiReviewSummary = its summary;
//          Gemini recommendations (generationSource GEMINI) with aiMatchPercentage; provider performance summary (WaseetAI);
//          specialty assessment score (WaseetAI-graded test).
//   not:   a "match" for a deterministic list, "approved by AI", an always-on "AI · نشط", an AI that "brings you offers",
//          an "AI Trust Score" name for the specialty assessment score, a score shown as 0% when nothing was audited.
const WEB = join(process.cwd(), 'src', 'app', 'pages', 'website');
const FILES = [
	'marketplace/marketplace.html', 'marketplace/slug/slug.html', 'marketplace/offer/offer.html',
	'marketplace/provider-profile/provider-profile.html', 'marketplace/compare-services/compare-services.html',
	'marketplace/compare-providers/compare-providers.html', 'marketplace/curated/curated.html',
	'marketplace/favorites/favorites.html', 'marketplace/category-guide/category-guide.html',
	'checkout/cart/cart.html', 'checkout/review/review.html', 'checkout/custom-request/custom-request.html',
];
const read = (f: string) => readFileSync(join(WEB, f), 'utf8');
const all = () => FILES.map(read).join('\n');

const FORBIDDEN: [string, RegExp][] = [
	['"AI Match"', /AI Match/],
	['"معتمد AI"', /معتمد AI/],
	['"AI Trust" (the specialty assessment score is not a trust score)', /AI Trust/],
	['"توصية AI" label on the audit summary', /توصية AI:/],
	['"تحليل الذكاء الاصطناعي للخدمة" (it is an audit score)', /تحليل الذكاء الاصطناعي للخدمة/],
	['"جودة التحليل"', /جودة التحليل/],
	['"نقاط AI"', /نقاط AI/],
	['"تقييم AI لجودة المقدمين"', /تقييم AI لجودة المقدمين/],
	['"الأعلى في تقييم AI"', /الأعلى في تقييم AI/],
	['AI bringing offers', /الذكاء الاصطناعي أفضل العروض|والذكاء يجلب لك العروض/],
	['"ذكي · نشط" for a non-Gemini list', /ذكي · نشط/],
	['"AI · ..." claim on a provider while fetching data', /تحليل وتقييم مستوى الأداء باستخدام AI/],
	['a bare "AI {{ ...aiScore }}" badge (must say جودة AI)', /(?<!جودة )AI \{\{\s*(?:m|srv|slot\.model|model|item)\.aiScore/],
	['an unscored service shown as 0%', /aiScore \?\? 0/],
];

describe('marketplace / service pages: AI wording is truthful', () => {
	for (const [name, re] of FORBIDDEN) {
		it(`does not contain ${name}`, () => {
			expect(all()).not.toMatch(re);
		});
	}

	it('"AI · نشط" appears only behind a Gemini check or a real stored value, never as a static badge', () => {
		for (const f of FILES) {
			const lines = read(f).split('\n');
			lines.forEach((line, i) => {
				if (!line.includes('AI · نشط')) return;
				expect(line, `${f}:${i + 1}`).toMatch(/GEMINI|executionQuality != null|aiScore/);
			});
		}
	});

	it('the offer page labels the stored score "جودة AI" / "تقييم AI" and shows the stored summary only when it exists', () => {
		const t = read('marketplace/offer/offer.html');
		expect(t).toContain('تقييم AI الاسترشادي للخدمة');
		expect(t).toContain('جودة AI');
		expect(t).toContain('ملخص التقييم الاسترشادي (AI):');
		expect(t).toContain('@if (model()?.aiRecommendationReason)');
		expect(t).toContain('لم تخضع هذه الخدمة لتقييم AI الاسترشادي بعد');
		// the backend returns null (never 0) for a missing audit, so a score / sub-score is shown whenever it is a real number (0 included)
		expect(t).toContain("@if (model()?.aiClarityScore != null)");
		expect(t).toContain("@if (model()?.aiFeasibilityScore != null)");
		expect(t).not.toContain("@if (model()?.aiScore) {");
	});

	it('the provider page names the specialty score "درجة تقييم التخصص" and the performance block only claims AI when a summary exists', () => {
		const t = read('marketplace/provider-profile/provider-profile.html');
		expect(t).toContain('درجة تقييم التخصص');
		expect(t).toContain('ملخص أداء المقدم بالذكاء الاصطناعي');
		expect(t).toContain("executionQuality != null ? 'ملخص AI من سجل المشاريع' : 'غير متاح حاليًا'");
	});

	it('the marketplace keeps the Gemini-only match / title / badge conditions', () => {
		const t = read('marketplace/marketplace.html');
		expect(t).toContain("aiGenerationSource() === 'GEMINI' ? 'اختيارات الذكاء الاصطناعي' : 'الأكثر مشاهدة'");
		expect(t).toContain("aiGenerationSource() === 'GEMINI' ? 'AI · نشط' : 'دون AI'");
		expect(t).toContain("model.aiMatchPercentage ? 'تطابق AI' : 'جودة AI'");
		const c = read('checkout/cart/cart.html');
		expect(c).toContain("aiGenerationSource() === 'GEMINI' && rec.aiMatchPercentage");
	});
});
