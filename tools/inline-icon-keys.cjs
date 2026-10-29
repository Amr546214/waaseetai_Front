#!/usr/bin/env node
// Round 9: semantic keys + adapters for the inline <svg> drawings that have NO <symbol> twin (a one-off drawing written in a template).
// Every such drawing gets `data-ws-icon="pl-<area>-<glyph>"` (the key the runtime follows) and a default drawing in the registry `src/app/core/identity/identity-inline-icons.ts`
// (a DATA-ONLY list of `<symbol>` definitions: it is never injected in the page, it exists so that the BE allow-list generator and the icon library know the key and its real drawing).
// GROUPING: glyph (named by tools/inline-icon-glyphs.json: the same drawing under one slug) x AREA (public site, auth, client, provider, marketer, admin, shared, assistant, errors): the same drawing
// used in two different areas stays two keys (they are different elements: a check mark of the client's contract is not the check mark of the admin table). Inside one area the same glyph is one key.
// NOT bound (and therefore never offered as editable, with the exact reason): drawings picked at run time by data / template state (`@switch`, `@if`, `[attr.d]`, `ngSwitch`, `<text>`), animated, brand marks that
// carry the provider's own colours (Google, Apple) and decorative multi-colour illustrations. The rules are code here; the list is written to icon-usage.json (unboundPlaces) and guarded by a spec.
// Usage: node tools/inline-icon-keys.cjs [--write | --check]   (no flag: print the plan summary). Deterministic, idempotent.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const GLYPHS = JSON.parse(fs.readFileSync(path.join(__dirname, 'inline-icon-glyphs.json'), 'utf8'));
const REGISTRY = path.join(ROOT, 'src/app/core/identity/identity-inline-icons.ts');
const ICONS_JSON = path.join(ROOT, 'public/assets/site-control/icons.json');
const norm = (s) => s.replace(/\s+/g, ' ').replace(/> </g, '><').replace(/\s*\/>/g, '/>').trim();
const KEY_PREFIX = 'pl-';
const AREAS = [
	[/^src\/app\/pages\/website\//, 'site', 'الموقع العام'],
	[/^src\/app\/pages\/auth\//, 'auth', 'تسجيل الدخول والتسجيل'],
	[/^src\/app\/pages\/system-errors\//, 'errors', 'صفحات الأخطاء'],
	[/^src\/app\/pages\/assistant\/|^src\/app\/sheards\/assistant/, 'assistant', 'المساعد'],
	[/^src\/app\/pages\/dashboard\/clients-overview\//, 'client', 'لوحة العميل'],
	[/^src\/app\/pages\/dashboard\/provider-overview\//, 'provider', 'لوحة مقدّم الخدمة'],
	[/^src\/app\/pages\/dashboard\/marketer-overview\//, 'marketer', 'لوحة المسوّق'],
	[/^src\/app\/pages\/dashboard\/supper-admin-overview\//, 'admin', 'لوحة الإدارة'],
];
const SHARED = ['shared', 'العناصر المشتركة'];
const areaOf = (f) => { for (const [re, id, ar] of AREAS) if (re.test(f)) return [id, ar]; return SHARED; };
const NOT_SCANNED = [/^src\/app\/core\/identity\//, /^src\/app\/pages\/dashboard\/supper-admin-overview\/site-control\//];

function walk(dir, acc) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, acc);
		else if (/\.(html|ts)$/.test(e.name) && !/\.spec\.ts$/.test(e.name) && !/\.d\.ts$/.test(e.name)) acc.push(p);
	}
	return acc;
}
function commentMask(t, isTs) {
	const m = new Uint8Array(t.length); let x;
	if (!isTs) { const re = /<!--[\s\S]*?-->/g; while ((x = re.exec(t))) m.fill(1, x.index, x.index + x[0].length); return m; }
	const re = /\/\*[\s\S]*?\*\//g; while ((x = re.exec(t))) m.fill(1, x.index, x.index + x[0].length);
	const re2 = /(^|[\s;,{(])\/\/[^\n]*/g; while ((x = re2.exec(t))) { const s = x.index + x[1].length; m.fill(1, s, x.index + x[0].length); }
	return m;
}
/** end of an opening tag, quote aware (an attribute value can contain `>` or `<=`) */
function tagEnd(t, i) { let q = null; for (let k = i; k < t.length; k++) { const c = t[k]; if (q) { if (c === q) q = null; continue; } if (c === '"' || c === "'") { q = c; continue; } if (c === '>') return k; } return -1; }
const PAINT = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'];

/** every inline <svg> that draws shapes with no <use>/<symbol>/<defs>: where, its key (if it already carries one), its drawing */
function scan(root = ROOT) {
	const src = path.join(root, 'src'); const places = [];
	const rel = (p) => path.relative(root, p).split(path.sep).join('/');
	for (const abs of walk(src, []).sort()) {
		const f = rel(abs); if (NOT_SCANNED.some(r => r.test(f))) continue;
		const t = fs.readFileSync(abs, 'utf8'); const isTs = f.endsWith('.ts'); const cm = commentMask(t, isTs); const hasTemplate = isTs && /template\s*:/.test(t);
		const re = /<svg\b/g; let x;
		while ((x = re.exec(t))) {
			if (cm[x.index]) continue;
			const te = tagEnd(t, x.index + 4); if (te < 0 || t[te - 1] === '/') continue;
			const close = t.indexOf('</svg>', te); if (close < 0) continue;
			const attrs = t.slice(x.index + 4, te), inner = t.slice(te + 1, close);
			if (/<use\b|<symbol\b|<defs\b|<svg\b/.test(inner) || !/<(path|circle|rect|line|polyline|polygon|ellipse)\b/.test(inner)) continue;
			const key = (/(?:data-ws-icon|wsIcon)\s*=\s*"([^"]*)"/.exec(attrs) || [])[1] || null;
			const vb = (/\bviewBox\s*=\s*"([^"]*)"/.exec(attrs) || [])[1] || null;
			const paint = {}; for (const a of PAINT) { const r = new RegExp('(?:^|\\s)' + a + '\\s*=\\s*"([^"]*)"').exec(attrs); if (r) paint[a] = r[1]; }
			places.push({
				f, idx: x.index, line: t.slice(0, x.index).split('\n').length, kind: !isTs ? 'html' : hasTemplate ? 'ts-template' : 'ts-string', key, vb, paint, cls: (/class="([^"]*)"/.exec(attrs) || [])[1] || '',
				inner: norm(inner),
				// drawn by data or by template state: the children are Angular's, replacing them would break the view
				dynamic: /\{\{|\[attr\.|\[ngClass|@if|@for|@switch|\*ng|ngSwitch|<animate|<style|<text|\$\{/.test(inner),
			});
		}
	}
	return places;
}

/** the decision for one unbound place: { key } or { excluded: reason } */
function decide(p) {
	if (p.dynamic) return { excluded: 'DYNAMIC', why: 'الرسم يُختار وقت التشغيل من بيانات أو حالة قالب (@switch / @if / [attr.d] / نص)، واستبدال محتواه يكسر عرض Angular' };
	const g = GLYPHS[p.inner + '|' + p.vb];
	if (!g) return { excluded: 'UNNAMED', why: 'رسم جديد لا اسم له في tools/inline-icon-glyphs.json' };
	if (!g.slug) return { excluded: g.ai ? 'AI_MARK' : 'NOT_AN_ICON', why: g.label };
	const [area, areaAr] = areaOf(p.f);
	return { key: KEY_PREFIX + area + '-' + g.slug, label: g.label + ' — ' + areaAr, glyph: g.slug, area, areaAr, glyphAr: g.label };
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
function symbolMarkup(id, p, label, area, areaAr) {
	let paint = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
	// the host's own static paint wins; a host with none (classes carry it) draws as the site's outline default
	if (p.paint.fill === 'currentColor' && !p.paint.stroke) paint = { fill: 'currentColor' };
	else for (const k of PAINT) if (p.paint[k] != null) paint[k] = p.paint[k];
	const inner = p.inner.replace(/\bclass="opacity-(\d+)"/g, (_, n) => `opacity="${(+n / 100).toString().replace(/^0/, '')}"`).replace(/\s(?:class|style)="[^"]*"/g, '');
	const attrs = Object.entries(paint).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
	return `<symbol id="${id}" viewBox="${p.vb || '0 0 24 24'}"${attrs} data-label="${esc(label)}" data-area="${area}" data-area-label="${esc(areaAr)}">${inner}</symbol>`;
}

function plan(places = scan()) {
	const keys = new Map(); const assign = []; const excluded = [];
	for (const p of places) {
		if (p.key) continue;
		const d = decide(p);
		if (d.key) {
			assign.push({ p, ...d });
			const k = keys.get(d.key) || { key: d.key, label: d.label, area: d.area, areaAr: d.areaAr, glyph: d.glyph, variants: new Map(), places: 0 };
			const vk = p.inner + '|' + p.vb; const v = k.variants.get(vk) || { n: 0, p }; v.n++; k.variants.set(vk, v); k.places++; keys.set(d.key, k);
		} else excluded.push({ p, ...d });
	}
	return { assign, excluded, keys };
}

/** existing registry entries: id -> symbol markup (kept: a key never loses its default drawing) */
function readRegistry() {
	const m = new Map(); if (!fs.existsSync(REGISTRY)) return m;
	const t = fs.readFileSync(REGISTRY, 'utf8'); const re = /<symbol id="([^"]+)"[\s\S]*?<\/symbol>/g; let x;
	while ((x = re.exec(t))) m.set(x[1], x[0]);
	return m;
}
function registryText(entries) {
	const ids = [...entries.keys()].sort();
	return `/**
 * GENERATED by tools/inline-icon-keys.cjs - do not edit by hand (guard: identity-inline-icons.guard.spec.ts).
 * The default drawings of the icon keys \`pl-<area>-<glyph>\`: one key per (glyph x area) of the inline <svg> drawings that have no symbol element in a template.
 * DATA ONLY: this text is never injected in the page. The default look of every place is still its own inline markup (pixels unchanged); the place only carries \`data-ws-icon="<key>"\`,
 * which the icon runtime follows once a version of that key is published. The BE allow-list generator and the icon library read the symbol definitions below.
 */
export const INLINE_ICON_SYMBOLS = \`
${ids.map(i => entries.get(i)).join('\n')}
\`;
export const INLINE_ICON_IDS: readonly string[] = ${JSON.stringify(ids)};
`;
}
function librariesFor(keys) {
	const byArea = new Map();
	for (const k of keys.values()) { const l = byArea.get(k.area) || { id: 'places-' + k.area, label: 'مواضع مضمّنة: ' + k.areaAr, colorVar: '--txt-2', icons: [] }; byArea.set(k.area, l); }
	return byArea;
}

function summary(pl) {
	const by = {}; for (const e of pl.excluded) by[e.excluded] = (by[e.excluded] || 0) + 1;
	return { toBind: pl.assign.length, keys: pl.keys.size, excluded: pl.excluded.length, excludedBy: by };
}

function write() {
	const pl = plan();
	const unnamed = pl.excluded.filter(e => e.excluded === 'UNNAMED');
	if (unnamed.length) { console.error('UNNAMED glyphs (add them to tools/inline-icon-glyphs.json):\n' + unnamed.map(u => u.p.f + ':' + u.p.line + ' ' + u.p.inner.slice(0, 100)).join('\n')); process.exit(1); }
	// 1. templates: add the attribute right after `<svg` (back to front so offsets stay valid)
	const byFile = new Map(); for (const a of pl.assign) (byFile.get(a.p.f) || byFile.set(a.p.f, []).get(a.p.f)).push(a);
	for (const [f, list] of byFile) {
		let t = fs.readFileSync(path.join(ROOT, f), 'utf8');
		for (const a of list.sort((x, y) => y.p.idx - x.p.idx)) {
			if (t.slice(a.p.idx, a.p.idx + 4) !== '<svg') throw new Error('offset drift in ' + f);
			t = t.slice(0, a.p.idx + 4) + ` data-ws-icon="${a.key}"` + t.slice(a.p.idx + 4);
		}
		fs.writeFileSync(path.join(ROOT, f), t);
	}
	// 2. registry (keeps earlier entries)
	const reg = readRegistry();
	for (const k of pl.keys.values()) { const best = [...k.variants.values()].sort((a, b) => b.n - a.n)[0]; if (!reg.has(k.key)) reg.set(k.key, symbolMarkup(k.key, best.p, k.label, k.area, k.areaAr)); }
	for (const e of JSON.parse(fs.readFileSync(path.join(__dirname, 'extra-icon-keys.json'), 'utf8')).keys) {
		if (reg.has(e.id)) continue;
		const paint = e.paint === 'fill' ? { fill: 'currentColor' } : { fill: 'none', stroke: 'currentColor', 'stroke-width': e.paint === 'outline2' ? '2' : e.paint === 'outline25' ? '2.5' : '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
		reg.set(e.id, `<symbol id="${e.id}" viewBox="${e.vb}"${Object.entries(paint).map(([k, v]) => ` ${k}="${v}"`).join('')} data-label="${esc(e.label)}" data-area="${e.area}" data-area-label="${esc(e.areaLabel)}">${e.inner}</symbol>`);
	}
	fs.writeFileSync(REGISTRY, registryText(reg));
	// 3. library file: one library per area (labels = the Arabic names the BE allow-list takes over). The shipped libraries keep their exact text; only the generated tail (`places-*`) is rewritten.
	writeLibraries(reg);
	console.log('bound', pl.assign.length, 'places in', byFile.size, 'files; new keys', pl.keys.size, '; registry', reg.size, '; excluded', JSON.stringify(summary(pl).excludedBy));
}
function writeLibraries(reg) {
	const raw = fs.readFileSync(ICONS_JSON, 'utf8');
	const cut = raw.search(/,\s*\{\s*"id": "places-/);
	const head = cut >= 0 ? raw.slice(0, cut) : raw.replace(/\s*\]\s*\}\s*$/, '');
	const areas = new Map();
	for (const [id, sym] of reg) {
		const m = /data-label="([^"]*)" data-area="([^"]*)" data-area-label="([^"]*)"/.exec(sym); if (!m) continue;
		const un = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
		const l = areas.get(m[2]) || { id: 'places-' + m[2], label: 'مواضع مضمّنة: ' + un(m[3]), colorVar: '--txt-2', icons: [] }; areas.set(m[2], l);
		l.icons.push({ slot: id, label: un(m[1]), svg: symbolInner(sym) });
	}
	for (const l of areas.values()) l.icons.sort((a, b) => a.slot.localeCompare(b.slot));
	const gen = [...areas.values()].sort((a, b) => a.id.localeCompare(b.id)).map(l => JSON.stringify(l, null, 2).split('\n').map(s => '    ' + s).join('\n'));
	fs.writeFileSync(ICONS_JSON, head + (gen.length ? ',\n' + gen.join(',\n') : '') + '\n  ]\n}\n');
}
const symbolInner = (s) => /^<symbol[^>]*>([\s\S]*)<\/symbol>$/.exec(s)[1];

module.exports = { scan, plan, decide, areaOf, readRegistry, registryText, writeLibraries, REGISTRY, summary, GLYPHS, KEY_PREFIX, esc };
if (require.main === module) {
	const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'print';
	if (mode === 'write') write();
	else {
		const pl = plan(); const s = summary(pl);
		if (mode === 'print') console.log(JSON.stringify(s), '\n' + pl.excluded.map(e => e.excluded + ' ' + e.p.f + ':' + e.p.line).join('\n'));
		else {
			const bad = pl.assign.length + pl.excluded.filter(e => e.excluded === 'UNNAMED').length;
			if (bad) { console.error('DRIFT: ' + bad + ' inline <svg> drawing(s) have no key (run: node tools/inline-icon-keys.cjs --write)'); process.exit(1); }
			console.log('every inline drawing is bound or excluded with a reason', JSON.stringify(s.excludedBy));
		}
	}
}
