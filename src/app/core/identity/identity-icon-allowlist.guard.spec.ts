/// <reference types="node" />
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guard (when the sibling BE worktree is present, like identity-defaults.spec.ts): the BE's generated allow-list of `icon.fn.<symbolId>` is the list of REAL <symbol id> definitions of THIS front end.
// An id that left the templates, or the notifications icon losing its consumer, fails here before it can show a «customisable» icon that nothing follows.
const FE_ROOT = join(__dirname, '../../../..');
const BE_JSON = join(FE_ROOT, '..', 'wt-be-id', 'src', 'config', 'site-identity-icon-allowlist.generated.json');
const SRC = join(FE_ROOT, 'src');
function walk(dir: string, out: string[] = []): string[] {
	for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(html|ts)$/.test(n) && !/\.spec\.ts$|\.d\.ts$/.test(n)) out.push(p); }
	return out;
}
const run = existsSync(BE_JSON) ? describe : describe.skip;
run('icon.fn allow-list vs the real <symbol> definitions (needs ../wt-be-id)', () => {
	const json = existsSync(BE_JSON) ? JSON.parse(readFileSync(BE_JSON, 'utf8')) as { symbols: { id: string; reason: string | null }[] } : { symbols: [] };
	const all = walk(SRC).map(f => readFileSync(f, 'utf8')).join('\n');
	const defined = new Set([...all.matchAll(/<symbol\b[^>]*\bid="([^"$]+)"/g)].map(m => m[1]));
	it('every listed id is a literal <symbol id> in the front end source', () => {
		const missing = json.symbols.map(s => s.id).filter(id => !defined.has(id));
		expect(missing).toEqual([]);
	});
	it('no listed id is an AI-mark id (those belong to icon.ai)', () => { expect(json.symbols.filter(s => /(^|-)ai$/.test(s.id)).map(s => s.id)).toEqual([]); });
	it('the notifications icon is listed, wired, and drawn by the real bell button through <use href="#i-bell">', () => {
		const bell = json.symbols.find(s => s.id === 'i-bell'); expect(bell, 'i-bell in the allow-list').toBeTruthy(); expect(bell!.reason).toBeNull();
		expect(readFileSync(join(SRC, 'app/sheards/notification-bell/notification-bell.html'), 'utf8')).toContain('<use href="#i-bell">');
	});
});
