import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// STATIC GUARD: skills / sub-specialties come from ONE backend source (the skills catalog). Production .ts/.html files must not carry
// hardcoded skill-name lists or the old «تطوير وتصميم» fallback as visible text.
const ROOT = join(process.cwd(), 'src', 'app');
// Not a skills source: a job-title keyword matcher that filters team members by their free-text jobTitle (no catalog involved).
const ALLOWED = ['pages/dashboard/provider-overview/company/team-management/team-management.component.ts'];
const KNOWN_SKILLS = ['react', 'figma', 'seo', 'photoshop', 'illustrator', 'adobe xd', 'angular', 'vue', 'node.js', 'python', 'javascript', 'typescript', 'wordpress', 'laravel', 'flutter', 'excel', 'sketch'];

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
	}
	return out;
}
const isProduction = (f: string) => /\.(ts|html)$/.test(f) && !/\.(spec|test)\.ts$/.test(f) && !/(^|\/)(fixtures?|testing|__mocks__)\//.test(f);
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '');

describe('skills single-source static guard', () => {
	const files = walk(ROOT).filter(isProduction);
	const allowed = (f: string) => ALLOWED.some(a => f.endsWith(a));

	it('scans a real set of production files', () => {
		expect(files.length).toBeGreaterThan(100);
	});

	it('no production file has an array literal listing known skill names', () => {
		const offenders: string[] = [];
		const arrayLiteral = /\[([^\[\]]{0,600})\]/g;
		for (const f of files.filter(x => !allowed(x))) {
			const src = strip(readFileSync(f, 'utf8'));
			for (const m of src.matchAll(arrayLiteral)) {
				const items = Array.from(m[1].matchAll(/(['"`])((?:(?!\1).)+)\1/g)).map(x => x[2].trim().toLowerCase());
				if (items.length < 2) continue;
				const hits = items.filter(i => KNOWN_SKILLS.includes(i));
				if (hits.length >= 2) offenders.push(`${f.replace(ROOT, 'src/app')}: ${m[0].slice(0, 80)}`);
			}
		}
		expect(offenders).toEqual([]);
	});

	it('the fallback text «تطوير وتصميم» is not a user-visible fallback anywhere', () => {
		const offenders = files.filter(f => readFileSync(f, 'utf8').includes('تطوير وتصميم')).map(f => f.replace(ROOT, 'src/app'));
		expect(offenders).toEqual([]);
	});

	it('the old free-text skill defaults are gone from the add-account base', () => {
		const base = readFileSync(join(ROOT, 'shared/add-account/add-account.base.ts'), 'utf8');
		expect(base).not.toMatch(/skills\s*=\s*signal<string\[\]>\(\[\s*['"]/);
	});
});
