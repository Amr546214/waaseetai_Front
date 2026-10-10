import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Level } from './level';
import { GamificationService, GamificationLevelResponse } from '../../../../../core/services/gamification.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { levelColor, PROVIDER_LEVEL_NAMES } from '../../../../../core/levels/level-colors';

// Provider level page: names, commission and colours come from the backend roadmap (single ladder); nothing about the ladder is typed in the template.
const COMMISSION = [5, 4.8, 4.6, 4.4, 4.2, 4, 3.75, 3.5, 3.25, 3, 2.75, 2.5, 2, 1.5, 1];
const POINTS = [0, 101, 251, 451, 701, 1001, 1501, 2201, 3001, 4001, 5001, 6501, 8001, 10001, 12001];
const PROJECTS = [0, 3, 6, 11, 16, 21, 30, 46, 61, 81, 101, 126, 151, 181, 211];
const RATING = [0, 3.5, 3.8, 4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.5, 4.5, 4.6, 4.7, 4.8, 4.9];

const payload = (current: number): GamificationLevelResponse => ({
	currentStats: { points: POINTS[current - 1], completedProjects: PROJECTS[current - 1], avgRating: Math.max(RATING[current - 1], 4), commissionRate: COMMISSION[current - 1] },
	currentLevel: { index: current, title: PROVIDER_LEVEL_NAMES[current - 1] },
	nextLevelProgress: { title: PROVIDER_LEVEL_NAMES[Math.min(current, 14)], pointsGap: 10, projectsGap: 1, ratingGap: 0, pointsPercent: 50, projectsPercent: 50, ratingPercent: 100, nextCommission: COMMISSION[Math.min(current, 14)] },
	aiRecommendation: 'المتبقي للوصول إلى مستوى …',
	roadmap: PROVIDER_LEVEL_NAMES.map((title, i) => ({
		index: i + 1, title, reqPoints: POINTS[i], reqProjects: PROJECTS[i], reqRating: RATING[i], commission: COMMISSION[i],
		isCurrent: i + 1 === current, station: Math.ceil((i + 1) / 3), color: { dark: levelColor('PROVIDER', i + 1, 'dark'), light: levelColor('PROVIDER', i + 1, 'light') },
	})),
	pointRules: { gainRules: [], lossRules: [] },
});

describe('provider level page (single ladder)', () => {
	const mount = async (data: GamificationLevelResponse, accountType = 'PROVIDER_INDIVIDUAL') => {
		await TestBed.configureTestingModule({
			imports: [Level],
			providers: [provideRouter([]), { provide: GamificationService, useValue: { getLevelDetails: () => of({ success: true, data }) } }, { provide: AuthStore, useValue: { currentUser: () => ({ accountType }) } }],
		}).compileComponents();
		const f = TestBed.createComponent(Level);
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		return f.nativeElement as HTMLElement;
	};
	const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

	it('the badge shows the real level name, the brand colour pair of its station and the real commission', async () => {
		const el = await mount(payload(7));
		expect(q(el, 'level-name')!.textContent).toContain('أخصائي');
		const badge = q(el, 'level-badge')!;
		expect(badge.style.getPropertyValue('--lvl-dark').toLowerCase()).toBe(levelColor('PROVIDER', 7, 'dark').toLowerCase());
		expect(badge.style.getPropertyValue('--lvl-light').toLowerCase()).toBe(levelColor('PROVIDER', 7, 'light').toLowerCase());
		expect(el.textContent).toContain('عمولة منصة 3.75%');
		expect(el.textContent).toContain('7 من 15 مستوى');
	});

	it('the subtitle and the roadmap come from the 15-level payload: first/last names, 15 nodes, each with its own colour', async () => {
		const el = await mount(payload(1));
		expect(q(el, 'level-subtitle')!.textContent).toContain('15 مستوى · من مبتدئ إلى مرجع');
		const nodes = Array.from(el.querySelectorAll('[data-level]')) as HTMLElement[];
		expect(nodes.length).toBe(15);
		expect(nodes[14].style.getPropertyValue('--lvl-dark').toLowerCase()).toBe(levelColor('PROVIDER', 15, 'dark').toLowerCase());
		expect(nodes[0].style.getPropertyValue('--lvl-dark').toLowerCase()).not.toBe(nodes[14].style.getPropertyValue('--lvl-dark').toLowerCase());
		expect(nodes.map(n => n.textContent).join('')).toContain('مرجع');
	});

	it('the next level and its (lower) commission are shown from the payload', async () => {
		const el = await mount(payload(2));
		expect(el.textContent).toContain('عمولة: 4.8% → 4.6%');
	});

	it('the company page uses the same payload: level name, "level N of 15" and the colour pair', async () => {
		const el = await mount(payload(4), 'PROVIDER_COMPANY');
		expect(q(el, 'level-name')!.textContent).toContain('بارع');
		expect(el.textContent).toContain('المستوى 4 من 15');
		const hero = el.querySelector('.rk-hero') as HTMLElement;
		expect(hero.style.getPropertyValue('--lvl-dark').toLowerCase()).toBe(levelColor('PROVIDER', 4, 'dark').toLowerCase());
	});

	it('static: the template no longer hard-codes the old single badge colour or the ladder size / ends', () => {
		const html = readFileSync(join(__dirname, 'level.html'), 'utf8');
		expect(html).not.toContain('#7BA7D4');
		expect(html).not.toContain('15 مستوى · من مبتدئ إلى مرجع');
		expect(html).not.toMatch(/من 15<|من 15 مستوى<|— 15 مستوى/);
	});
});
