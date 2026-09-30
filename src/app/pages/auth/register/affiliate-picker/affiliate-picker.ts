import { Component, DestroyRef, ElementRef, HostListener, inject, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { AffiliateApiService, AffiliateSummary } from '../../../../core/services/affiliate-api.service';

/**
 * Optional affiliate/referral picker for the registration form (P-LG-012:
 * single-tier direct referral, manual-code and search-by-name methods).
 * Never required, never blocks submission — the resolved value (a
 * referralSlug when known, otherwise the raw typed string) is exposed via
 * `value` for the parent to send as `affiliateIdentifier`.
 *
 * Structural reference: app-marketing-assign-picker (assign-picker.ts) —
 * trigger-less here since both entry methods are shown inline instead of
 * behind a single combobox trigger, but the same live-filtered
 * search-panel-with-empty-state pattern is reused for the name search.
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

	// Final value the parent submits as `affiliateIdentifier` — omitted
	// entirely by the parent when this stays null.
	value = model<string | null>(null);

	// Confirmed selection shown as "الوسيط المحدد: {displayName}".
	selectedName = signal<string | null>(null);

	// Manual code entry + optional "تحقق" verification via /affiliates/resolve
	manualCode = signal('');
	resolving = signal(false);
	resolveState = signal<'idle' | 'found' | 'not-found'>('idle');

	// Search-by-name autocomplete via /affiliates/search
	searchOpen = signal(false);
	searchQuery = signal('');
	searchResults = signal<AffiliateSummary[]>([]);
	searching = signal(false);

	private searchTerms = new Subject<string>();

	constructor() {
		this.searchTerms
			.pipe(
				debounceTime(300),
				distinctUntilChanged(),
				switchMap((q) => {
					const trimmed = q.trim();
					if (trimmed.length < 2) {
						this.searching.set(false);
						return of<AffiliateSummary[]>([]);
					}
					this.searching.set(true);
					return this.api.search(trimmed).pipe(
						map((res) => (res.success ? res.data ?? [] : [])),
						catchError(() => of<AffiliateSummary[]>([]))
					);
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe((results) => {
				this.searching.set(false);
				this.searchResults.set(results);
			});
	}

	// ── Manual code entry ────────────────────────────────────────────────
	onManualCodeInput(raw: string) {
		this.manualCode.set(raw);
		this.resolveState.set('idle');
		const trimmed = raw.trim();
		// Let the raw string flow through unvalidated as the user types —
		// the backend silently ignores an invalid code at registration time,
		// it never blocks signup over it.
		this.value.set(trimmed || null);
		if (!trimmed) {
			this.selectedName.set(null);
		}
	}

	verifyManualCode() {
		const code = this.manualCode().trim();
		if (!code) return;
		this.resolving.set(true);
		this.api.resolve(code).subscribe({
			next: (res) => {
				this.resolving.set(false);
				if (res.success && res.data) {
					this.resolveState.set('found');
					this.selectedName.set(res.data.displayName);
					this.value.set(res.data.referralSlug || res.data.id);
				} else {
					this.resolveState.set('not-found');
				}
			},
			error: () => {
				this.resolving.set(false);
				this.resolveState.set('not-found');
			}
		});
	}

	// ── Search-by-name autocomplete ──────────────────────────────────────
	onSearchInput(raw: string) {
		this.searchQuery.set(raw);
		this.searchOpen.set(true);
		this.searchTerms.next(raw);
	}

	openSearch() {
		this.searchOpen.set(true);
	}

	pickResult(affiliate: AffiliateSummary) {
		this.value.set(affiliate.referralSlug || affiliate.id);
		this.selectedName.set(affiliate.displayName);
		this.resolveState.set('idle');
		this.searchOpen.set(false);
		this.searchQuery.set('');
		this.searchResults.set([]);
		this.manualCode.set('');
	}

	clearSelection() {
		this.value.set(null);
		this.selectedName.set(null);
		this.manualCode.set('');
		this.searchQuery.set('');
		this.searchResults.set([]);
		this.resolveState.set('idle');
	}

	@HostListener('document:click', ['$event'])
	onDocClick(ev: MouseEvent): void {
		if (this.searchOpen() && !this.host.nativeElement.contains(ev.target as Node)) {
			this.searchOpen.set(false);
		}
	}
}
