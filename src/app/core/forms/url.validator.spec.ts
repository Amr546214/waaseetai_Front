import { FormControl } from '@angular/forms';
import { httpUrlValidator } from './url.validator';
import { validationMessage } from './validation-messages';

describe('httpUrlValidator', () => {
	const run = (v: any) => httpUrlValidator(new FormControl(v));

	it('empty / blank passes (the field is optional)', () => {
		expect(run('')).toBeNull();
		expect(run('   ')).toBeNull();
		expect(run(null)).toBeNull();
	});

	it('accepts http and https URLs', () => {
		expect(run('https://example.com')).toBeNull();
		expect(run('http://example.com/in/x?y=1')).toBeNull();
	});

	it('rejects values without a scheme, other schemes and garbage, with an Arabic message', () => {
		expect(run('linkedin.com/in/x')).toEqual({ url: true });
		expect(run('ftp://example.com')).toEqual({ url: true });
		expect(run('javascript:alert(1)')).toEqual({ url: true });
		expect(validationMessage(run('nope'))).toContain('http');
	});
});
