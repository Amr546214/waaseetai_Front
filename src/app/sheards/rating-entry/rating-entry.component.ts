import { ChangeDetectionStrategy, Component, DestroyRef, Directive, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { RatingApiService } from '../../core/services/rating-api.service';
import { RatingStatus } from '../../core/models/rating.model';

/**
 * Entry points to the rating pages, driven by the SERVER rating status (never by COMPLETED / a stage count):
 *  - eligible and unrated      -> a button «قيّم المشروع» (stage: «قيّم المرحلة»)
 *  - a review already exists   -> a button «عرض تقييمك»
 *  - ineligible / settled      -> NO button; only an (visually hidden) element carrying the server's reason as text + tooltip, so a page can still explain it
 *  - loading                   -> nothing (no flash of a wrong button)
 *  - the status call failed    -> a small «إعادة المحاولة» (an error is never read as "eligible")
 *
 * Inputs (identical for both components):
 *  - side: 'client' | 'provider'  (stage entries are client-only)
 *  - key: the project id or contract id (the same key the rating status endpoints accept)
 *  - stageId (StageRatingEntry only): the stage id
 *  - showReason (optional, default false): also draw the reason text for an ineligible project
 */
function reasonOf(st: RatingStatus | null): string { return st ? (st.adminSettled ? 'أُغلق المشروع بتسوية نزاع، ولا يتاح تقييمه' : st.message) : ''; }


@Directive()
abstract class RatingEntryBase implements OnInit {
	protected api = inject(RatingApiService);
	protected router = inject(Router);
	protected destroyRef = inject(DestroyRef);
	readonly side = input<'client' | 'provider'>('client');
	readonly key = input.required<string>();
	readonly showReason = input<boolean>(false);
	readonly status = signal<RatingStatus | null>(null);
	readonly state = signal<'loading' | 'ready' | 'error'>('loading');
	readonly reason = computed(() => reasonOf(this.status()));
	abstract readonly rateLabel: string;
	protected abstract read(): Observable<RatingStatus>;
	protected abstract route(): string[];

	ngOnInit() { this.load(); }

	load() {
		this.state.set('loading');
		this.read().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: st => { this.status.set(st); this.state.set('ready'); },
			error: () => { this.status.set(null); this.state.set('error'); },
		});
	}

	open() { this.router.navigate(this.route()); }
}

/** Project-level rating entry (client or provider). */
@Component({ selector: 'app-rating-entry', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, templateUrl: './rating-entry.component.html', styleUrl: './rating-entry.component.css' })
export class RatingEntry extends RatingEntryBase {
	readonly rateLabel = 'قيّم المشروع';
	protected read() { return this.api.getRatingStatus(this.side(), this.key()); }
	protected route() { return this.side() === 'provider' ? ['/provider-overview/projects', this.key(), 'rating'] : ['/client-overview/projects', this.key(), 'rating']; }
}

/** Stage-level rating entry (client only): reads the stage rating status and opens the stage rating page. */
@Component({ selector: 'app-stage-rating-entry', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, templateUrl: './rating-entry.component.html', styleUrl: './rating-entry.component.css' })
export class StageRatingEntry extends RatingEntryBase {
	readonly stageId = input.required<string>();
	readonly rateLabel = 'قيّم المرحلة';
	protected read() { return this.api.getStageRatingStatus(this.key(), this.stageId()); }
	protected route() { return ['/client-overview/projects', this.key(), 'stages', this.stageId(), 'rating']; }
}
