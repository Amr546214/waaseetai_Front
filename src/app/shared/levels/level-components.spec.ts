import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { describe, it, expect } from 'vitest';
import { MarketerLevelTagComponent, MarketerLevelSummary } from './marketer-level-tag.component';
import { levelColor } from '../../core/levels/level-colors';

@Component({ standalone: true, imports: [MarketerLevelTagComponent], template: `<ws-marketer-level [summary]="s" />` })
class Host { s: MarketerLevelSummary | null = null; }

describe('ws-marketer-level', () => {
	const mount = (s: MarketerLevelSummary | null) => {
		TestBed.configureTestingModule({ imports: [Host] });
		const f = TestBed.createComponent(Host);
		f.componentInstance.s = s; f.detectChanges();
		return f.nativeElement as HTMLElement;
	};
	const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

	it('shows the backend level name, "level N of 15" and the commission percentage with the brand colour pair', () => {
		const el = mount({ tier: 'موجه', level: 8, commissionPercent: 3, levelColor: { dark: levelColor('MARKETER', 8, 'dark'), light: levelColor('MARKETER', 8, 'light') } });
		expect(q(el, 'marketer-level')!.textContent).toContain('موجه');
		expect(q(el, 'marketer-level-index')!.textContent).toContain('المستوى 8 من 15');
		expect(q(el, 'marketer-level-percent')!.textContent).toContain('نسبة العمولة 3%');
		const tag = q(el, 'marketer-level')!;
		expect(tag.style.getPropertyValue('--lvl-dark').toLowerCase()).toBe('#f5a314');
		expect(tag.style.getPropertyValue('--lvl-light').toLowerCase()).toBe(levelColor('MARKETER', 8, 'light').toLowerCase());
	});

	it('claims nothing without data: no name, no typed fallback (the old "مساعد"), no percentage', () => {
		for (const s of [null, {}, { tier: null }]) {
			TestBed.resetTestingModule();
			const el = mount(s as any);
			expect(el.textContent!.trim()).toBe('');
			expect(el.textContent).not.toContain('مساعد');
		}
	});

	it('a level without a percentage in the payload shows the name only', () => {
		const el = mount({ tier: 'مسوق', level: 1 });
		expect(q(el, 'marketer-level')!.textContent).toContain('مسوق');
		expect(q(el, 'marketer-level-percent')).toBeNull();
	});
});
