import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SavedReview, VISIBILITY_LABEL_AR } from '../../core/models/rating.model';

/**
 * The review the user saved, READ ONLY: stars and text exactly as stored, the chosen tags and the date. No form, no submit, no skip, no edit
 * (editing a review is not allowed). It never invents a value: nothing is drawn unless a saved review is passed in.
 */
@Component({
	selector: 'app-rating-saved-card',
	standalone: true,
	imports: [CommonModule, DatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
<div class="rsc" dir="rtl" data-testid="saved-rating-card">
	<div class="rsc-row">
		<div class="rsc-lbl">{{ label() }}</div>
		<div class="rsc-stars" dir="ltr" [attr.aria-label]="'التقييم المحفوظ ' + review().rating + ' من 5'" data-testid="saved-rating-stars">
			@for (s of [1, 2, 3, 4, 5]; track s) {
				<svg [class.on]="s <= review().rating" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true"><path d="M50 5 L61.8 36.7 L95.1 36.7 L68.6 57.1 L79.4 88.8 L50 70.3 L20.6 88.8 L31.4 57.1 L4.9 36.7 L38.2 36.7 Z"/></svg>
			}
			<span class="rsc-val" data-testid="saved-rating-value">{{ review().rating }} / 5</span>
		</div>
	</div>
	@if (review().tags.length) {
		<div class="rsc-row" data-testid="saved-rating-tags">
			<div class="rsc-lbl">ما الذي تميّز؟</div>
			<div class="rsc-tags">@for (t of review().tags; track t) { <span class="rsc-tag">{{ t }}</span> }</div>
		</div>
	}
	@if (review().comment) {
		<div class="rsc-row">
			<div class="rsc-lbl">تعليقك</div>
			<div class="rsc-comment" data-testid="saved-rating-comment">{{ review().comment }}</div>
		</div>
	}
	@if (review().isPublic !== undefined) {
		<div class="rsc-vis" [class.rsc-vis--off]="!review().isPublic" data-testid="saved-rating-visibility">{{ review().isPublic ? labels.published : labels.unpublished }}</div>
	}
	<div class="rsc-date" data-testid="saved-rating-date">أُرسل في {{ review().createdAt | date: 'yyyy/MM/dd HH:mm' }}</div>
</div>`,
	styles: [`
:host{display:block}
.rsc{background:linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:18px;margin-bottom:16px}
.rsc-row{margin-bottom:16px}
.rsc-lbl{font-size:13px;font-weight:700;margin-bottom:8px;color:var(--txt,#fff)}
.rsc-stars{display:flex;gap:6px;align-items:center;justify-content:flex-start}
.rsc-stars svg{width:26px;height:26px;color:rgba(128,128,150,.35)}
.rsc-stars svg.on{color:#FFB400}
.rsc-val{font-size:13px;font-weight:800;color:#FFB400;margin-inline-start:8px}
.rsc-tags{display:flex;gap:8px;flex-wrap:wrap}
.rsc-tag{padding:6px 12px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(43,212,199,.12);border:1px solid rgba(43,212,199,.3);color:#2BD4C7}
.rsc-comment{font-size:13px;line-height:1.7;white-space:pre-wrap;color:var(--txt,#fff)}
.rsc-date{font-size:11px;opacity:.7}
.rsc-vis{display:inline-block;margin-bottom:10px;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;background:rgba(43,212,199,.12);color:#2BD4C7}
.rsc-vis--off{background:rgba(255,180,0,.12);color:#FFB400}
`]
})
export class RatingSavedCard {
	readonly labels = VISIBILITY_LABEL_AR;
	readonly review = input.required<SavedReview>();
	readonly label = input<string>('تقييمك');
}
