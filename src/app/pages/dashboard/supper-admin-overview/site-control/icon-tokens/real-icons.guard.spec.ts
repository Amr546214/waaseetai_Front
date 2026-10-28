/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The library draws the REAL symbols the site ships. public/assets/site-control/real-icons.json is generated from the templates (tools/icon-real-library.cjs); this guard fails when a template
// symbol changes (or one is added) without regenerating, and cross-checks every sha256 against the BE allow-list when ../wt-be-id is present.
const ROOT = join(__dirname, '../../../../../../../');
const require_ = createRequire(join(ROOT, 'package.json'));
describe('real icons file vs the templates', () => {
	it('is up to date with the symbols in the templates (run: node tools/icon-real-library.cjs --write)', () => {
		const built = require_('./tools/icon-real-library.cjs').build();
		const saved = JSON.parse(readFileSync(join(ROOT, 'public/assets/site-control/real-icons.json'), 'utf8'));
		expect(JSON.stringify(saved)).toBe(JSON.stringify(built));
	});
	it('contains the notifications icon and every bell key of the family, each with a drawing', () => {
		const saved = JSON.parse(readFileSync(join(ROOT, 'public/assets/site-control/real-icons.json'), 'utf8')).icons;
		for (const id of ['i-bell', 'ws-bell', 'hwp-bell', 'ic-bell', 'td-pending-bell', 'pf-pro-data-bell', 'ss-alert-bell', 'su-stat-bell']) expect(saved[id]?.inner, id).toContain('<path');
	});
	const BE = join(ROOT, '..', 'wt-be-id', 'src', 'config', 'site-identity-icon-allowlist.generated.json');
	(existsSync(BE) ? it : it.skip)('every BE allow-list symbol has its real drawing here with the SAME sha256', () => {
		const be = JSON.parse(readFileSync(BE, 'utf8')) as { symbols: { id: string; sha256: string }[] };
		const saved = JSON.parse(readFileSync(join(ROOT, 'public/assets/site-control/real-icons.json'), 'utf8')).icons as Record<string, { sha256: string }>;
		const bad = be.symbols.filter(s => saved[s.id]?.sha256 !== s.sha256).map(s => s.id);
		expect(bad).toEqual([]);
	});
});
