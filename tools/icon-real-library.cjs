#!/usr/bin/env node
// Generates public/assets/site-control/real-icons.json = the REAL drawing of every function icon the platform ships: the markup of the first `<symbol id="x">` definition found in the templates
// (same walk, same regex and same "first definition" rule as the BE allow-list generator, so the sha256 can be cross-checked against it). The icon library page draws THESE, not a sample set.
// Usage: node tools/icon-real-library.cjs [--write | --check]   (no flag: print). Deterministic: sorted, no timestamps, no absolute paths.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'assets', 'site-control', 'real-icons.json');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const norm = (s) => s.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
function walk(dir, acc) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, acc);
		else if (/\.(html|ts)$/.test(e.name) && !/\.spec\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) acc.push(p);
	}
	return acc;
}
const PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'fill-rule', 'clip-rule', 'opacity', 'color', 'preserveAspectRatio'];
function build() {
	const src = path.join(ROOT, 'src');
	const files = walk(src, []).sort();
	const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
	const defs = new Map();
	const SYMBOL = /<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g;
	for (const f of files) {
		const t = fs.readFileSync(f, 'utf8'); let m;
		while ((m = SYMBOL.exec(t))) {
			const attrs = m[1]; const idm = /\bid\s*=\s*"([^"]*)"/.exec(attrs) || /\bid\s*=\s*'([^']*)'/.exec(attrs);
			if (!idm) continue; const id = idm[1];
			if (/[${}]/.test(id) || id === '' || /(^|-)ai$/.test(id)) continue;
			const vb = ((/\bviewBox\s*=\s*"([^"]*)"/.exec(attrs) || [])[1] || '').trim().replace(/\s+/g, ' ') || null;
			const inner = norm(m[2]);
			const e = defs.get(id) || { files: new Set(), shapes: new Set(), first: null, defs: 0 };
			e.files.add(rel(f)); e.shapes.add(sha(vb + '|' + inner)); e.defs++;
			if (!e.first) {
				const paint = {};
				for (const a of PAINT) { const r = new RegExp('(?:^|\\s)' + a + '\\s*=\\s*"([^"]*)"').exec(attrs); if (r) paint[a] = r[1]; }
				e.first = { vb, inner, paint };
			}
			defs.set(id, e);
		}
	}
	const icons = {};
	for (const id of [...defs.keys()].sort()) {
		const d = defs.get(id);
		if (/[{@]|\{\{/.test(d.first.inner)) continue; // Angular syntax inside a symbol: not a static drawing
		icons[id] = { vb: d.first.vb, paint: d.first.paint, inner: d.first.inner, sha256: sha(d.first.vb + '|' + d.first.inner), defs: d.defs, variants: d.shapes.size, files: [...d.files].sort().slice(0, 3) };
	}
	return { generatedBy: 'tools/icon-real-library.cjs', note: 'GENERATED - do not edit. Regenerate: node tools/icon-real-library.cjs --write', count: Object.keys(icons).length, icons };
}
module.exports = { build };
if (require.main === module) {
	const json = JSON.stringify(build()) + '\n';
	const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'print';
	if (mode === 'print') process.stdout.write(json);
	else if (mode === 'write') { fs.writeFileSync(OUT, json); console.log('wrote', path.relative(process.cwd(), OUT), (json.length / 1024).toFixed(0) + ' KB'); }
	else { const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''; if (cur !== json) { console.error('DRIFT: real-icons.json differs from the templates. Run with --write.'); process.exit(1); } console.log('real-icons.json matches the templates'); }
}
