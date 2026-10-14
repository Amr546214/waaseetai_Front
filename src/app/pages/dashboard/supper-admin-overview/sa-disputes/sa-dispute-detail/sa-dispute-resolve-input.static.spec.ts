import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The BE accepts a decision of 2..120 chars (+ an optional note of >=2 chars). The form must make that visible instead of letting the admin hit a generic 400.
const dir = 'src/app/pages/dashboard/supper-admin-overview/sa-disputes/sa-dispute-detail/';
describe('dispute resolve form constraints', () => {
	it('the decision input is capped at 120 with a visible counter, and the note rule is checked before the confirm step', () => {
		const html = readFileSync(dir + 'sa-dispute-detail.html', 'utf8');
		expect(html).toMatch(/data-testid="resolution-input"[^>]*maxlength="120"|maxlength="120"[^>]*data-testid="resolution-input"/);
		expect(html).toContain('data-testid="resolution-count"');
		expect(html).toContain('resolutionText().length }} / 120');
		const ts = readFileSync(dir + 'sa-dispute-detail.ts', 'utf8');
		expect(ts).toContain("note && note.length < 2");
		// an empty note is never sent (the payload only carries it when non-empty)
		expect(ts).toMatch(/if \(note\) payload\.resolutionNote = note;/);
	});
});
