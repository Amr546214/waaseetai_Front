/**
 * Plain-text format of the legal pages (terms / privacy), safe by construction: the result is a list of typed blocks whose strings are rendered with Angular text interpolation only,
 * so nothing typed in the settings editor can become markup (`<script>`, `<img onerror>` stay literal characters). Supported: `## title` (a section; `## title || short` = shorter index label), a line (a paragraph),
 * consecutive `- ` lines (a list), consecutive `| a | b |` lines (a table, first row = header), `**bold**` inline. Blank lines are ignored.
 */
export interface LegalPart { t: string; strong: boolean }
export type LegalBlock =
	| { kind: 'p'; parts: LegalPart[] }
	| { kind: 'ul'; items: LegalPart[][] }
	| { kind: 'table'; head: string[]; rows: LegalPart[][][] };
export interface LegalSection { id: string; num: string; title: string; /** label of the index (TOC) link: `## title || short`, else the title */ toc: string; blocks: LegalBlock[] }

export function parseInline(s: string): LegalPart[] {
	const out: LegalPart[] = []; const re = /\*\*(.+?)\*\*/g; let last = 0, m: RegExpExecArray | null;
	while ((m = re.exec(s))) { if (m.index > last) out.push({ t: s.slice(last, m.index), strong: false }); out.push({ t: m[1], strong: true }); last = m.index + m[0].length; }
	if (last < s.length) out.push({ t: s.slice(last), strong: false });
	return out;
}
const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

export function parseLegalText(text: string): LegalSection[] {
	const sections: LegalSection[] = []; let cur: LegalSection | null = null;
	const open = (head: string) => { const [title, short] = head.split(' || ').map(x => x.trim()); cur = { id: `s${sections.length + 1}`, num: String(sections.length + 1).padStart(2, '0'), title, toc: short || title, blocks: [] }; sections.push(cur); return cur; };
	for (const raw of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
		const line = raw.trim(); if (!line) continue;
		if (line.startsWith('## ')) { open(line.slice(3).trim()); continue; }
		const sec = cur ?? open('');
		const last = sec.blocks[sec.blocks.length - 1];
		if (line.startsWith('- ')) { const item = parseInline(line.slice(2).trim()); if (last?.kind === 'ul') last.items.push(item); else sec.blocks.push({ kind: 'ul', items: [item] }); }
		else if (line.startsWith('|')) {
			const c = cells(line);
			if (last?.kind === 'table') { if (!c.every(x => /^:?-{2,}:?$/.test(x))) last.rows.push(c.map(x => parseInline(x))); } else sec.blocks.push({ kind: 'table', head: c, rows: [] });
		}
		else sec.blocks.push({ kind: 'p', parts: parseInline(line) });
	}
	return sections;
}
