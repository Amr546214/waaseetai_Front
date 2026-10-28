/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Round 6 (G): the page states the REAL behaviour of logo.boot when the manifest is late (measured on the production build: with JS held 3.5 s and the manifest delayed 3 s / 9 s the DEFAULT file is visible
// from 1.5 s and the custom one did NOT replace it before the loader went away; answered within 1 s = custom at once).
describe('logo.boot timing text on the identity page', () => {
	const html = readFileSync(join(__dirname, 'identity.html'), 'utf8');
	const index = readFileSync(join(__dirname, '../../../../../../index.html'), 'utf8');
	it('says the default file DOES appear after the 1.5 s limit, and when the custom one replaces it', () => {
		const block = html.slice(html.indexOf("'boot-timing-'"), html.indexOf("it.key === 'icon.ai'"));
		expect(block).toContain('أكثر من 1.5 ثانية'); expect(block).toContain('يظهر الملف الأصلي'); expect(block).toContain('حلّ <strong>المخصّص</strong>'); expect(block).toContain('الزيارات التالية');
		expect(block).not.toContain('لا يظهر الملف الأصلي');
	});
	it('matches the boot script: a 1.5 s limit that aborts the first request and then shows the image', () => {
		expect(index).toContain('}, 1500);'); expect(index).toContain('ctl.abort()'); expect(index).toContain("img.style.visibility = 'hidden'");
	});
	it('states the static-host path and the platform caching limit of the link-share image and favicon.ico', () => {
		const block = html.slice(html.indexOf("'static-host-'"), html.indexOf("it.key === 'icon.ai'"));
		expect(block).toContain('/api/public/site-identity/social/og'); expect(block).toContain('منصّات المعاينة'); expect(block).toContain('الملف الأصلي المدمج'); expect(block).toContain('/favicon.ico'); expect(block).toContain('favicon.tab');
	});
});
