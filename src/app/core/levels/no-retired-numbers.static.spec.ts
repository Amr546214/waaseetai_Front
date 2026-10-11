import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The official tables are ONLY the two workbooks (نظام النقاط و الولاء.xlsx, نسب الدفع.xlsx). The retired numbers must not come back anywhere in the UI source:
// the 3%-18% marketer table, the old provider 5%..1% commission ladder, and the invented admin figures (10% deal fee, 2% cashback).
const root = join(__dirname, '..', '..');
const walk = (d: string, out: string[] = []): string[] => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };
const sources = walk(root).filter(f => /\.(ts|html)$/.test(f) && !/\.spec\.ts$/.test(f));

describe('no retired level / fee numbers in the UI source', () => {
	it('the marketer 3%-18% table is gone', () => {
		for (const f of sources) {
			const t = readFileSync(f, 'utf8');
			expect(/3–18|18٪|حتى 18٪|comm: '3٪'|comm: '10٪'/.test(t), `${f}`).toBe(false);
		}
	});
	it('no typed provider commission / cashback / deal-fee figures (they come from GET /levels)', () => {
		for (const f of sources) {
			const t = readFileSync(f, 'utf8');
			expect(/عمولة المنصة\s*5%|عمولة مستواك 5%|رسوم إتمام الصفقة[^\n]{0,40}10%|نسبة الكاش باك[^\n]{0,30}2%|كاش باك 3%|كاش باك 5%|عمولة 8% على المستوى 1/.test(t), `${f}`).toBe(false);
		}
	});
	it('no UI file carries its own level table (names + percentages are served by the backend)', () => {
		const offenders = sources.filter(f => /مسوق[\s\S]{0,200}مساعد[\s\S]{0,200}موصل[\s\S]{0,200}منسق/.test(readFileSync(f, 'utf8')) && !f.endsWith('help.html'));
		expect(offenders).toEqual([]);
	});
});
