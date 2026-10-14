import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Area X static guard (companion of the machine scan): marketer-overview must stay free of mock / fake / demo data, dead links, constant presence flags and compliance
// badges; shared layouts / footer / website pages must not carry dead javascript:void links or a constant `online: true`; supper-admin-overview is on a RATCHET (the
// count of each offender may only go down, so the admin workers can remove them but nobody can add new ones). Comment-only text is ignored; specs are not scanned.
const APP = join(__dirname, '..', '..');
const walk = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap(e => {
		const p = join(dir, e.name);
		return e.isDirectory() ? walk(p) : /\.(ts|html)$/.test(e.name) && !/\.spec\.ts$/.test(e.name) ? [p] : [];
	});
const code = (file: string): string => {
	let t = readFileSync(file, 'utf8');
	t = t.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
	return t.split('\n').map(l => (/^\s*\/\//.test(l) ? '' : l)).join('\n');
};
const hits = (dir: string, re: RegExp): string[] =>
	walk(join(APP, dir)).flatMap(f => code(f).split('\n').map((l, i) => (re.test(l) ? `${relative(APP, f)}:${i + 1}` : '')).filter(Boolean));

const MOCK = /\b(mock|mocked|fake|demo|dummy|lorem)[A-Za-z_]*|\bsample(Data|Rows|Items|List)\b/i;
const DEAD_LINK = /href="#"|javascript:void/;
const ONLINE_CONST = /\bonline:\s*true\b/;
const COMPLIANCE = /\b(SAMA|PDPL|VAT)\b|ضريبة/;

describe('marketer-overview has no mock data, dead links, constant presence or compliance claims', () => {
	const dir = 'pages/dashboard/marketer-overview';
	it('no mock / fake / demo identifiers', () => expect(hits(dir, MOCK)).toEqual([]));
	it('no href="#" / javascript:void links', () => expect(hits(dir, DEAD_LINK)).toEqual([]));
	it('no constant `online: true`', () => expect(hits(dir, ONLINE_CONST)).toEqual([]));
	it('no SAMA / PDPL / VAT / ضريبة claim', () => expect(hits(dir, COMPLIANCE)).toEqual([]));
	it('no static *.data.ts module feeds the marketer pages', () => {
		expect(walk(join(APP, dir)).filter(f => /\.data\.ts$/.test(f)).map(f => relative(APP, f))).toEqual([]);
	});
});

describe('shared layouts, footer and website pages', () => {
	const dirs = ['layouts', 'sheards', 'shared', 'core', 'pages/website'];
	it('no javascript:void / href="#" dead links', () => expect(dirs.flatMap(d => hits(d, DEAD_LINK))).toEqual([]));
	it('no constant `online: true` presence flag', () => expect(dirs.flatMap(d => hits(d, ONLINE_CONST))).toEqual([]));
	it('the footer carries no SAMA / PDPL compliance badge', () => {
		expect(hits('sheards/footer', /footer-badge/)).toEqual([]);
	});
});

describe('supper-admin-overview ratchet (counts may only go down)', () => {
	const dir = 'pages/dashboard/supper-admin-overview';
	// Baseline measured on origin/main when this spec was written. When an admin worker removes offenders, lower the number; never raise it.
	it('constant `online: true` presence flags', () => expect(hits(dir, ONLINE_CONST).length).toBeLessThanOrEqual(8));
	it('href="#" / javascript:void dead links', () => expect(hits(dir, DEAD_LINK).length).toBeLessThanOrEqual(7));
	it('mock / fake / demo identifiers', () => expect(hits(dir, MOCK).length).toBeLessThanOrEqual(3));
});
