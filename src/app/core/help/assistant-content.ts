/** Escaped Markdown only. Raw HTML is data; URL schemes are explicitly restricted. */
export const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export function safeAssistantUrl(value: unknown): string | null {
	if (typeof value !== 'string' || /[\u0000-\u0020]/.test(value)) return null;
	if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value;
	try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
function inline(raw: string): string {
	const placeholders: string[] = [];
	const hold = (value: string) => `\u0000${placeholders.push(value) - 1}\u0000`;
	let text = raw.replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`));
	text = text.replace(/\[([^\]\n]+)\]\(([^\s)]+)\)/g, (_, label, target) => {
		const url = safeAssistantUrl(target);
		return hold(url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>` : escapeHtml(label));
	});
	text = escapeHtml(text).replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
	return text.replace(/\u0000(\d+)\u0000/g, (_, id) => placeholders[Number(id)]);
}
export function assistantMarkdown(raw: string): string {
	const lines = String(raw ?? '').slice(0, 100_000).replace(/\r\n/g, '\n').split('\n');
	const result: string[] = []; let list = ''; let code: string[] | null = null;
	const endList = () => { if (list) result.push(`</${list}>`); list = ''; };
	for (const line of lines) {
		if (/^\s*```/.test(line)) { endList(); if (code) { result.push(`<pre dir="ltr"><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = null; } else code = []; continue; }
		if (code) { code.push(line); continue; }
		const item = line.match(/^\s*(?:(\d+)[.)]|[-*•])\s+(.+)$/);
		if (item) { const tag = item[1] ? 'ol' : 'ul'; if (list !== tag) { endList(); list = tag; result.push(`<${tag}>`); } result.push(`<li>${inline(item[2])}</li>`); continue; }
		endList(); const heading = line.match(/^\s*#{1,6}\s+(.+)$/);
		if (heading) result.push(`<h4>${inline(heading[1])}</h4>`);
		else if (/^\s*>/.test(line)) result.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
		else if (line.trim()) result.push(`<p>${inline(line)}</p>`);
	}
	endList(); if (code) result.push(`<pre dir="ltr"><code>${escapeHtml(code.join('\n'))}</code></pre>`);
	return result.join('');
}
export function speakableText(raw: string): string {
	return String(raw ?? '').replace(/```[\s\S]*?(?:```|$)/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, ' ').replace(/<[^>]*>/g, ' ').replace(/^[\s]*#{1,6}\s+/gm, '').replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '').replace(/[*_`>#|]/g, '').replace(/\s+/g, ' ').trim();
}
/** Keep each upstream request below the TTS bound; prefer complete sentences. */
export function speechChunks(raw: string, limit = 1400): string[] {
	const text = speakableText(raw); const result: string[] = []; let part = '';
	for (const sentence of text.match(/[^.!?؟\n]+[.!?؟]?/g) ?? []) {
		let remaining = sentence.trim();
		while (remaining) {
			if (part && part.length + remaining.length + 1 > limit) { result.push(part); part = ''; }
			if (remaining.length <= limit) { part = part ? `${part} ${remaining}` : remaining; break; }
			let cut = remaining.lastIndexOf(' ', limit); if (cut < limit / 2) cut = limit;
			result.push(remaining.slice(0, cut)); remaining = remaining.slice(cut).trim();
		}
	}
	if (part) result.push(part); return result;
}
