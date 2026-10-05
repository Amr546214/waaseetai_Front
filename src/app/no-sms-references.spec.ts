import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The product is email-OTP only: no user-facing screen may offer or promise an SMS / "code sent to your phone" channel.
// Admin (super-admin) screens are internal mock tooling and are excluded; auth/login keeps the one Arabic
// "SMS unavailable" message by design.
const FORBIDDEN = [/رسائل SMS/, /الرسائل النصية SMS/, /يُرسل لجوال/, /جوال الشركة/, /الرمز المرسل لجوالك/, /على كلا القناتين/, /على\s+القناتين/];

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) { if (!p.includes('supper-admin')) walk(p, out); }
		else if (/\.(html|ts)$/.test(name) && !/\.spec\.ts$/.test(name)) out.push(p);
	}
	return out;
}

describe('no SMS / phone-OTP wording in user-facing screens', () => {
	it('templates and components do not mention an SMS channel or a code sent to a phone', () => {
		const root = join(process.cwd(), 'src', 'app');
		const hits: string[] = [];
		for (const f of walk(root)) {
			const text = readFileSync(f, 'utf8');
			for (const re of FORBIDDEN) if (re.test(text)) hits.push(`${f.replace(root, '')}: ${re}`);
		}
		expect(hits).toEqual([]);
	});
});
