import { PRESENTATION_STYLE_ID, splitSelectors } from './presentation-controls';

/**
 * The value a control really has on the site RIGHT NOW, per place. A "place" is one selector of a presentation group (e.g. `.card`, `.project-card`, `.kpi-card` of «البطاقات»): the places of one
 * group share ONE token, but the site's own CSS may draw them differently, so each place is measured separately and shown on its own row. Nothing is guessed: a probe element that matches
 * the selector is created inside the real document (so the platform's global stylesheets and the published overrides apply), and its computed style is read. When a value cannot be measured
 * (no probe can be built for the selector, or the browser answers with a keyword instead of a value) the reason is returned instead of a number.
 *
 * Limit, stated on purpose: this measures the platform's GLOBAL styles. A component that styles itself with Angular-encapsulated CSS (not reachable by a global class) may differ.
 */
/** where the number comes from: real elements of this page that match the place (`instances`, counted), or a probe element styled by the site's global stylesheets only (`global`: a component with its own scoped CSS may differ) */
export type PlaceBasis = 'instances' | 'global';
export interface PlaceValue { place: string; selector: string; basis?: PlaceBasis; count?: number; value: string | null; /** the same value in the exact form the editor accepts (e.g. `#2bd4c7`, `14px`, `1.6`), null when it cannot be expressed */ raw?: string | null; reason?: string }

const PLACE_LABELS: Record<string, string> = {
	'.hero-sub': 'الصفحة الرئيسية — الوصف', '.hero-desc': 'الصفحة الرئيسية — الوصف', '.lead': 'نص تمهيدي', 'p': 'الفقرات', '.body-md': 'نص أساسي', '.body-lg': 'نص أساسي كبير', '.body-sm': 'نص أساسي صغير',
	'.sub': 'العناوين الفرعية للصفحات', '.hint': 'التلميحات', '.helper': 'نص المساعدة', '.stat-sub': 'وصف الإحصاءات', 'small': 'النص الصغير', '.caption': 'الشروحات المصغّرة', '.overline': 'النص الفوقي',
	'.kpi-l': 'عنوان مؤشر', '.kpi-lbl': 'عنوان مؤشر', '.stat-lbl': 'عنوان إحصاء', '.page-title': 'عنوان صفحة', '.section-title': 'عنوان قسم', '.kpi-number': 'رقم المؤشر', '.kpi-v': 'رقم المؤشر', '.kpi-val': 'رقم المؤشر',
	'.stat-val': 'رقم الإحصاء', '.stat-num': 'رقم الإحصاء', '.hstat-n': 'رقم إحصاء الصفحة الرئيسية', 'button': 'الزر العادي', '.btn': 'زر بفئة btn', '[data-site-component="button"]': 'زر مُعلَّم',
	'button:disabled': 'الزر المعطّل', 'button[aria-disabled="true"]': 'الزر المعطّل (aria)', '.card': 'بطاقة', '.project-card': 'بطاقة مشروع', '.model-card': 'بطاقة نموذج', '.service-card': 'بطاقة خدمة', '.kpi-card': 'بطاقة مؤشر',
	'.kpi-c': 'بطاقة مؤشر مصغّرة', '.stat-card': 'بطاقة إحصاء', 'textarea': 'منطقة النص', 'select': 'القائمة المنسدلة', '.ws-sel-trigger': 'زر القائمة المخصّصة', '.modal-panel': 'نافذة', '.dialog-panel': 'نافذة حوار',
	'.confirm-dialog': 'نافذة التأكيد', '[role="dialog"]': 'نافذة (dialog)', '.dropdown-menu': 'قائمة منسدلة', '.ws-sel-panel': 'لوحة القائمة المخصّصة', '[role="listbox"]': 'قائمة اختيار', '.badge': 'شارة', '.chip': 'رقاقة',
	'.status-badge': 'شارة حالة', '.status-pill': 'حبّة حالة', 'table th': 'رأس الجدول', 'table td': 'خلية الجدول', '[role="tab"]': 'تبويب', '.tab-btn': 'زر تبويب', '[role="tooltip"]': 'تلميح', '.tooltip': 'تلميح', 'aside.sidebar': 'القائمة الجانبية',
	'[data-site-action="client-wallet-deposit"]': 'زر إيداع الرصيد', '[data-site-action="provider-wallet-withdraw"]': 'زر سحب الأرباح'
};
for (const h of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) PLACE_LABELS[h] = `العنوان ${h.toUpperCase()}`;

export { splitSelectors };

export function placeLabel(selector: string): string {
	if (PLACE_LABELS[selector]) return PLACE_LABELS[selector];
	if (/^input:not/.test(selector)) return 'حقول الإدخال';
	if (/^input:disabled/.test(selector)) return 'حقل الإدخال المعطّل';
	if (/:disabled$/.test(selector)) return 'العنصر المعطّل';
	return selector;
}

/**
 * build ONE element (or a descendant chain `table th`) for a selector; null when the selector uses something the probe cannot express.
 * `root` is what gets attached to the page; `target` is the element the selector actually matches (the LAST of the chain): the one that must be measured.
 * A table cell gets its `tbody > tr` so the browser lays it out as a real cell.
 */
export function buildProbeParts(doc: Document, selector: string): { root: HTMLElement; target: HTMLElement } | null {
	const chain = selector.trim().split(/\s+/);
	if (chain.some(p => /^(th|td)/i.test(p)) && !chain.some(p => /^table/i.test(p))) return null;
	let root: HTMLElement | null = null, parent: HTMLElement | null = null, target: HTMLElement | null = null;
	for (const part of chain) {
		if (/[>+~*]/.test(part.replace(/\[[^\]]*\]/g, ''))) return null;
		const tagMatch = /^[a-z][a-z0-9-]*/i.exec(part);
		const tag = tagMatch?.[0].toLowerCase() ?? 'div';
		let el: HTMLElement;
		try { el = doc.createElement(tag); } catch { return null; }
		let rest = part.slice(tagMatch ? tagMatch[0].length : 0).replace(/:not\((?:[^()]|\([^)]*\))*\)/g, '');
		const attrs = [...rest.matchAll(/\[([a-z-]+)(?:="([^"]*)")?\]/gi)];
		for (const a of attrs) el.setAttribute(a[1], a[2] ?? '');
		rest = rest.replace(/\[[^\]]*\]/g, '');
		for (const c of rest.matchAll(/\.([\w-]+)/g)) el.classList.add(c[1]);
		if (/:disabled/.test(rest)) el.setAttribute('disabled', '');
		rest = rest.replace(/\.[\w-]+/g, '').replace(/:disabled/g, '');
		if (rest.trim()) return null; // some other pseudo-class: not expressible
		if (parent) {
			// a cell cannot sit directly in a table: give it the row (and body) a browser would build
			if ((tag === 'th' || tag === 'td') && parent.tagName === 'TABLE') { const tb = doc.createElement('tbody'), tr = doc.createElement('tr'); tb.appendChild(tr); parent.appendChild(tb); parent = tr; }
			parent.appendChild(el);
		} else root = el;
		parent = el; target = el;
	}
	return root && target ? { root, target } : null;
}
/** the element to ATTACH (kept for callers that only need the probe tree) */
export function buildProbe(doc: Document, selector: string): HTMLElement | null { return buildProbeParts(doc, selector)?.root ?? null; }

const KEYWORDS = new Set(['', 'auto', 'inherit', 'initial', 'unset']);
/** `normal` is a real, editable value for these two properties */
const NORMAL_OK = new Set(['letter-spacing', 'line-height']);

/** the form the editor accepts: colours as #rrggbb / rgba(r,g,b,a) without spaces, quotes in font stacks as single quotes */
export function editText(property: string, raw: string): string {
	if (/(^|-)color$|^background$/.test(property)) {
		const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i.exec(raw.trim());
		if (!m) return raw.trim();
		const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
		return a === 1 ? colourText(raw).split(' ')[0] : `rgba(${m[1]},${m[2]},${m[3]},${+a.toFixed(3)})`;
	}
	if (property === 'font-family') return raw.replace(/"/g, "'").replace(/,\s+/g, ',').trim();
	if (property === 'letter-spacing' && /^-?0(px)?$/.test(raw)) return '0px';
	return raw.split(' / ').length === 1 ? raw.trim() : raw.trim();
}

/** `rgb()/rgba()` -> `#rrggbb` (and the alpha when it is not opaque); anything else untouched */
export function colourText(v: string): string {
	const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/i.exec(v.trim());
	if (!m) return v.trim();
	const hex = '#' + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('');
	if (m[4] === undefined) return hex;
	const a = m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
	return a === 1 ? hex : `${hex} (شفافية ${Math.round(a * 100)}%)`;
}
/** px lengths are shown with their rem equivalent so the unit is never ambiguous */
export function lengthText(v: string): string {
	const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v.trim());
	if (!m) return v.trim();
	const px = Number(m[1]);
	return px === 0 ? '0px' : `${+px.toFixed(3)}px (${+(px / 16).toFixed(4)}rem)`;
}

function read(cs: CSSStyleDeclaration, property: string): string {
	const g = (p: string) => cs.getPropertyValue(p).trim();
	if (property === 'padding-inline') { const a = g('padding-left'), b = g('padding-right'); return a === b ? a : `${a} / ${b}`; }
	if (property === 'padding-block') { const a = g('padding-top'), b = g('padding-bottom'); return a === b ? a : `${a} / ${b}`; }
	if (property === 'padding') { const t = g('padding-top'), r = g('padding-right'), b = g('padding-bottom'), l = g('padding-left'); return t === b && r === l ? (t === r ? t : `${t} ${r}`) : `${t} ${r} ${b} ${l}`; }
	if (property === 'line-height') { const lh = g('line-height'), fs = g('font-size'); const a = /^([\d.]+)px$/.exec(lh), b = /^([\d.]+)px$/.exec(fs); return a && b && Number(b[1]) > 0 ? String(+(Number(a[1]) / Number(b[1])).toFixed(3)) : lh; }
	if (property === 'background') return g('background-color') === 'rgba(0, 0, 0, 0)' && g('background-image') !== 'none' ? g('background-image') : g('background-color');
	if (property === 'border-color') { const a = g('border-top-color'); return a; }
	return g(property);
}

export function formatMeasured(property: string, raw: string): string {
	if (/(^|-)color$|^background$/.test(property)) return colourText(raw);
	if (['font-size', 'border-radius', 'padding-inline', 'padding-block', 'padding', 'min-height', 'gap', 'letter-spacing'].includes(property)) return raw.split(' / ').map(p => p.split(' ').map(lengthText).join(' ')).join(' / ');
	return raw;
}

/**
 * Measures `property` on every place of `selector`. `original: true` measures with the published presentation overrides switched off for the instant of the read (the style element is
 * put back in the same task, so nothing repaints and there is no flash), which gives the site's OWN value even for a control that currently carries an override.
 */
export function measurePlaces(doc: Document, selector: string, property: string, opts: { original?: boolean } = {}): PlaceValue[] {
	const view = doc.defaultView; if (!view) return splitSelectors(selector).map(s => ({ place: placeLabel(s), selector: s, value: null, reason: 'لا توجد نافذة عرض لقياس القيمة.' }));
	const host = doc.createElement('div');
	host.setAttribute('aria-hidden', 'true'); host.setAttribute('inert', ''); host.setAttribute('data-ws-measure', '');
	host.style.cssText = 'position:fixed;left:-9999px;top:0;width:600px;visibility:hidden;pointer-events:none;contain:layout style;';
	const sheet = opts.original ? (doc.getElementById(PRESENTATION_STYLE_ID) as HTMLStyleElement | null) : null;
	const holder = sheet?.parentNode ?? null, after = sheet?.nextSibling ?? null;
	try {
		doc.body.appendChild(host);
		if (sheet && holder) holder.removeChild(sheet); // out of the cascade for the instant of the read; put back in the same task below
		const out: PlaceValue[] = [];
		const format = (raw: string) => (raw === 'normal' ? 'normal (القيمة الافتراضية للمتصفح)' : formatMeasured(property, raw));
		const unusable = (raw: string) => KEYWORDS.has(raw) || (raw === 'normal' && !NORMAL_OK.has(property));
		for (const s of splitSelectors(selector)) {
			const base = { place: placeLabel(s), selector: s };
			// 1) the REAL elements of this page that match the place: what the site actually renders, counted
			let found: Element[] = [];
			try { found = [...doc.querySelectorAll(s)].filter(el => !el.closest('[data-ws-measure]')).slice(0, 300); } catch { found = []; }
			if (found.length) {
				const seen = new Map<string, number>();
				for (const el of found) { const raw = read(view.getComputedStyle(el), property); seen.set(raw, (seen.get(raw) ?? 0) + 1); }
				const entries = [...seen.entries()].sort((a, b) => b[1] - a[1]);
				for (const [raw, n] of entries) {
					const place = `${base.place} (${n === 1 ? 'عنصر واحد' : n === 2 ? 'عنصران' : n <= 10 ? n + ' عناصر' : n + ' عنصرًا'} في هذه الصفحة)`;
					out.push(unusable(raw)
						? { ...base, place, basis: 'instances', count: n, value: null, raw: null, reason: `المتصفح أعاد «${raw || 'قيمة فارغة'}» لهذا الموضع: لا قيمة رقمية مطبّقة عليه.` }
						: { ...base, place, basis: 'instances', count: n, value: format(raw), raw: raw.includes(' / ') ? null : editText(property, raw) });
				}
				continue;
			}
			// 2) no such element here: a probe styled by the site's global stylesheets (the limit is said on the row)
			const parts = buildProbeParts(doc, s), probe = parts?.root;
			if (!parts || !probe) { out.push({ ...base, basis: 'global', value: null, reason: 'تعذّر بناء عنصر قياس لهذا الموضع، ولا يوجد عنصر منه في هذه الصفحة، فلا يمكن تحديد قيمته.' }); continue; }
			host.appendChild(probe);
			const raw = read(view.getComputedStyle(parts.target), property); // the element the selector matches, never its ancestors
			host.removeChild(probe);
			out.push(unusable(raw)
				? { ...base, basis: 'global', value: null, raw: null, reason: `المتصفح أعاد «${raw || 'قيمة فارغة'}» لهذا الموضع: لا قيمة رقمية مطبّقة عليه من أنماط الموقع العامة.` }
				: { ...base, basis: 'global', value: format(raw), raw: raw.includes(' / ') ? null : editText(property, raw) });
		}
		return out;
	} finally {
		if (sheet && holder) holder.insertBefore(sheet, after);
		host.remove();
	}
}

/** places grouped by identical value: one row when every place agrees, one row per distinct value (with the places named) when they differ */
export function groupByValue(places: PlaceValue[]): { value: string | null; reason?: string; basis?: PlaceBasis; places: string[] }[] {
	const out: { value: string | null; reason?: string; basis?: PlaceBasis; places: string[] }[] = [];
	for (const p of places) {
		const hit = out.find(g => g.value === p.value && g.reason === p.reason);
		if (hit) hit.places.push(p.place); else out.push({ value: p.value, reason: p.reason, basis: p.basis, places: [p.place] });
	}
	return out;
}
