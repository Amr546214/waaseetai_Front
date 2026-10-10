import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { of, throwError, BehaviorSubject } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { ProfileLevel } from './profile-level';
import { GamificationService, ClientLevelResponse } from '../../../../../core/services/gamification.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { levelColor } from '../../../../../core/levels/level-colors';

// The client's own level page: the cashback ladder from the backend (GET /profiles/level-details). On any failure it shows an honest
// "unavailable" state; it never shows made-up progress and never uses provider wording (commission).
const NAMES = ['زائر', 'مستكشف', 'باحث', 'عميل', 'داعم', 'ناشط', 'فعال', 'راعي', 'سفير', 'استراتيجي', 'أساسي', 'مالك', 'مؤسس', 'دائم', 'مؤسسي'];
const CASHBACK = [1, 1.5, 2, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.2, 4.4, 4.6, 4.8, 5];
const POINTS = [0, 51, 151, 301, 501, 751, 1101, 1501, 2001, 2601, 3301, 4101, 5001, 6001, 7201];
const PROJECTS = [0, 2, 5, 9, 13, 17, 23, 31, 41, 51, 61, 73, 86, 101, 116];
const RATING = [0, 3.5, 3.8, 4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.5, 4.5, 4.6, 4.7, 4.8, 4.9];

const payload = (current = 1, limitations: string[] = ['CLIENT_POINTS_NOT_AWARDED', 'CLIENT_RATING_NOT_AVAILABLE', 'CASHBACK_NOT_CREDITED_YET']): ClientLevelResponse => ({
	currentStats: { points: 0, completedProjects: 0, avgRating: null, cashbackRate: CASHBACK[current - 1] },
	currentLevel: { index: current, title: NAMES[current - 1] },
	nextLevelProgress: { title: NAMES[Math.min(current, 14)], pointsGap: POINTS[Math.min(current, 14)], projectsGap: PROJECTS[Math.min(current, 14)], ratingRequired: RATING[Math.min(current, 14)], pointsPercent: 0, projectsPercent: 0, nextCashbackRate: CASHBACK[Math.min(current, 14)] },
	roadmap: NAMES.map((title, i) => ({ index: i + 1, title, reqPoints: POINTS[i], reqProjects: PROJECTS[i], reqRating: RATING[i], rate: CASHBACK[i], station: Math.ceil((i + 1) / 3), color: { dark: levelColor('CLIENT', i + 1, 'dark'), light: levelColor('CLIENT', i + 1, 'light') }, isCurrent: i + 1 === current })),
	limitations,
});

describe('ProfileLevel (client)', () => {
	let isInitialized$: BehaviorSubject<boolean>;
	function setup(stub: Partial<GamificationService>) {
		isInitialized$ = new BehaviorSubject<boolean>(false);
		TestBed.configureTestingModule({
			imports: [ProfileLevel],
			providers: [
				{ provide: GamificationService, useValue: stub },
				{ provide: AuthStore, useValue: { isInitialized$, currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }) } },
				{ provide: PLATFORM_ID, useValue: 'browser' },
			],
		});
		return TestBed.createComponent(ProfileLevel);
	}
	const render = (data: ClientLevelResponse) => {
		const f = setup({ getClientLevelDetails: () => of({ success: true, data }) });
		f.detectChanges(); isInitialized$.next(true); f.detectChanges();
		return f.nativeElement as HTMLElement;
	};
	const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

	it('renders the client ladder: name, cashback %, level N of 15, and the 15 level names with their cashback', () => {
		const el = render(payload(1));
		expect(q(el, 'level-name')!.textContent).toContain('زائر');
		expect(q(el, 'level-percent')!.textContent).toContain('نسبة الكاش باك 1%');
		expect(q(el, 'level-index')!.textContent).toContain('المستوى 1 من 15');
		const nodes = Array.from(el.querySelectorAll('[data-testid="level-roadmap"] [data-level]'));
		expect(nodes.length).toBe(15);
		expect(nodes.map(n => n.querySelector('.lad-node-n')!.textContent!.trim())).toEqual(NAMES);
		expect(nodes.map(n => n.querySelector('.lad-node-p')!.textContent!.trim())).toEqual(CASHBACK.map(c => c + '%'));
		expect(q(el, 'level-subtitle')!.textContent).toContain('من زائر إلى مؤسسي');
	});

	it('the badge and every node carry the brand station colour of the CLIENT family (dark and light pair)', () => {
		const el = render(payload(4));
		const badge = q(el, 'level-badge')!.parentElement as HTMLElement;
		expect(badge.style.getPropertyValue('--lvl-dark').toLowerCase()).toBe(levelColor('CLIENT', 4, 'dark').toLowerCase());
		expect(badge.style.getPropertyValue('--lvl-light').toLowerCase()).toBe(levelColor('CLIENT', 4, 'light').toLowerCase());
		const node15 = el.querySelector('[data-level="15"]') as HTMLElement;
		expect(node15.style.getPropertyValue('--lvl-dark').toLowerCase()).toBe(levelColor('CLIENT', 15, 'dark').toLowerCase());
	});

	it('progress toward the next level shows the real gap (points / projects / required rating); the top level shows none', () => {
		const el = render(payload(1));
		expect(q(el, 'level-next')!.textContent).toContain('مستكشف');
		expect(q(el, 'progress-points')!.textContent).toContain('0 / 51');
		expect(q(el, 'progress-projects')!.textContent).toContain('0 / 2');
		expect(q(el, 'progress-rating')!.textContent).toContain('3.5');
		TestBed.resetTestingModule();
		const top = render(payload(15));
		expect(q(top, 'level-next')).toBeNull();
		expect(top.querySelector('[data-testid^="progress-"]')).toBeNull();
	});

	it('says honestly what is not live yet (no client points / rating / cashback credit) and shows no provider wording', () => {
		const el = render(payload(1));
		const notes = q(el, 'level-notices')!.textContent!;
		expect(notes).toContain('نقاط طالب الخدمة لا تُحتسب تلقائيًا بعد');
		expect(notes).toContain('لا يُضاف إلى محفظتك تلقائيًا بعد');
		expect(el.textContent).not.toContain('عمولة منصة');
		expect(el.textContent).not.toContain('توصية الذكاء');
		TestBed.resetTestingModule();
		expect(q(render(payload(1, [])), 'level-notices')).toBeNull();
	});

	it('never shows made-up progress on a failed response or an HTTP error: the honest unavailable state', () => {
		for (const stub of [{ getClientLevelDetails: () => of({ success: false, data: undefined as any }) }, { getClientLevelDetails: () => throwError(() => ({ status: 403 })) }]) {
			const f = setup(stub);
			f.detectChanges(); isInitialized$.next(true); f.detectChanges();
			const c = f.componentInstance;
			expect(c.levelData()).toBeNull();
			expect(c.loadError()).toBe(true);
			expect((f.nativeElement as HTMLElement).textContent).toContain('غير متاح لحسابات العملاء');
			expect(q(f.nativeElement, 'level-ladder')).toBeNull();
			TestBed.resetTestingModule();
		}
	});
});
