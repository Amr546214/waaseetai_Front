import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { JoinMarketerComponent } from './join-marketer.component';
import { LevelsService, LevelsPayload, LevelRow } from '../../../../core/levels/levels.service';

// The public marketer page shows the OFFICIAL ladder (نظام النقاط و الولاء.xlsx: 1% -> 4.5%), read from the backend; never the retired 3%-18%.
const row = (level: number, name: string, percent: number): LevelRow => ({ level, name, percent, station: Math.ceil(level / 3), color: { dark: '#F5A314', light: '#C47F08' }, thresholds: { points: 0 } });
const payload = { roles: { MARKETER: { levels: [row(1, 'مسوق', 1), row(8, 'موجه', 3), row(15, 'رابط مؤسسي', 4.5)] }, PROVIDER: { levels: [] }, CLIENT: { levels: [] } } } as unknown as LevelsPayload;

describe('join-marketer: the ladder comes from the backend table', () => {
	const mount = (p: LevelsPayload | null) => {
		const levelsStub = {
			payload: signal(p), ensureLoaded: () => undefined,
			range: () => () => (p ? { min: 1, max: 4.5 } : null),
			level: (_r: string, n: number) => p?.roles.MARKETER.levels.find(l => l.level === n) ?? null,
		};
		TestBed.configureTestingModule({ imports: [JoinMarketerComponent], providers: [provideRouter([]), { provide: LevelsService, useValue: levelsStub }] });
		const f = TestBed.createComponent(JoinMarketerComponent);
		f.detectChanges();
		return f.nativeElement as HTMLElement;
	};
	afterEach(() => TestBed.resetTestingModule());

	it('shows 1–4.5٪, the three tiers with their real percentages, and an example computed from level 8 (3% of 5000 = 150)', () => {
		const el = mount(payload);
		const text = el.textContent || '';
		expect(el.querySelector('.comm-big')!.textContent!.trim()).toBe('1–4.5٪');
		expect(text).toContain('مسوق'); expect(text).toContain('1٪');
		expect(text).toContain('موجه'); expect(text).toContain('3٪');
		expect(text).toContain('رابط مؤسسي'); expect(text).toContain('4.5٪');
		expect(text).toContain('+150 ر');
		expect(text).toContain('عمولة 3٪ على خدمة 5000 ر');
	});

	it('never the retired numbers: no 3–18, no 18٪, no 10٪ example', () => {
		const text = mount(payload).textContent || '';
		for (const old of ['3–18', '18٪', 'عمولة 10٪', '+500 ر', 'حتى 18']) expect(text).not.toContain(old);
	});

	it('before / without the table: no percentage and no tier is shown (nothing is typed)', () => {
		const el = mount(null);
		expect(el.querySelector('.comm-big')!.textContent!.trim()).toBe('');
		expect(el.querySelectorAll('.tiers-grid > *').length).toBe(0);
		expect(el.textContent).not.toContain('+150 ر');
	});
});
