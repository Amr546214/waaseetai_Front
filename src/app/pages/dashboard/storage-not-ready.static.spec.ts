import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Before the platform_settings / marketing_assets migration the pages must open (reads are 200 on the server) and say why saving/adding is off.
const read = (p: string) => readFileSync(`src/app/pages/dashboard/${p}`, 'utf8');

describe('storage-not-ready banners', () => {
	it('admin settings: banner + every save button disabled while the store is missing', () => {
		const html = read('supper-admin-overview/sa-system-settings/sa-system-settings.html');
		expect(html).toContain('settings-storage-pending');
		const saves = html.match(/class="ss-save-btn" \[disabled\]="[^"]*"/g) ?? [];
		expect(saves.length).toBeGreaterThanOrEqual(3);
		for (const s of saves) expect(s).toContain('!storageReady()');
		expect(read('supper-admin-overview/sa-system-settings/sa-system-settings.ts')).toContain('r.storageReady !== false');
	});
	it('admin marketing assets: banner + add button disabled while the store is missing', () => {
		const html = read('supper-admin-overview/sa-marketing-assets/sa-marketing-assets.html');
		expect(html).toContain('assets-storage-pending');
		expect(html).toMatch(/\[disabled\]="!storageReady\(\)"[^>]*>إضافة مادة/);
	});
	it('marketer assets: text materials can be copied, links open, files download', () => {
		const html = read('marketer-overview/assets/assets.html');
		expect(html).toContain('asset-copy-text');
		expect(html).toContain('asset-download');
	});
});
