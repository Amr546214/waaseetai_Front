import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// An archived bid that never became a contract opens read-only (the server answers readOnly:true with the reason); the page says so instead of an error.
describe('provider project workspace: ended bid', () => {
	const html = readFileSync(join(process.cwd(), 'src/app/pages/dashboard/provider-overview/projects/active/progress/progress.html'), 'utf8');
	it('shows a read-only banner with the server status label', () => {
		expect(html).toMatch(/@if\(data\.readOnly\)\{[\s\S]{0,200}data-testid="provider-ended-bid-banner"[\s\S]{0,120}\{\{data\.statusLabel\}\}/);
		expect(html).toContain('لم يتحول إلى عقد');
	});
});
