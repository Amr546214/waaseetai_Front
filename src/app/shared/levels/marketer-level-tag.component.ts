import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LevelBadgeComponent } from './level-badge.component';
import { levelDisplayFromInfo, type LevelDisplay } from '../../core/levels/level-display';

export interface MarketerLevelSummary {
	tier?: string | null;
	level?: number | null;
	commissionPercent?: number | null;
	levelColor?: { dark: string; light: string } | null;
}

/**
 * The marketer's level badge: the marketer summary (name from the backend ladder, never a typed fallback like "مساعد": with no data nothing is
 * claimed) drawn through the SAME shared badge every role uses (star, colour pair, "المستوى N من 15", commission percentage).
 */
@Component({
	selector: 'ws-marketer-level',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [LevelBadgeComponent],
	template: `<span data-testid="marketer-level"><ws-level-badge [level]="display()" [variant]="variant()" [showIndex]="variant() === 'tag'" [showPercent]="variant() === 'tag'" /></span>`,
})
export class MarketerLevelTagComponent {
	readonly variant = input<'tag' | 'icon'>('tag');
	readonly summary = input<MarketerLevelSummary | null | undefined>(null);
	protected readonly display = computed<LevelDisplay | null>(() => {
		const s = this.summary();
		if (!s?.tier || !s.level) return null;
		return levelDisplayFromInfo({ role: 'MARKETER', index: s.level, total: 15, name: s.tier, percent: s.commissionPercent ?? undefined, percentKind: s.commissionPercent == null ? undefined : 'EARNED_COMMISSION', color: s.levelColor ?? undefined });
	});
}
