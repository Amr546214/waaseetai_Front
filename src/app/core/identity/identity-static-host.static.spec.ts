/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Round 7 (C): /favicon.ico and the link-share image are answered by the static host (crawlers and browsers do not run JS). The dev image asks the backend's public alias routes and falls back to the static default
// files of the same image; index.html keeps the exact og/twitter URLs (so the default behaviour is unchanged).
const root = join(__dirname, '../../../..');
const conf = readFileSync(join(root, 'nginx/dev.conf.template'), 'utf8');
const docker = readFileSync(join(root, 'Dockerfile.dev'), 'utf8');
const index = readFileSync(join(root, 'src/index.html'), 'utf8');

describe('static host: favicon.ico + link-share image through the identity routes', () => {
	it('/favicon.ico and the og image proxy to the backend alias routes', () => {
		expect(conf).toContain('location = /favicon.ico');
		expect(conf).toContain('/api/public/site-identity/favicon.ico');
		expect(conf).toContain('location = /assets/social/waseetai-og-v3.jpg');
		expect(conf).toContain('/api/public/site-identity/social/og');
	});
	it('any failure (backend down, slow, or not 200) serves the static default file of the image', () => {
		expect(conf).toContain('proxy_intercept_errors on');
		expect(conf).toMatch(/error_page [^;]*502[^;]*503[^;]*504 = @ws_static_favicon;/);
		expect(conf).toMatch(/error_page [^;]*404[^;]*502[^;]*= @ws_static_og;/);
		expect(conf).toContain('try_files /favicon.ico =404');
		expect(conf).toContain('try_files /assets/social/waseetai-og-v3.jpg =404');
		expect(conf).toContain('proxy_connect_timeout 2s');
		expect(conf).toContain('proxy_read_timeout 3s');
	});
	it('nginx still starts when the upstream cannot be resolved (variable proxy_pass + resolver) and the SPA / asset rules are unchanged', () => {
		expect(conf).toContain('set $ws_up');
		expect(conf).toContain('resolver ${WS_RESOLVER}');
		expect(conf).toContain('try_files $uri $uri/ /index.html;');
		expect(conf).toContain('location ~ \\.(js|css|svg|ico|png|jpg|jpeg|woff|woff2|ttf|map)$');
	});
	it('Dockerfile.dev installs the template with its three WS_* settings; no other deployment file is touched by this', () => {
		expect(docker).toContain('/etc/nginx/templates/default.conf.template');
		for (const v of ['WS_IDENTITY_UPSTREAM', 'WS_IDENTITY_HOST', 'WS_RESOLVER']) expect(docker).toContain(v);
		expect(docker).not.toContain("echo 'server {");
	});
	it('index.html keeps the exact og / twitter image URL (the static host maps it), 1200x630 jpeg', () => {
		for (const p of ['property="og:image"', 'property="og:image:url"', 'property="og:image:secure_url"', 'name="twitter:image"']) expect(index).toMatch(new RegExp(`${p} content="https://dev\\.waseetai\\.com/assets/social/waseetai-og-v3\\.jpg"`));
		expect(index).toContain('content="1200"'); expect(index).toContain('content="630"');
	});
});
