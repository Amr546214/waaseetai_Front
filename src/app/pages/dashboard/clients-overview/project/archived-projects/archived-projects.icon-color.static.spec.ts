/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Purple (.pl-ic-ai) is reserved for AI / وسيط elements. The archive's "إجمالي المنتهية" total is plain data: neutral blue-grey, readable in
// dark and light (the colour follows --txt-3). The other three cards keep their status colours.
const read = (f: string) => readFileSync(join(__dirname, f), 'utf-8');

describe('archived projects KPI icon colours', () => {
	it('"إجمالي المنتهية" is not purple; the other cards are unchanged', () => {
		const ts = read('archived-projects.ts');
		expect(ts).toContain("label: 'إجمالي المنتهية', color: 'slate'");
		expect(ts).not.toMatch(/إجمالي المنتهية[^}]*color: 'ai'/);
		expect(ts).toContain("label: 'مكتملة', color: 'teal'");
		expect(ts).toContain("label: 'ملغاة', color: 'amber'");
		expect(ts).toContain("label: 'مؤرشفة', color: 'blue'");
	});
	it('the slate icon style exists and follows the theme text colour; the AI purple rule is untouched', () => {
		const css = read('archived-projects.css');
		expect(css).toMatch(/\.pl-ic-slate\s*\{[^}]*color:\s*var\(--txt-3/);
		expect(css).not.toMatch(/\.pl-ic-slate\s*\{[^}]*(123,\s*47,\s*190|A56BE0)/);
		expect(css).toMatch(/\.pl-ic-ai\s*\{[^}]*123,47,190/);
	});
});
