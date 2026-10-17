import { assistantMarkdown, safeAssistantUrl, speakableText, speechChunks } from './assistant-content';

describe('Assistant content boundary', () => {
	it('renders useful Markdown without executing raw HTML or unsafe links', () => {
		const html = assistantMarkdown('## ملخص\n**واضح**\n- خطوة\n[مصدر](https://waseet.example/help)\n[خطر](javascript:alert(1))\n<img src=x onerror=alert(1)>');
		expect(html).toContain('<h4>ملخص</h4>');
		expect(html).toContain('<strong>واضح</strong>');
		expect(html).toContain('<li>خطوة</li>');
		expect(html).toContain('rel="noopener noreferrer"');
		expect(html).not.toContain('href="javascript:');
		expect(html).not.toContain('<img');
		expect(html).toContain('&lt;img');
	});
	it('rejects credential URLs, protocol-relative links, control bytes and backslashes', () => {
		for (const url of ['https://user:pass@example.com', '//evil.example', '/\\evil', 'data:text/html,x', 'java\nscript:alert(1)']) expect(safeAssistantUrl(url)).toBeNull();
		expect(safeAssistantUrl('/help/escrow')).toBe('/help/escrow');
	});
	it('speaks prose without reading source URLs, markup or code blocks', () => {
		expect(speakableText('**شرح** [المصدر](https://x.example)\n```js\nsecret()\n```')).toBe('شرح المصدر');
		const raw = Array.from({length:100}, () => 'دي جملة كاملة ومهمة.').join(' ');
		const chunks = speechChunks(raw, 120);
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks.every(part => part.length <= 120)).toBe(true);
		expect(chunks.join(' ')).toBe(speakableText(raw));
	});
});
