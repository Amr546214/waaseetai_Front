import { Component, DestroyRef, ElementRef, HostListener, inject, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { AffiliateApiService, AffiliateSummary } from '../../../../core/services/affiliate-api.service';

const MIN_QUERY_LENGTH = 2;

type SearchOutcome = { query: string; results: AffiliateSummary[]; error: boolean; short: boolean };

/**
 * Optional referral-marketer picker for the registration form (P-LG-012: single-tier direct referral): ONE typeahead
 * field that accepts a marketer's name or a referral code/slug.
 *
 * - under 2 characters: no request, no results;
 * - 2+ characters: GET /affiliates/search (name or slug), shown as small cards (avatar/initials, name, slug, level,
 *   "موثق" badge); when nothing matches, the typed text is tried once as an exact code via /affiliates/resolve;
 * - a typed full slug/code (or a clicked card) selects that marketer: a selected card with a clear button replaces the
 *   field and `value` becomes the marketer's referralSlug (the id only if the slug is missing);
 * - `value` stays null until a marketer is selected/resolved, so the parent sends `affiliateIdentifier` only then;
 * - a failing search shows a light message and never blocks registration.
 * Never required, never blocks submission.
 */
@Component({
	selector: 'app-affiliate-picker',
	standalone: true,
	imports: [FormsModule],
	templateUrl: './affiliate-picker.html',
	styleUrl: './affiliate-picker.css',
})
export class AffiliatePicker {
	private api = inject(AffiliateApiService);
	private host = inject(ElementRef<HTMLElement>);
	private destroyRef = inject(DestroyRef);

	/** The identifier the parent submits as `affiliateIdentifier` (a referralSlug); null = nothing selected. */
	value = model<string | null>(null);

	query = signal('');
	results = signal<AffiliateSummary[]>([]);
	selected = signal<AffiliateSummary | null>(null);
	searching = signal(false);
	searchError = signal(false);
	open = signal(false);
	/** The (trimmed) query the last finished search answered, so "no results" never flashes while a search is pending. */
	answeredQuery = signal('');

	private terms = new Subject<string>();

	constructor() {
		this.terms
			.pipe(
				debounceTime(300),
				distinctUntilChanged(),
				switchMap((q): Observable<SearchOutcome> => {
					const trimmed = q.trim();
					if (trimmed.length < MIN_QUERY_LENGTH) {
						this.searching.set(false);
						return of({ query: trimmed, results: [], error: false, short: true });
					}
					this.searching.set(true);
					return this.api.search(trimmed).pipe(
						map((res) => (res.success ? res.data ?? [] : [])),
						// Nothing matched by name/slug: the text may be an exact code or an id, so try it once as such.
						switchMap((found) => found.length
							? of(found)
							: this.api.resolve(trimmed).pipe(
								map((res) => (res.success && res.data ? [res.data] : [])),
								catchError(() => of<AffiliateSummary[]>([]))
							)),
						map((found): SearchOutcome => ({ query: trimmed, results: found, error: false, short: false })),
						catchError(() => of<SearchOutcome>({ query: trimmed, results: [], error: true, short: false }))
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((outcome) => {
				this.searching.set(false);
				if (this.selected()) return; // a selection was made while the request was in flight
				this.searchError.set(outcome.error);
				this.results.set(outcome.results);
				this.answeredQuery.set(outcome.query);
				// A full slug / code / id typed in the field selects that marketer.
				const lower = outcome.query.toLowerCase();
				const exact = outcome.results.find((r) => r.referralSlug?.toLowerCase() === lower || r.id === outcome.query);
				if (exact) this.pickResult(exact);
			});
	}

	onInput(raw: string) {
		this.query.set(raw);
		this.open.set(true);
		if (raw.trim().length < MIN_QUERY_LENGTH) {
			this.results.set([]);
			this.searchError.set(false);
			this.searching.set(false);
		}
		this.terms.next(raw);
	}

	openPanel() {
		this.open.set(true);
	}

	pickResult(affiliate: AffiliateSummary) {
		this.selected.set(affiliate);
		this.value.set(affiliate.referralSlug || affiliate.id);
		this.open.set(false);
		this.query.set('');
		this.results.set([]);
		this.searchError.set(false);
		this.answeredQuery.set('');
	}

	clearSelection() {
		this.selected.set(null);
		this.value.set(null);
		this.query.set('');
		this.results.set([]);
		this.searchError.set(false);
		this.answeredQuery.set('');
	}

	/** Up to two initials for the avatar fallback. */
	initials(name: string): string {
		const parts = (name || '').trim().split(/\s+/).filter(Boolean);
		return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[1][0] : '')).toUpperCase() || '؟';
	}

	/** True when the panel should say "no marketer matches": a real query whose search finished with no results and no error. */
	showEmpty(): boolean {
		const q = this.query().trim();
		return q.length >= MIN_QUERY_LENGTH && !this.searching() && !this.searchError() && this.results().length === 0 && this.answeredQuery() === q;
	}

	@HostListener('document:click', ['$event'])
	onDocClick(ev: MouseEvent): void {
		if (this.open() && !this.host.nativeElement.contains(ev.target as Node)) {
			this.open.set(false);
		}
	}

	@HostListener('keydown.escape')
	onEscape(): void {
		this.open.set(false);
	}
}
