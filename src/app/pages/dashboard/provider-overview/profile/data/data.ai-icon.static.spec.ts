import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(process.cwd(), 'src/app/pages/dashboard/provider-overview/profile/data/data.html'), 'utf8');

describe('provider data page: AI buttons use the official AI icon', () => {
	it('has no ✨ emoji and each AI button carries #i-ai', () => {
		expect(html).not.toContain('✨');
		for (const id of ['suggest-bio-btn', 'suggest-skills-btn']) {
			const start = html.indexOf(`data-testid="${id}"`);
			const block = html.slice(start, html.indexOf('</button>', start));
			expect(block).toContain('href="#i-ai"');
		}
	});

	it('WhatsApp channel is disabled and marked unavailable', () => {
		const block = html.slice(html.indexOf('data-testid="notif-whatsapp-unavailable"'));
		expect(block.slice(0, 200)).toContain('disabled');
		expect(block.slice(0, 250)).toContain('غير متاحة حاليًا');
	});
});
