/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FE_WIRED_KEYS, IDENTITY_DEFAULTS } from './identity-defaults';

// the server registry lives in a sibling worktree of this one (wta/wt-be-id) or, in the coordinator's layout, next to the FE checkout
const CANDIDATES = [
	join(process.cwd(), '../wt-be-id/src/config/site-identity.registry.ts'),
	join(process.cwd(), '../sc-be-team/src/config/site-identity.registry.ts'),
	join(process.cwd(), '../../wt-be-id/src/config/site-identity.registry.ts'),
];
const REG = CANDIDATES.find(existsSync);

describe('identity defaults mirror the server registry', () => {
	it('every FE-wired key is a key of the defaults map', () => {
		for (const k of FE_WIRED_KEYS) expect(IDENTITY_DEFAULTS[k], k).toBeDefined();
	});

	it.skipIf(!REG)('same keys and same default asset (file path / inline symbol id) as BE src/config/site-identity.registry.ts', () => {
		const src = readFileSync(REG!, 'utf8');
		const be: Record<string, string> = {};
		// one block per `key: '...'` up to the next one; the block's defaultAsset (or the atlas() helper's `file`) is the default
		const starts = [...src.matchAll(/key:\s*'([a-z0-9._-]+)'/g)];
		starts.forEach((m, i) => {
			const block = src.slice(m.index!, i + 1 < starts.length ? starts[i + 1].index! : src.length);
			const f = /defaultAsset:\s*\{\s*type:\s*'file',\s*path:\s*'([^']+)'/.exec(block) ?? /\bfile:\s*'([^']+)'/.exec(block);
			const sy = /defaultAsset:\s*\{\s*type:\s*'inline-symbol',\s*symbolId:\s*'([^']+)'/.exec(block);
			if (sy) be[m[1]] = `inline-symbol:${sy[1]}`; else if (f) be[m[1]] = `file:${f[1]}`;
		});
		const fe: Record<string, string> = {};
		for (const [k, d] of Object.entries(IDENTITY_DEFAULTS)) fe[k] = d.type === 'file' ? `file:${d.path}` : `inline-symbol:${d.symbolId}`;
		expect(Object.keys(be).length).toBeGreaterThan(5);
		expect(fe).toEqual(be);
	});

	it.skipIf(REG)('SKIPPED: the BE registry file was not found next to this checkout (looked in ../wt-be-id, ../sc-be-team); run again with the BE worktree beside the FE one', () => {
		expect(REG).toBeUndefined();
	});
});
