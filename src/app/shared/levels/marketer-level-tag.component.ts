import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface MarketerLevelSummary {
	tier?: string | null;
	level?: number | null;
	commissionPercent?: number | null;
	levelColor?: { dark: string; light: string } | null;
}

/**
 * The marketer's level tag: the level NAME from the backend ladder (never a typed fallback like "مساعد": with no data nothing is claimed), the
 * level colour (dark/light pair switched by the page theme) and the commission percentage of that level.
 */
@Component({
	selector: 'ws-marketer-level',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (summary()?.tier; as name) {
		<span class="ws-level-tag mlv" data-testid="marketer-level" [style.--lvl-dark]="summary()?.levelColor?.dark || '#9B8B7A'" [style.--lvl-light]="summary()?.levelColor?.light || '#7A6B5A'">{{ name }}</span>
		@if (summary()?.level; as lv) { <span class="mlv-meta" data-testid="marketer-level-index">المستوى {{ lv }} من 15</span> }
		@if (summary()?.commissionPercent !== null && summary()?.commissionPercent !== undefined) { <span class="mlv-meta" data-testid="marketer-level-percent">· نسبة العمولة {{ summary()?.commissionPercent }}%</span> }
		}
	`,
	styles: [`
		.mlv{font-size:14px;font-weight:900;color:var(--lvl-dark);border-color:color-mix(in srgb,var(--lvl-dark) 40%,transparent)}
		:host-context(.light-theme) .mlv,:host-context(.theme-light) .mlv{color:var(--lvl-light);border-color:color-mix(in srgb,var(--lvl-light) 40%,transparent)}
		.mlv-meta{font-size:11px;color:var(--txt-3,#8a94b8);font-weight:700;margin-inline-start:6px}
	`],
})
export class MarketerLevelTagComponent {
	readonly summary = input<MarketerLevelSummary | null | undefined>(null);
}
