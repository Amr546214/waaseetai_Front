import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { cleanUsername, usernameProblem, usernameValidator } from './username.validator';

describe('username validator (same rule as the backend)', () => {
	it('a single word is a valid username', () => {
		expect(usernameProblem('عمرو')).toBeNull();
		expect(usernameProblem('amr_99')).toBeNull();
		expect(cleanUsername('  عمرو   م ')).toBe('عمرو م');
	});
	it('too short, too long, links, addresses and symbols are refused with a reason', () => {
		expect(usernameProblem('ع')).toMatch(/قصير/);
		expect(usernameProblem('ع'.repeat(61))).toMatch(/60/);
		for (const bad of ['a@b.com', 'https://x.test', 'www.x.test', '@amr', '😀 amr']) expect(usernameProblem(bad)).toMatch(/حروفًا/);
	});
	it('empty is left to the required validator', () => {
		expect(usernameValidator(new FormControl(''))).toBeNull();
		expect(usernameValidator(new FormControl('a@b.com'))).toEqual({ server: expect.stringContaining('حروفًا') });
	});
});
