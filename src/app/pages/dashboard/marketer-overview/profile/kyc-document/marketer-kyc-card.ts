import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarketerKycService, MarketerKycStatus } from '../../../../../core/services/marketer-kyc.service';
import { KycDocumentLink } from '../../../../../sheards/kyc-document-link/kyc-document-link';
import { MB, validateFile } from '../../../../../core/forms/file-validation';
import { mapHttpError } from '../../../../../core/forms/http-error';

/** Same limits as the backend route: one file, 5 MB, PDF / JPG / PNG / WEBP. */
export const MARKETER_KYC_RULE = { maxBytes: 5 * MB, mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], extensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'], typesLabel: 'PDF أو JPG أو PNG أو WEBP' };

/**
 * "توثيق الهوية" card of the marketer profile: upload the identity document and see where it stands.
 *  NONE → upload; PENDING → under review (can be replaced); APPROVED → verified (no upload).
 * A rejection is generic here by design: the reason arrives as a notification and the status goes back to NONE.
 */
@Component({
	selector: 'app-marketer-kyc-card',
	standalone: true,
	imports: [CommonModule, KycDocumentLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './marketer-kyc-card.html',
	styleUrl: './marketer-kyc-card.css',
})
export class MarketerKycCard implements OnInit {
	private readonly api = inject(MarketerKycService);

	readonly status = signal<MarketerKycStatus | null>(null);
	readonly loadFailed = signal(false);
	readonly uploading = signal(false);
	readonly error = signal('');
	readonly success = signal('');
	readonly rule = MARKETER_KYC_RULE;

	ngOnInit(): void { this.load(); }

	load(): void {
		this.loadFailed.set(false);
		this.api.getStatus().subscribe({
			next: s => this.status.set(s),
			error: () => { this.loadFailed.set(true); },
		});
	}

	onFileSelected(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		this.error.set(''); this.success.set('');
		const problem = validateFile(file, MARKETER_KYC_RULE);
		if (problem) { this.error.set(problem); return; }
		this.uploading.set(true);
		this.api.upload(file).subscribe({
			next: res => {
				this.uploading.set(false);
				this.status.set(res.status);
				this.success.set('تم رفع المستند وإرساله للمراجعة');
			},
			error: err => {
				this.uploading.set(false);
				// 409 = already verified; 413/415 = size / type; everything else a generic Arabic message
				this.error.set(mapHttpError(err, { fallback: 'تعذر رفع المستند، حاول مرة أخرى' }).message);
				if ((err as { status?: number })?.status === 409) this.load();
			},
		});
	}
}
