import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Owner end-to-end findings: no invented project data, no money float artifacts, no amendment shown as applied. Source scan; specs are not scanned.
const ROOT = join(__dirname, '..');
function sources(dir: string): { file: string; text: string }[] {
	const out: { file: string; text: string }[] = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) out.push(...sources(p));
		else if (/\.(html|ts)$/.test(e.name) && !/\.spec\.ts$/.test(e.name)) out.push({ file: p.replace(ROOT, ''), text: readFileSync(p, 'utf-8') });
	}
	return out;
}
const all = sources(ROOT);
const find = (needle: string | RegExp, allow: RegExp = /$^/) => all.filter(f => !allow.test(f.file) && (typeof needle === 'string' ? f.text.includes(needle) : needle.test(f.text))).map(f => f.file);

describe('no fabricated project data in production source', () => {
	for (const s of ['Adobe Illustrator', '3+ سنوات خبرة', 'تسليم المشروع النهائي', 'لم تُجهَّز مراحل المشروع']) {
		it(`"${s}" is not a fallback anywhere`, () => expect(find(s)).toEqual([]));
	}
	it('"شعار بصيغ متعددة" is not a fallback (the press kit list item "الشعار بصيغ متعددة" is marketing copy, not project data)', () => {
		expect(find(/(?<!ال)شعار بصيغ متعددة/)).toEqual([]);
	});
	it('the apply-request page has no invented outputs, budget range or duration', () => {
		const html = all.find(f => f.file.endsWith('applay-request/applay-request.html'))!.text;
		expect(html).not.toContain('3,000–5,000');
		expect(html).not.toMatch(/deliveryDays \|\| 30/);
		expect(html).toContain('لم تُحدَّد المخرجات');
	});
	it('the admin request detail has honest empty states for requirements and outputs', () => {
		const html = all.find(f => f.file.endsWith('sa-request-detail/sa-request-detail.html'))!.text;
		expect(html).toContain('لم يحدد العميل متطلبات بعد');
		expect(html).toContain('لم تُحدَّد المخرجات');
	});
});

describe('money is displayed with at most 2 decimals', () => {
	it('no bare `| number` (default 1.0-3) and no 3+ fraction digits in a template', () => {
		const bad = all.filter(f => f.file.endsWith('.html') && (/\|\s*number(?!\s*:)/.test(f.text) || /number\s*:\s*'\d\.\d-([3-9])'/.test(f.text))).map(f => f.file);
		expect(bad).toEqual([]);
	});
	it('no `.toLocaleString(` / Intl.NumberFormat on amounts outside the shared money util', () => {
		const bad = all.filter(f => !f.file.endsWith('money.util.ts') && /\.toLocaleString\((\s*'en-US'\s*)?\)|new Intl\.NumberFormat\('(en-US|ar-SA)', \{ minimumFractionDigits: \d, maximumFractionDigits: 2/.test(f.text)
			&& !/category-guide/.test(f.file)).map(f => f.file);
		expect(bad).toEqual([]);
	});
});

describe('amendments are never presented as applied', () => {
	it('no applied/executed wording on the amendment surfaces', () => {
		const files = ['project-modifications.component.html', 'project-modifications.component.ts', 'project-details.html', 'progress.html', 'sa-contract-detail.html', 'sa-project-detail.html'];
		for (const f of all.filter(x => files.some(n => x.file.endsWith('/' + n)))) {
			const lines = f.text.split('\n').filter(l => /amend|am-|تعديل|dp-/i.test(l));
			expect(lines.filter(l => /تم التنفيذ|نافذ|تم تطبيق|طُبِّق/.test(l)), f.file).toEqual([]);
		}
	});
	it('every amendment surface shows the shared effect note', () => {
		for (const n of ['project-modifications.component.html', 'project-details.html', 'sa-contract-detail.html', 'sa-project-detail.html']) {
			expect(all.find(x => x.file.endsWith('/' + n))!.text, n).toContain('effect-note');
		}
		expect(all.find(x => x.file.endsWith('/progress.html') && x.file.includes('provider-overview/projects/active/progress'))!.text).toContain('amend-effect-note');
	});
});
