import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A stored score is a quality score, not an "AI approval" or an "AI match": the shared card and the cart/review pages must keep the
// "درجة جودة مسجّلة" wording (the stored score is not presented as an AI output).
const FILES: Record<string, RegExp[]> = {
	'sheards/card/card.html': [/AI Match/, /معتمد AI/, /معتمدة من Waseet AI/],
	'pages/website/checkout/cart/cart.html': [/>\s*AI \{\{ item\.aiScore/, /\s{2,}AI \{\{ item\.aiScore \}\}/],
	'pages/website/checkout/review/review.html': [/<\/svg> AI \{\{ item\.aiScore/],
};

describe('no AI over-claims in the shared card / cart / review', () => {
	for (const [file, forbidden] of Object.entries(FILES)) {
		it(`${file} says "درجة جودة مسجّلة" for a stored score`, () => {
			const text = readFileSync(join(process.cwd(), 'src', 'app', file), 'utf8');
			for (const re of forbidden) expect(text).not.toMatch(re);
		});
	}
	it('cart and review show "درجة جودة مسجّلة {{ item.aiScore }}"', () => {
		for (const f of ['pages/website/checkout/cart/cart.html', 'pages/website/checkout/review/review.html']) {
			expect(readFileSync(join(process.cwd(), 'src', 'app', f), 'utf8')).toContain('درجة جودة مسجّلة {{ item.aiScore }}');
		}
	});
});
