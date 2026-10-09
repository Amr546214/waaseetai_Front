/// <reference types="node" />

// Static guard: the app has ONE official AI mark (core/constants/ai-icon.ts == design system i-ai.svg).
// Any `<symbol>` that is an AI mark (id is `ai` / `*-ai`), and every inline AI node-network svg or TS `svg:` string,
// must draw exactly that geometry. Look-alikes (plus-shaped 5-node, links-only, star, sparkle, clock) must not come back
// in the places that mean "AI". Non-AI uses of a sparkle (e.g. "جديد" / "ماذا يحدث بعد الإرسال") are deliberately not covered.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AI_ICON_INNER, AI_ICON_LINKS } from './core/constants/ai-icon';

const APP = __dirname;
const LINKS_PART = 'M12 10V5M12 19v-5M10 12H5M19 12h-5';

function walk(dir: string, out: string[] = []): string[] {
	for (const n of readdirSync(dir)) {
		const p = join(dir, n);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(html|ts)$/.test(n) && !n.endsWith('.spec.ts')) out.push(p);
	}
	return out;
}
const FILES = walk(APP);
const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');
const canon = (x: string) =>
	x.replace(/\s+/g, ' ').replace(/><\/(circle|path)>/g, '/>').replace(/> </g, '><').replace(/\s*\/>/g, '/>').replace(/\sstroke-width="[\d.]+"/g, '').trim();

describe('official AI icon', () => {
	it('the shared constant is exactly the design-system i-ai.svg', () => {
		const svg = readFileSync(join(APP, '../../public/tools/02-الايقونات/svg/i-ai.svg'), 'utf8');
		expect(svg).toContain(`d="${AI_ICON_LINKS}"`);
		expect([...svg.matchAll(/<circle/g)].length).toBe(7);
		expect([...AI_ICON_INNER.matchAll(/<circle/g)].length).toBe(7);
	});

	it('every AI-named <symbol> (id "ai" / "*-ai") draws the official geometry', () => {
		const bad: string[] = [];
		let n = 0;
		for (const f of FILES.filter((x) => x.endsWith('.html'))) {
			for (const m of readFileSync(f, 'utf8').matchAll(/<symbol\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/symbol>/g)) {
				if (!/(^|-)ai$/.test(m[1])) continue;
				n++;
				if (canon(m[2]) !== canon(AI_ICON_INNER)) bad.push(`${f.replace(APP, '')}#${m[1]}`);
			}
		}
		expect(n).toBeGreaterThan(30);
		expect(bad).toEqual([]);
	});

	it('no partial copy (nodes + straight links but no diagonals) of the mark exists in html or TS strings', () => {
		const bad: string[] = [];
		for (const f of FILES) {
			const s = readFileSync(f, 'utf8');
			let i = -1;
			while ((i = s.indexOf(LINKS_PART, i + 1)) !== -1) {
				if (s.slice(i, i + AI_ICON_LINKS.length) !== AI_ICON_LINKS) bad.push(`${f.replace(APP, '')}:${s.slice(0, i).split('\n').length}`);
			}
		}
		expect(bad).toEqual([]);
	});

	it('the AI bars / disclosures / badges that were fixed draw the full mark', () => {
		const full = (rel: string, marker: RegExp) => {
			const s = read(rel);
			const m = marker.exec(s);
			expect(m, rel).not.toBeNull();
			expect(s.slice(m!.index, m!.index + 1400), rel).toContain(AI_ICON_LINKS);
		};
		// Chat bars are a support-review notice (no AI call): they no longer draw the AI mark at all.
		for (const role of ['clients-overview', 'provider-overview', 'marketer-overview']) {
			const s = read(`pages/dashboard/${role}/messages/messages.html`);
			const m = /class="ai-bc-ico"/.exec(s);
			expect(m, role).not.toBeNull();
			expect(s.slice(m!.index, m!.index + 1400), role).not.toContain(AI_ICON_LINKS);
		}
		full('pages/dashboard/provider-overview/business-models/new-project/components/step2-specialty/step2-specialty.component.html', /class="ai-disc-ico"/);
		full('pages/dashboard/provider-overview/business-models/market/model-details/model-details.html', /class="mdl-ai-ico"/);
		full('pages/dashboard/clients-overview/create-request/components/step3-details/step3-details.html', /class="ai-suggest-btn/);
	});

	it('no sparkle / star / clock stands in for the AI mark in the places that were fixed', () => {
		const SPARKLE = /M12 2l2\.5 7\.5|M12 2l2\.4 7\.4|M12 2 9 9H2|12 2 15 9 22 9/;
		for (const rel of [
			'pages/auth/rest-password/rest-password.html',
			'pages/website/support/help-article/help-article.component.html',
			'pages/website/support/help-center/help-center.component.html',
			'pages/website/legal/policy-hub/policy-hub.html',
			'pages/dashboard/provider-overview/profile/public/public.html',
			'pages/dashboard/provider-overview/business-models/new-project/components/step5-evaluation/step5-evaluation.component.html',
			'pages/dashboard/provider-overview/business-models/new-project/components/step2-specialty/step2-specialty.component.html',
			'pages/dashboard/clients-overview/create-request/components/step3-details/step3-details.html',
		]) expect(SPARKLE.test(read(rel)), rel).toBe(false);
		// home "وسيط AI" persona + first feature card use the official mark, not the sparkle symbol
		const feat = read('pages/website/home/components/ai-features/ai-features.html');
		expect(feat).not.toContain('href="#ws-ai-spark"');
		expect(feat.match(/ai-persona-icon[\s\S]{0,200}?href="#ws-trust-ai"/)).not.toBeNull();
	});

	it('TS-built icons (notifications) use the full mark', () => {
		for (const rel of ['core/services/notification-engine.service.ts', 'pages/dashboard/marketer-overview/notifications/notifications.ts']) {
			expect(read(rel), rel).toContain(AI_ICON_LINKS);
		}
	});
});
