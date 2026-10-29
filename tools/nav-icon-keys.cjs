#!/usr/bin/env node
// Round 9: one key per sidebar entry. The sidebar draws its entries from DATA (`icon: 'M…'` path strings or the shared `icons.xxx` map in sidebar.ts) through ONE template svg whose
// `data-ws-icon` is bound to the item's `ws`. Items without `ws` were not followable. This tool gives EVERY item that has an `icon` a `ws: 'pl-nav-<route>'` (derived from its route / id / action;
// same route with a different drawing gets a numbered key) and registers the item's drawing as the key's default in src/app/core/identity/identity-inline-icons.ts (data only).
// Items that already carry `ws` (the bell entries, i-bell etc.) are left as they are. Default pixels are unchanged: the svg only gains an attribute value.
// Usage: node tools/nav-icon-keys.cjs [--write | --check]
const fs = require('fs'), path = require('path'), ts = require('typescript');
const inl = require('./inline-icon-keys.cjs');
const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'src/app/sheards/dashboard/sidebar/sidebar.ts');
const SHORT = [[/^supper-admin-overview/, 'admin'], [/^provider-overview/, 'provider'], [/^clients?-overview/, 'client'], [/^marketer-overview/, 'marketer']];
const slugOf = (s) => { let x = s.replace(/^\/+/, '').toLowerCase(); for (const [re, r] of SHORT) x = x.replace(re, r); x = x.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); return x || 'item'; };
const keyOf = (base) => { let k = 'pl-nav-' + base; if (/(^|-)ai$/.test(k)) k += '-nav'; /* never end in -ai: that suffix belongs to the official AI mark (key icon.ai) */ if (k.length > 60) k = k.slice(0, 52) + '-' + require('crypto').createHash('sha1').update(base).digest('hex').slice(0, 7); return k; };
const lit = (n) => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;

function analyse(text = fs.readFileSync(FILE, 'utf8')) {
	const sf = ts.createSourceFile(FILE, text, ts.ScriptTarget.Latest, true);
	const icons = {};
	sf.forEachChild(function visit(n) {
		if (ts.isVariableDeclaration(n) && n.name.getText() === 'icons' && n.initializer && ts.isObjectLiteralExpression(n.initializer))
			for (const p of n.initializer.properties) if (ts.isPropertyAssignment(p) && lit(p.initializer) != null) icons[p.name.getText()] = lit(p.initializer);
		n.forEachChild(visit);
	});
	const items = [];
	(function visit(n) {
		if (ts.isObjectLiteralExpression(n)) {
			const props = {}; for (const p of n.properties) if (ts.isPropertyAssignment(p)) props[p.name.getText()] = p;
			if (props.icon) {
				const iv = props.icon.initializer;
				const d = lit(iv) ?? (ts.isPropertyAccessExpression(iv) && iv.expression.getText() === 'icons' ? icons[iv.name.text] : null);
				items.push({ pos: props.icon.getStart(), d, hasWs: !!props.ws, ws: props.ws ? lit(props.ws.initializer) : null, route: lit(props.route?.initializer), id: lit(props.id?.initializer), action: lit(props.action?.initializer), label: lit(props.label?.initializer), expr: iv.getText().slice(0, 40) });
			}
		}
		n.forEachChild(visit);
	})(sf);
	return items;
}

function plan(items = analyse()) {
	const seen = new Map(); // key -> d
	const out = [];
	for (const it of items) {
		if (it.hasWs) continue;
		if (!it.d) { out.push({ ...it, excluded: 'icon is computed (' + it.expr + ')' }); continue; }
		const base = slugOf(it.route ?? (it.id ? 'group-' + it.id : it.action ? 'action-' + it.action : 'x-' + (it.label || '').length));
		let k = keyOf(base), n = 1;
		while (seen.has(k) && seen.get(k) !== it.d) k = keyOf(base + '-' + (++n));
		seen.set(k, it.d);
		out.push({ ...it, key: k });
	}
	return out;
}
const symbol = (key, label, d) => `<symbol id="${key}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" data-label="${inl.esc('عنصر القائمة الجانبية: ' + label)}" data-area="nav" data-area-label="القائمة الجانبية"><path stroke-linecap="round" stroke-linejoin="round" d="${d}"/></symbol>`;

function write() {
	const pl = plan(); let text = fs.readFileSync(FILE, 'utf8');
	for (const it of pl.filter(p => p.key).sort((a, b) => b.pos - a.pos)) text = text.slice(0, it.pos) + `ws: '${it.key}', ` + text.slice(it.pos);
	fs.writeFileSync(FILE, text);
	const reg = inl.readRegistry();
	for (const it of pl.filter(p => p.key)) if (!reg.has(it.key)) reg.set(it.key, symbol(it.key, it.label || it.id || it.route || it.action || it.key, it.d));
	fs.writeFileSync(inl.REGISTRY, inl.registryText(reg));
	inl.writeLibraries(reg);
	console.log('nav items keyed', pl.filter(p => p.key).length, 'keys', new Set(pl.filter(p => p.key).map(p => p.key)).size, 'computed/excluded', pl.filter(p => p.excluded).length);
	for (const p of pl.filter(p => p.excluded)) console.log('  excluded:', p.label, p.excluded);
}
module.exports = { analyse, plan };
if (require.main === module) {
	if (process.argv.includes('--write')) write();
	else {
		const pl = plan(); const todo = pl.filter(p => p.key).length;
		if (process.argv.includes('--check')) { if (todo) { console.error('DRIFT: ' + todo + ' sidebar item(s) have an icon but no ws key (run: node tools/nav-icon-keys.cjs --write)'); process.exit(1); } console.log('every sidebar item with an icon has a ws key'); }
		else console.log(JSON.stringify({ items: analyse().length, withWs: analyse().filter(i => i.hasWs).length, toKey: todo, excluded: pl.filter(p => p.excluded).map(p => p.label) }));
	}
}
