import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Site-wide Bebo install (BeboAI-Ready): scripts + elements in index.html, outside <app-root>,
// assets served from /bebo/ (public/bebo) with the sprite PNGs next to robot.js.
const root = process.cwd();
const indexHtml = readFileSync(join(root, 'src/index.html'), 'utf8');
const appRootEnd = indexHtml.indexOf('</app-root>');

describe('Bebo site-wide install', () => {
	it('loads robot.js and bebo-chat.js from /bebo/ as deferred scripts', () => {
		expect(indexHtml).toMatch(/<script defer src="\/bebo\/robot\.js"><\/script>/);
		expect(indexHtml).toMatch(/<script defer src="\/bebo\/bebo-chat\.js"><\/script>/);
	});

	it('renders <cute-robot> and <bebo-chat> after (outside) <app-root> with the documented attributes', () => {
		expect(appRootEnd).toBeGreaterThan(-1);
		const after = indexHtml.slice(appRootEnd);
		expect(after).toContain('<cute-robot id="bebo" size="112" floating interactive floor-offset="110" home-x="116"></cute-robot>');
		expect(after).toContain('<bebo-chat robot="#bebo" api-base="https://waseet-ai-api-1041761245251.us-central1.run.app/v1/bebo"></bebo-chat>');
		expect(indexHtml.slice(0, appRootEnd)).not.toContain('<cute-robot');
	});

	it('ships the scripts and all six sprite atlases in public/bebo (copied by the build)', () => {
		for (const f of ['robot.js', 'bebo-chat.js', 'robot-sprites.png', 'robot-actions.png', 'robot-antics.png', 'robot-emotions.png', 'robot-speaking.png', 'kitten-sprites.png']) {
			expect(existsSync(join(root, 'public/bebo', f)), f).toBe(true);
		}
		expect(readFileSync(join(root, 'angular.json'), 'utf8')).toContain('"input": "public"');
	});
});
