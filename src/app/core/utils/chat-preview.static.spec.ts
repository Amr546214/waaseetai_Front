import { readFileSync } from 'node:fs';
const FILES = ['provider-overview', 'clients-overview', 'marketer-overview'].map(r => `src/app/pages/dashboard/${r}/messages/messages.ts`);
describe('conversation previews go through chatPreview()', () => {
	for (const f of FILES) it(f, () => {
		const s = readFileSync(f, 'utf8');
		expect(s).toContain("chat-preview.util");
		expect(s).not.toMatch(/lastMsg:\s*(c\.lastMessage|formattedMsg\.text|newMsg\.text)/);
	});
});
