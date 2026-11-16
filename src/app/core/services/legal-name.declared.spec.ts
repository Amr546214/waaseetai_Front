import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LegalNameService } from './legal-name.service';

// The identity document is compared with the LEGAL name only. The account's display name (what others see) is not what the document says.
describe('LegalNameService.declaredName', () => {
	function run(response: { status: 'MISSING' | 'PROVIDED'; legalName: string | null } | 'error') {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		const http = TestBed.inject(HttpTestingController); let out: string | undefined;
		TestBed.inject(LegalNameService).declaredName().subscribe(v => (out = v));
		const req = http.expectOne(r => r.url.endsWith('/legal-name'));
		if (response === 'error') req.flush('x', { status: 500, statusText: 'err' }); else req.flush({ success: true, data: { ...response, changeNeedsReview: false, pendingRequest: null } });
		return out;
	}
	it('returns the trimmed legal name when provided', () => expect(run({ status: 'PROVIDED', legalName: ' عمرو محمود يحيى محمد ' })).toBe('عمرو محمود يحيى محمد'));
	it('returns nothing when the legal name is missing or the call fails (no name comparison, never the display name)', () => {
		expect(run({ status: 'MISSING', legalName: null })).toBe('');
	});
	it('returns nothing on a failed call', () => expect(run('error')).toBe(''));
});

describe('identity inspection on the setup pages', () => {
	for (const f of ['pages/dashboard/clients-overview/profile/profile-setup/profile-setup.ts', 'pages/dashboard/provider-overview/profile/profile-setup/profile-setup.ts']) {
		it(`${f.split('/')[3]}: declares the legal name, not firstName + lastName`, () => {
			const src = readFileSync(join(process.cwd(), 'src/app', f), 'utf8');
			expect(src).toContain('declaredName()');
			expect(src).not.toMatch(/fullName = u \? `\$\{u\.firstName/);
			expect(src).toContain('document: this.chosenDocument()'); // the chosen kind / country go with the AI check
		});
	}
});
