import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** What the ladder card needs: every number comes from the backend (the level tables, the user's real stats); the card only lays them out. */
export interface LevelLadderView {
	/** 'نسبة الكاش باك' (client) / 'عمولة المنصة' (provider) / 'نسبة العمولة' (marketer) */
	percentLabel: string;
	current: { index: number; title: string; percent: number; color: { dark: string; light: string } };
	next: { title: string; percent: number } | null;
	stats: Array<{ label: string; value: string }>;
	progress: Array<{ key: string; label: string; have: string; need: string; percent: number }>;
	roadmap: Array<{ index: number; title: string; percent: number; color: { dark: string; light: string }; isCurrent: boolean; lines: string[] }>;
	/** honest notes (what is not live yet); never invented progress */
	notices: string[];
}

/**
 * The level card shared by the levels pages: star icon in the level colour (+ progress dots), name, "level N of 15", the level's percentage, the
 * remaining gap per requirement and the 15-level roadmap. Colours are passed as a dark/light pair and switched by the page theme with CSS only.
 */
@Component({
	selector: 'ws-level-ladder',
	standalone: true,
	imports: [CommonModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (view(); as v) {
		<section class="lad" data-testid="level-ladder">
			<div class="lad-hero" [style.--lvl-dark]="v.current.color.dark" [style.--lvl-light]="v.current.color.light">
				<div class="lad-badge lvl-bd" data-testid="level-badge">
					<svg class="lvl-fill" width="30" height="30" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 5 L61.8 36.7 L95.1 36.7 L68.6 57.1 L79.4 88.8 L50 70.3 L20.6 88.8 L31.4 57.1 L4.9 36.7 L38.2 36.7 Z"/></svg>
					<div class="lad-badge-name lvl-txt" data-testid="level-name">{{ v.current.title }}</div>
				</div>
				<div class="lad-main">
					<div class="lad-k">مستواك الحالي</div>
					<div class="lad-row">
						<span class="lad-pill lvl-bd lvl-txt" data-testid="level-percent">{{ v.percentLabel }} {{ v.current.percent }}%</span>
						<span class="lad-muted" data-testid="level-index">المستوى {{ v.current.index }} من {{ v.roadmap.length }}</span>
						@if (v.next) { <span class="lad-muted" data-testid="level-next">التالي: {{ v.next.title }} ({{ v.next.percent }}%)</span> }
					</div>
					<div class="lad-dots" aria-hidden="true">
						@for (i of dots; track i) { <span class="lad-dot" [class.on]="i <= stationOf(v.current.index)"></span> }
					</div>
				</div>
				<div class="lad-stats">
					@for (s of v.stats; track s.label) { <div class="lad-stat"><div class="lad-stat-v">{{ s.value }}</div><div class="lad-stat-l">{{ s.label }}</div></div> }
				</div>
			</div>

			@if (v.notices.length) {
			<ul class="lad-notes" data-testid="level-notices" role="note">@for (n of v.notices; track n) { <li>{{ n }}</li> }</ul>
			}

			@if (v.next) {
			<div class="lad-card">
				<div class="lad-h">المتبقي للوصول إلى {{ v.next.title }}</div>
				@for (p of v.progress; track p.key) {
				<div class="lad-prog" [attr.data-testid]="'progress-' + p.key">
					<div class="lad-prog-t"><span>{{ p.label }}</span><span class="lad-muted">{{ p.have }} / {{ p.need }}</span></div>
					<div class="lad-bar"><div class="lad-bar-f" [style.width.%]="p.percent"></div></div>
				</div>
				}
			</div>
			}

			<div class="lad-card">
				<div class="lad-h">خريطة المستويات — {{ v.roadmap.length }} مستوى</div>
				<div class="lad-map" data-testid="level-roadmap">
					@for (l of v.roadmap; track l.index) {
					<div class="lad-node" [class.cur]="l.isCurrent" [class.up]="l.index > v.current.index" [style.--lvl-dark]="l.color.dark" [style.--lvl-light]="l.color.light" [attr.data-level]="l.index">
						<div class="lad-node-ic lvl-bd"><svg class="lvl-fill" width="22" height="22" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 5 L61.8 36.7 L95.1 36.7 L68.6 57.1 L79.4 88.8 L50 70.3 L20.6 88.8 L31.4 57.1 L4.9 36.7 L38.2 36.7 Z"/></svg></div>
						<div class="lad-node-n lvl-txt">{{ l.title }}</div>
						<div class="lad-node-p">{{ l.percent }}%</div>
						@for (line of l.lines; track line) { <div class="lad-node-l">{{ line }}</div> }
					</div>
					}
				</div>
			</div>
		</section>
		}
	`,
	styles: [`
		.lad{display:flex;flex-direction:column;gap:16px}
		.lvl-txt{color:var(--lvl-dark)} .lvl-fill{fill:var(--lvl-dark)} .lvl-bd{border-color:var(--lvl-dark);background:color-mix(in srgb,var(--lvl-dark) 14%,transparent)}
		:host-context(.light-theme) .lvl-txt,:host-context(.theme-light) .lvl-txt{color:var(--lvl-light)}
		:host-context(.light-theme) .lvl-fill,:host-context(.theme-light) .lvl-fill{fill:var(--lvl-light)}
		:host-context(.light-theme) .lvl-bd,:host-context(.theme-light) .lvl-bd{border-color:var(--lvl-light);background:color-mix(in srgb,var(--lvl-light) 14%,transparent)}
		.lad-hero{display:flex;align-items:center;gap:20px;flex-wrap:wrap;padding:20px;border-radius:18px;border:1px solid var(--sec-bd,rgba(255,255,255,.1));background:var(--crd-bg,linear-gradient(135deg,rgba(255,255,255,.05),rgba(255,255,255,.01)))}
		.lad-badge{width:92px;height:92px;border-radius:50%;border:2px solid;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;flex-shrink:0}
		.lad-badge-name{font-size:11px;font-weight:900;text-align:center;line-height:1.2;padding:0 6px}
		.lad-main{flex:1;min-width:220px}.lad-k{font-size:11px;font-weight:800;color:var(--txt-3,#8a94b8);margin-bottom:6px}
		.lad-row{display:flex;gap:8px 12px;align-items:center;flex-wrap:wrap}
		.lad-pill{font-size:12px;font-weight:800;border:1px solid;border-radius:999px;padding:3px 12px}
		.lad-muted{font-size:11.5px;color:var(--txt-3,#8a94b8);font-weight:700}
		.lad-dots{display:flex;gap:6px;margin-top:10px}.lad-dot{width:8px;height:8px;border-radius:50%;background:var(--sec-bd,rgba(255,255,255,.16))}
		.lad-dot.on{background:var(--lvl-dark)} :host-context(.light-theme) .lad-dot.on,:host-context(.theme-light) .lad-dot.on{background:var(--lvl-light)}
		.lad-stats{display:flex;gap:18px;flex-wrap:wrap}.lad-stat-v{font-size:20px;font-weight:900;color:var(--txt,#fff)}.lad-stat-l{font-size:10.5px;color:var(--txt-3,#8a94b8);font-weight:700;margin-top:2px}
		.lad-notes{margin:0;padding:12px 18px;list-style:disc inside;border-radius:12px;border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.08);font-size:12px;font-weight:700;color:var(--txt-2,#c3cbe6);line-height:1.8}
		.lad-card{padding:18px;border-radius:16px;border:1px solid var(--sec-bd,rgba(255,255,255,.1));background:var(--crd-bg,linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01)))}
		.lad-h{font-size:13px;font-weight:900;color:var(--txt,#fff);margin-bottom:12px}
		.lad-prog{margin-bottom:12px}.lad-prog-t{display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:var(--txt-2,#c3cbe6);margin-bottom:6px}
		.lad-bar{height:8px;border-radius:999px;background:var(--sec-bd,rgba(255,255,255,.1));overflow:hidden}.lad-bar-f{height:100%;border-radius:999px;background:linear-gradient(90deg,#2BD4C7,#2B7FFF)}
		.lad-map{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:12px}
		.lad-node{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;padding:10px 6px;border-radius:12px;border:1px solid transparent}
		.lad-node.cur{border-color:var(--lvl-dark);background:color-mix(in srgb,var(--lvl-dark) 10%,transparent)}
		:host-context(.light-theme) .lad-node.cur,:host-context(.theme-light) .lad-node.cur{border-color:var(--lvl-light);background:color-mix(in srgb,var(--lvl-light) 10%,transparent)}
		.lad-node.up{opacity:.62}.lad-node-ic{width:44px;height:44px;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center}
		.lad-node-n{font-size:11.5px;font-weight:900}.lad-node-p{font-size:11px;font-weight:800;color:var(--txt-2,#c3cbe6)}.lad-node-l{font-size:10px;color:var(--txt-3,#8a94b8)}
		@media(max-width:640px){.lad-hero{padding:14px}.lad-badge{width:76px;height:76px}.lad-map{grid-template-columns:repeat(auto-fill,minmax(96px,1fr))}}
	`],
})
export class LevelLadderComponent {
	readonly view = input<LevelLadderView | null>(null);
	readonly dots = [1, 2, 3, 4, 5];
	stationOf(level: number): number { return Math.min(5, Math.max(1, Math.ceil(level / 3))); }
}
