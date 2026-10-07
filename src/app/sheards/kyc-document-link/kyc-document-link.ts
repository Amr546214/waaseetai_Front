import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { KycAccess, KycDocumentKey } from '../../core/models/kyc-document.model';
import { KycDocumentService, kycAccessErrorMessage } from '../../core/services/kyc-document.service';

/**
 * Opens one stored KYC document.
 *  - legacy document (uploaded before private storage): a plain link to the old URL, exactly as before;
 *  - private document: a "view" button that asks the backend for a fresh short-lived link on EVERY click and opens it in a new tab.
 *    The signed link is never stored and never shown as text.
 *  - nothing uploaded: says so.
 */
@Component({
	selector: 'app-kyc-document-link',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './kyc-document-link.html',
	styleUrl: './kyc-document-link.css',
})
export class KycDocumentLink {
	private readonly kyc = inject(KycDocumentService);

	readonly document = input.required<KycDocumentKey>();
	/** Admin only: whose document. */
	readonly userId = input<string | null | undefined>(null);
	/** Id-addressed documents. */
	readonly docId = input<string | null | undefined>(null);
	readonly index = input<number | null | undefined>(null);
	/** The stored value as returned by the API (the old public URL for a legacy document, null for a private one). */
	readonly url = input<string | null | undefined>(null);
	/** The `<field>Access` marker returned next to it. */
	readonly access = input<KycAccess | null | undefined>(null);
	readonly label = input('عرض');
	readonly linkClass = input('');

	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

	isPrivate(): boolean {
		return this.access()?.private === true;
	}

	isLegacy(): boolean {
		return !this.isPrivate() && !!this.url();
	}

	open(): void {
		if (this.loading() || !this.isPrivate()) return;
		this.error.set(null);
		this.loading.set(true);
		// Open the tab first, inside the click, so the browser does not block it; point it at the signed link once it arrives.
		const tab = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
		if (tab) {
			try { tab.opener = null; } catch { /* cross-origin: nothing to detach */ }
			try { tab.document.title = 'جارٍ فتح الوثيقة…'; } catch { /* ignore */ }
		}
		this.kyc.createAccessLink({ document: this.document(), userId: this.userId() || undefined, id: this.docId() || undefined, index: typeof this.index() === 'number' ? (this.index() as number) : undefined }).subscribe({
			next: link => {
				this.loading.set(false);
				if (tab && !tab.closed) {
					tab.location.href = link.url;
				} else {
					this.error.set('تعذر فتح الوثيقة، اسمح بالنوافذ المنبثقة ثم حاول مجددًا');
				}
			},
			error: err => {
				this.loading.set(false);
				try { tab?.close(); } catch { /* ignore */ }
				this.error.set(kycAccessErrorMessage(err));
			},
		});
	}
}
