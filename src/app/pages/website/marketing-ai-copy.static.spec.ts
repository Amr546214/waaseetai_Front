/// <reference types="node" />

// Marketing/static pages must not present the deterministic provider-level / commission-tier system
// (points + completed projects + client rating, see backend progression-calculators) as an AI-computed
// "Trust Score", nor claim AI rates providers or brings offers. Static template/data scan, no TestBed.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf-8');

const FILES = [
	'pricing/pricing.html', 'pricing/pricing.ts',
	'legal/legal-page.component.ts',
	'how-it-works/how-it-works.ts', 'how-it-works/provider/provider.html', 'how-it-works/client/client.html', 'how-it-works/marketer/marketer.html',
	'blog/blog.html', 'blog/blog.ts', 'blog/blog-data.ts', 'blog/article/article.html',
	'press/press.html', 'home/components/marketplace-preview/marketplace-preview.html', 'about/about.html', 'partners/partners.html',
];

const FORBIDDEN: Array<[string, RegExp]> = [
	['AI Trust / Trust Score', /AI\s*Trust|Trust\s*Score/i],
	['"جودة التحليل" as an AI claim', /جودة التحليل/],
	['"تقييم AI لجودة المقدمين"', /تقييم AI لجودة المقدمين/],
	['AI calculating the level/score', /(الذكاء الاصطناعي|AI)\s*يحسب/],
	['AI judging provider performance', /حكم(اً)? شامل من الذكاء الاصطناعي|يقيّم أداء كل مقدم|يحلل AI عشرات المعايير|الذكاء الاصطناعي يحلل أداء/],
	['AI bringing offers', /يقترح AI لها عروض|يطابق(ك)? AI|AI يطابق/],
	['static "AI · نشط" badge', /AI · نشط/],
	['unproven "best match for every request" claim', /اقتراح الأنسب لكل طلب/],
	['fake AI accreditation engine label', /محرك الاعتماد الذكي/],
];

describe('marketing/static AI copy stays truthful', () => {
	for (const f of FILES) {
		it(`${f} has no misleading AI claims`, () => {
			const src = read(f);
			for (const [label, re] of FORBIDDEN) expect(re.test(src), `${f}: ${label}`).toBe(false);
		});
	}

	it('pricing/legal/how-it-works describe the level system as automatic, from points/projects/ratings', () => {
		expect(read('pricing/pricing.html')).toContain('المستوى يُحسب تلقائياً');
		expect(read('legal/legal-page.component.ts')).toContain('يحسب النظام مستوى المقدم تلقائياً');
		for (const r of ['provider', 'client', 'marketer']) {
			const s = read(`how-it-works/${r}/${r}.html`);
			expect(s).toContain('مستوى المقدم');
		}
	});

	it('the about page only promises AI recommendations conditionally', () => {
		expect(read('about/about.html')).toContain('توصيات مساعدة عند توفر مصدر AI موثوق');
	});

	it('the how-it-works client page only promises AI suggestions conditionally', () => {
		expect(read('how-it-works/client/client.html')).toContain('قد يقترح AI');
	});
});
