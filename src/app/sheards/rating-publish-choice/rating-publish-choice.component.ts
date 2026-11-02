import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { PUBLISH_EXPLAIN_AR } from '../../core/models/rating.model';

/**
 * The «نشر التقييم» choice, explained BEFORE the review is submitted. It is a real choice: the value is sent as `publish` and the server stores it
 * (published = shown in the public profile with text, tags and the reviewer's name; unpublished = visible only to both parties and the admin).
 * Used by the client and provider rating pages (project and stage mode). `target` only changes whose public profile the label names.
 */
@Component({
	selector: 'app-rating-publish-choice',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
<div class="rpc" data-testid="publish-choice">
	<label class="rpc-row">
		<input type="checkbox" [checked]="value()" (change)="value.set($any($event.target).checked)" data-testid="publish-checkbox" />
		<span>{{ target() === 'client' ? 'نشر التقييم في ملف العميل العام' : 'نشر التقييم في ملف مقدّم الخدمة العام' }}</span>
	</label>
	<ul class="rpc-explain" data-testid="publish-explain">
		<li [class.rpc-on]="value()" data-testid="publish-explain-on">{{ explainOn() }}</li>
		<li [class.rpc-on]="!value()" data-testid="publish-explain-off">{{ explainOff }}</li>
	</ul>
</div>`,
	styles: [`
:host{display:block}
.rpc{margin:8px 0 14px}
.rpc-row{display:flex;gap:8px;align-items:center;font-size:var(--font-size-label);font-weight:700;cursor:pointer}
.rpc-explain{list-style:none;margin:8px 0 0;padding:0;font-size:var(--font-size-small);line-height:1.7;opacity:.75}
.rpc-explain li{padding-inline-start:4px}
.rpc-explain li.rpc-on{opacity:1;font-weight:700;color:#2BD4C7}
`]
})
export class RatingPublishChoice {
	/** Whose public profile the review would appear in. */
	readonly target = input<'provider' | 'client'>('provider');
	/** true = publish (default). Two-way: `[(value)]="publish"`. */
	readonly value = model<boolean>(true);
	readonly explainOff = PUBLISH_EXPLAIN_AR.unpublished;
	explainOn(): string {
		return this.target() === 'client' ? PUBLISH_EXPLAIN_AR.published.replace('لمقدّم الخدمة', 'للعميل') : PUBLISH_EXPLAIN_AR.published;
	}
}
