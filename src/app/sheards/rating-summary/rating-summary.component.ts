import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { RatingApiService } from '../../core/services/rating-api.service';
import { RatingStatus } from '../../core/models/rating.model';
import { RatingSavedCard } from '../rating-saved-card/rating-saved-card.component';

/**
 * Read-only ratings of ONE target inside its project page, from the server (never invented):
 *  - scope project (no stageId): «تقييمك للطرف الآخر» (the review this user saved) and «تقييم الطرف الآخر لك» (the counterpart's), each only when it exists;
 *  - scope stage (stageId set):  the stage's review (client: its own; provider: the client's) — a stage review is never drawn in the project slots.
 * Nothing at all is drawn while loading, or when no review exists (no empty box, no default stars). A failed read shows a retry, never "no rating".
 * An unpublished review is shown here to the two parties (the server only answers to them); its visibility label says so.
 */
@Component({
	selector: 'app-rating-summary',
	standalone: true,
	imports: [RatingSavedCard],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
@if (state() === 'error') {
	<button type="button" class="rs-retry" (click)="load()" data-testid="rating-summary-retry">تعذر قراءة التقييم، إعادة المحاولة</button>
} @else if (state() === 'ready') {
	@if (stageId()) {
		@if (status()?.review; as mine) { <app-rating-saved-card [review]="mine" label="تقييمك للمرحلة" data-testid="rs-stage-mine" /> }
		@if (status()?.counterpart; as other) { <app-rating-saved-card [review]="other" label="تقييم العميل لهذه المرحلة" commentLabel="تعليق العميل" data-testid="rs-stage-counterpart" /> }
	} @else {
		@if (status()?.review; as mine) { <app-rating-saved-card [review]="mine" [label]="side() === 'client' ? 'تقييمك لمقدّم الخدمة' : 'تقييمك للعميل'" data-testid="rs-final-mine" /> }
		@if (status()?.counterpart; as other) { <app-rating-saved-card [review]="other" [label]="side() === 'client' ? 'تقييم مقدّم الخدمة لك' : 'تقييم العميل لك'" [commentLabel]="side() === 'client' ? 'تعليق مقدّم الخدمة' : 'تعليق العميل'" data-testid="rs-final-counterpart" /> }
	}
}`,
	styles: [`:host{display:block}.rs-retry{background:none;border:1px dashed currentColor;border-radius:10px;padding:6px 12px;font-size:var(--font-size-small);cursor:pointer;color:inherit}`]
})
export class RatingSummary implements OnInit {
	private api = inject(RatingApiService);
	private destroyRef = inject(DestroyRef);
	readonly side = input<'client' | 'provider'>('client');
	/** project id or contract id */
	readonly key = input.required<string>();
	readonly stageId = input<string | null>(null);
	readonly status = signal<RatingStatus | null>(null);
	readonly state = signal<'loading' | 'ready' | 'error'>('loading');

	ngOnInit() { this.load(); }

	load() {
		this.state.set('loading');
		const stage = this.stageId();
		const read: Observable<RatingStatus> = stage
			? (this.side() === 'provider' ? this.api.getProviderStageRatingStatus(this.key(), stage) : this.api.getStageRatingStatus(this.key(), stage))
			: this.api.getRatingStatus(this.side(), this.key());
		read.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: st => { this.status.set(st); this.state.set('ready'); },
			// 404 on a STAGE read = the server has no such read (an older server for the provider's stage view, or a stage that is gone): nothing to draw, and a retry would never help
			error: (e) => { this.status.set(null); this.state.set(stage && e?.status === 404 ? 'ready' : 'error'); },
		});
	}
}
