#!/usr/bin/env node
// Generates public/assets/site-control/icon-usage.json = for every function-icon id: is it USED and BOUND (a place follows its key), USED_UNBOUND (its glyph is drawn somewhere but nothing follows THIS key) or UNUSED (defined / in the library, drawn nowhere).
// "Not finding a consumer" is not a reason to delete anything: the status only tells the admin what a change of this key can reach today.
// Usage: node tools/icon-usage-report.cjs [--write | --check]   (no flag: print). Deterministic: sorted, no timestamps, no absolute paths. Uses the same walk / regexes as tools/icon-real-library.cjs and the BE allow-list generator.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'assets', 'site-control', 'icon-usage.json');
const norm = (s) => s.replace(/\s+/g, ' ').replace(/> </g, '><').replace(/\s*\/>/g, '/>').trim();
function walk(dir, acc) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, acc);
		else if (/\.(html|ts)$/.test(e.name) && !/\.spec\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) acc.push(p);
	}
	return acc;
}
const NOT_CONSUMERS = [/^src\/app\/core\/identity\//, /^src\/app\/pages\/dashboard\/supper-admin-overview\/site-control\//];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function build() {
	const files = walk(path.join(ROOT, 'src'), []).sort();
	const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
	const texts = files.map(f => [rel(f), fs.readFileSync(f, 'utf8')]);
	const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/site-control/real-icons.json'), 'utf8')).icons;
	const lib = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/site-control/icons.json'), 'utf8'));
	const consumers = texts.filter(([f]) => !NOT_CONSUMERS.some(r => r.test(f))).map(([, t]) => t).join('\n');
	// every inline <svg> that draws shapes and uses no <use>, by its normalised inner markup: how many carry NO key at all (unbound), and which keys the others follow
	const inl = require('./inline-icon-keys.cjs');
	const places = inl.scan(ROOT);
	const inline = new Map();
	for (const p of places) {
		const e = inline.get(p.inner) || { unbound: 0, keys: new Map() };
		if (p.key) e.keys.set(p.key, (e.keys.get(p.key) || 0) + 1);
		else if (!p.dynamic) { const d = inl.decide(p); if (d.key || d.excluded === 'UNNAMED') e.unbound++; }
		inline.set(p.inner, e);
	}
	const unboundPlaces = [];
	for (const p of places) if (!p.key) { const d = inl.decide(p); if (!d.key) unboundPlaces.push({ file: p.f, line: p.line, reason: d.excluded, why: d.why }); }
	for (const m of JSON.parse(fs.readFileSync(path.join(__dirname, 'unbound-holders.json'), 'utf8')).holders) unboundPlaces.push(m);
	const refs = (id) => {
		const use = (consumers.match(new RegExp('#' + esc(id) + '(?![A-Za-z0-9_-])', 'g')) || []).length;
		const quoted = (consumers.match(new RegExp('[\'"`]' + esc(id) + '[\'"`]', 'g')) || []).length;
		const own = (consumers.match(new RegExp('\\bid\\s*=\\s*[\'"]' + esc(id) + '[\'"]', 'g')) || []).length;
		return use + Math.max(0, quoted - own);
	};
	// BOUND: something follows THIS key. USED_UNBOUND: a place draws this glyph with NO key at all (must stay 0). UNUSED: nothing draws THIS id; when the same drawing is drawn elsewhere under other keys
	// they are listed (`sameDrawing`): the id is a spare copy of that drawing, never a reason to delete it.
	const byInner = new Map(); for (const id of Object.keys(real)) { const k = norm(real[id].inner); (byInner.get(k) || byInner.set(k, []).get(k)).push(id); }
	const status = (id, inner) => {
		const r = refs(id); const tw = inline.get(norm(inner)) || { unbound: 0, keys: new Map() };
		if (r > 0) return { status: 'BOUND', refs: r };
		if (tw.unbound > 0) return { status: 'USED_UNBOUND', refs: 0, unboundPlaces: tw.unbound };
		const keys = new Map(tw.keys);
		for (const o of byInner.get(norm(inner)) || []) if (o !== id && refs(o) > 0) keys.set(o, (keys.get(o) || 0) + refs(o));
		const top = [...keys.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3);
		return top.length ? { status: 'UNUSED', refs: 0, sameDrawing: { places: [...keys.values()].reduce((a, b) => a + b, 0), keys: top.map(x => x[0]) } } : { status: 'UNUSED', refs: 0 };
	};
	const icons = {}; const libraryOnly = {};
	for (const id of Object.keys(real).sort()) icons[id] = status(id, real[id].inner);
	for (const l of lib.libraries || []) for (const i of l.icons || []) if (!real[i.slot] && !/(^|-)ai$/.test(i.slot)) libraryOnly[i.slot] = status(i.slot, i.svg);
	const count = (o) => Object.values(o).reduce((a, v) => (a[v.status] = (a[v.status] || 0) + 1, a), {});
	return { generatedBy: 'tools/icon-usage-report.cjs', note: 'GENERATED - do not edit. Regenerate: node tools/icon-usage-report.cjs --write', counts: { icons: count(icons), libraryOnly: count(libraryOnly), unboundPlaces: unboundPlaces.length }, icons, libraryOnly, unboundPlaces };
}
module.exports = { build };
if (require.main === module) {
	const json = JSON.stringify(build()) + '\n';
	const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'print';
	if (mode === 'print') process.stdout.write(json);
	else if (mode === 'write') { fs.writeFileSync(OUT, json); console.log('wrote', path.relative(process.cwd(), OUT), JSON.stringify(JSON.parse(json).counts)); }
	else { const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''; if (cur !== json) { console.error('DRIFT: icon-usage.json differs from the sources. Run with --write.'); process.exit(1); } console.log('icon-usage.json matches the sources'); }
}
