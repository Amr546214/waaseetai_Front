/// <reference types="node" />

// Dashboard / register / admin copy must not present fixed-rule levels, static banners or local-only settings as AI.
// Static template scan, no TestBed. (Real AI surfaces — step5 evaluation, provider-overview ranked requests — are untouched.)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf-8');

const FILES = [
	'dashboard/clients-overview/profile/profile-level/profile-level.html',
	'dashboard/clients-overview/client-overview/client-overview.component.html',
	'dashboard/clients-overview/profile/profile-edit/profile-edit.html',
	'auth/register/register.html',
	'dashboard/provider-overview/hr/provider-hr.component.html',
	'dashboard/provider-overview/hr/provider-hr.component.ts',
	'dashboard/supper-admin-overview/sa-super-admins/sa-super-admins.ts',
	'dashboard/supper-admin-overview/sa-super-admins/sa-super-admins.html',
	'dashboard/supper-admin-overview/supper-admin.routes.ts',
	'dashboard/supper-admin-overview/sa-specialties-accreditation/sa-specialties-accreditation.html',
	'dashboard/supper-admin-overview/sa-specialties-accreditation/sa-specialties-accreditation.ts',
	'dashboard/supper-admin-overview/subscriptions/sa-upgrade/sa-upgrade.ts',
];

const FORBIDDEN: Array<[string, RegExp]> = [
	['AI computing points/level', /AI يحسب نقاطك/],
	['static "توصية AI:" banner', /توصية AI:/],
	['"وسيط AI يقترح" on register', /وسيط AI يقترح/],
	['AI suggesting bio/skills (no endpoint)', /AI يقترح Bio/],
	['AI monitoring the team / fake AI activity', /AI يراقب أداء الفريق|AI رصد انخفاضاً|نشاط AI|تحليل AI - ثقة/],
	['"AI Match Engine" / "AI Recommendations" admin labels', /AI Match Engine|AI Recommendations/],
	['static "توصية AI" in admin mock tables', /توصية AI|توصيات AI/],
];

describe('dashboard/register/admin AI copy stays truthful', () => {
	for (const f of FILES) {
		it(`${f} has no misleading AI claims`, () => {
			const src = read(f);
			for (const [label, re] of FORBIDDEN) expect(re.test(src), `${f}: ${label}`).toBe(false);
		});
	}

	it('the profile-level banner says levels are computed by fixed rules', () => {
		expect(read('dashboard/clients-overview/profile/profile-level/profile-level.html')).toContain('بقواعد ثابتة');
	});

	it('real AI surfaces are kept: provider-overview only says "توصية AI" when the list is AI-ranked', () => {
		const html = read('dashboard/provider-overview/provider-overview/provider-overview.html');
		expect(html).toContain("isAiRanked(data.aiMatchingProjects) ? 'توصية AI' : 'حسب تخصصك'");
	});
});
