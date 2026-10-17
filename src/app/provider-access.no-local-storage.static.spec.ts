import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The provider's dashboard access comes from the backend (GET /provider/access-state) — never from the browser's storage.
const root = join(process.cwd(), 'src/app');
function walk(dir: string, out: string[] = []): string[] {
	for (const n of readdirSync(dir)) {
		const p = join(dir, n);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.ts$/.test(n) && !/\.spec\.ts$/.test(n)) out.push(p);
	}
	return out;
}

describe('provider access never reads browser storage', () => {
	const files = [
		...walk(join(root, 'pages/dashboard/provider-overview')),
		join(root, 'core/guards/profile-complete.guard.ts'),
		join(root, 'core/services/provider-access.service.ts'),
	];
	for (const f of files) {
		const text = readFileSync(f, 'utf8');
		const rel = f.replace(root + '/', '');
		it(`${rel} does not decide access from localStorage/sessionStorage`, () => {
			const hits = text.split('\n').filter(l => /(localStorage|sessionStorage)/.test(l) && /(approved|canAccessDashboard|accreditation|onboarding|access-state|accessState)/i.test(l));
			expect(hits).toEqual([]);
		});
	}
});
