import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LEVEL_STAR_PATH, PERCENT_LABEL, providerLevelDisplayFromTitle, type LevelDisplay } from '../../core/levels/level-display';

/**
 * THE level badge, used by every page and every role (dashboard cards, level pages, public profile, marketplace cards, sidebar-size chips): the same star
 * icon, the same colour pair (dark/light switched by the page theme with CSS only), the same name text. Variants only change the size:
 *   tag  - a compact pill (star + name), optionally with the percentage and "level N of 15"
 *   hero - the large round badge of the level pages
 * Nothing about a level is typed in a page: the page passes a LevelDisplay (core/levels/level-display.ts) and this component draws it.
 */
@Component({
	selector: 'ws-level-badge',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (display(); as l) {
		@if (variant() === 'icon') {
		<span class="wlb wlb-icon" [style.--lvl-dark]="l.color.dark" [style.--lvl-light]="l.color.light" data-testid="level-icon" [attr.data-level-index]="l.index"><svg width="22" height="22" viewBox="0 0 100 100" aria-hidden="true" class="wlb-star"><path [attr.d]="star" /></svg></span>
		} @else if (variant() === 'hero') {
		<span class="wlb wlb-hero" [style.--lvl-dark]="l.color.dark" [style.--lvl-light]="l.color.light" data-testid="level-badge" [attr.data-level-index]="l.index">
			<svg class="wlb-star" width="30" height="30" viewBox="0 0 100 100" aria-hidden="true"><path [attr.d]="star" /></svg>
			<span class="wlb-name" data-testid="level-name">{{ l.name }}</span>
		</span>
		} @else {
		<span class="wlb wlb-tag" [class.wlb-overlay]="surface() === 'overlay'" [style.--lvl-dark]="l.color.dark" [style.--lvl-light]="l.color.light" data-testid="level-badge" [attr.data-level-index]="l.index" [attr.data-role]="l.role">
			<svg class="wlb-star" width="13" height="13" viewBox="0 0 100 100" aria-hidden="true"><path [attr.d]="star" /></svg>
			<span class="wlb-name" data-testid="level-name">{{ l.name }}</span>
		</span>
		@if (showIndex() && l.index) { <span class="wlb-meta" data-testid="level-index">المستوى {{ l.index }} من {{ l.total }}</span> }
		@if (showPercent() && percentText(); as p) { <span class="wlb-meta" data-testid="level-percent">{{ p }}</span> }
		}
		}
	`,
	styles: [`
		:host{display:inline-flex;align-items:center;flex-wrap:wrap;gap:6px}
		.wlb{--c:var(--lvl-dark);--bd:color-mix(in srgb,var(--lvl-dark) 55%,transparent);--bg:color-mix(in srgb,var(--lvl-dark) 16%,transparent);color:var(--c)}
		:host-context(.light-theme) .wlb,:host-context(.theme-light) .wlb{--c:var(--lvl-light);--bd:color-mix(in srgb,var(--lvl-light) 55%,transparent);--bg:color-mix(in srgb,var(--lvl-light) 14%,transparent)}
		.wlb-icon{display:inline-flex;line-height:0}
		.wlb-star{fill:currentColor;flex-shrink:0}
		.wlb-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;border:1px solid var(--bd);background:var(--bg);font-size:12px;font-weight:900;line-height:1.4;white-space:nowrap}
		.wlb-overlay,:host-context(.light-theme) .wlb-overlay,:host-context(.theme-light) .wlb-overlay{--c:var(--lvl-dark);--bd:color-mix(in srgb,var(--lvl-dark) 55%,transparent);background:rgba(7,13,36,.88);backdrop-filter:blur(4px)}
		.wlb-hero{width:92px;height:92px;border-radius:50%;border:2px solid var(--c);background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;flex-shrink:0}
		.wlb-hero .wlb-name{font-size:11px;font-weight:900;text-align:center;line-height:1.2;padding:0 6px}
		.wlb-meta{font-size:11px;font-weight:700;color:var(--txt-3)}
		@media(max-width:640px){.wlb-hero{width:76px;height:76px}}
	`],
})
export class LevelBadgeComponent {
	readonly level = input<LevelDisplay | null | undefined>(null);
	/** A provider level title ("مبتدئ"...) for pages that only have the label (catalog cards, offers, compare tables): read back to its level. */
	readonly title = input<string | null | undefined>(null);
	/** 'overlay' = the same badge on a solid dark backing, for use over card images. */
	readonly surface = input<'plain' | 'overlay'>('plain');
	readonly variant = input<'tag' | 'hero' | 'icon'>('tag');
	readonly showIndex = input(false);
	readonly showPercent = input(false);
	protected readonly display = computed(() => this.level() ?? providerLevelDisplayFromTitle(this.title()));
	protected readonly star = LEVEL_STAR_PATH;
	protected readonly percentText = computed(() => {
		const l = this.display();
		return l && l.percent !== null && l.percentKind ? `${PERCENT_LABEL[l.percentKind]} ${l.percent}%` : '';
	});
}
