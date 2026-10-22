import { mapHttpError } from '../../../../core/forms/http-error';
import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { handleAdminError, reportAdminProblems, SubmitGuard } from '../shared/admin-form-report';
import { FieldProblem } from '../../../../shared/forms/form-error-focus';
import { MarketingAsset, MarketingAssetKind, SaMarketingAssetsService } from './sa-marketing-assets.service';

export const KIND_LABELS: Record<MarketingAssetKind, string> = { IMAGE: 'صورة', VIDEO: 'فيديو', DOCUMENT: 'مستند', LINK: 'رابط', TEXT: 'نص' };
const ACCEPT: Record<string, string> = {
	IMAGE: 'image/png,image/jpeg,image/webp,image/gif',
	VIDEO: 'video/mp4,video/webm,video/quicktime',
	DOCUMENT: '.pdf,.zip,.doc,.docx,.ppt,.pptx',
};
export const MAX_ASSET_BYTES = 25 * 1024 * 1024;

@Component({
	selector: 'app-sa-marketing-assets',
	standalone: true,
	imports: [CommonModule, FormsModule, WsSelectComponent],
	templateUrl: './sa-marketing-assets.html',
	styleUrl: './sa-marketing-assets.css',
})
export class SaMarketingAssets implements OnInit {
	private api = inject(SaMarketingAssetsService);
	private confirmModal = inject(ConfirmModalService);
	private notify = inject(UiNotificationService);
	private host = inject<ElementRef<HTMLElement>>(ElementRef);
	private guard = new SubmitGuard();

	readonly kindLabels = KIND_LABELS;
	readonly kinds = Object.keys(KIND_LABELS) as MarketingAssetKind[];

	readonly kindOptions = (Object.keys(KIND_LABELS) as MarketingAssetKind[]).map((k) => ({ value: k, label: KIND_LABELS[k] }));
	readonly kindFilterOptions = [{ value: '', label: 'كل الأنواع' }, ...this.kindOptions];
	readonly activeFilterOptions = [{ value: '', label: 'الكل (مفعّل ومعطّل)' }, { value: 'true', label: 'مفعّل' }, { value: 'false', label: 'معطّل' }];
	readonly audienceOptions = [{ value: 'MARKETER', label: 'الوسطاء التسويقيون' }, { value: 'ALL', label: 'الجميع' }];

	readonly items = signal<MarketingAsset[]>([]);
	readonly loading = signal(true);
	readonly loadError = signal('');
	/** false until the marketing_assets table exists on the server: empty list, adding disabled with a visible reason. */
	readonly storageReady = signal(true);
	readonly kindFilter = signal('');
	readonly activeFilter = signal('');
	readonly search = signal('');

	readonly showForm = signal(false);
	readonly saving = signal(false);
	readonly formError = signal('');
	readonly busyId = signal('');
	/** Why the last enable / disable of an item failed: shown on that item's card, next to its button. */
	readonly rowErrors = signal<Record<string, string>>({});

	title = '';
	description = '';
	kind: MarketingAssetKind = 'IMAGE';
	linkUrl = '';
	text = '';
	audience: 'MARKETER' | 'ALL' = 'MARKETER';
	/** Optional: empty means "after the others" (sent as 0); no ready-made number in the field. */
	sortOrder: number | null = null;
	file: File | null = null;

	ngOnInit(): void { this.load(); }

	get needsFile(): boolean { return this.kind === 'IMAGE' || this.kind === 'VIDEO' || this.kind === 'DOCUMENT'; }
	get accept(): string { return ACCEPT[this.kind] || ''; }

	private err(e: unknown, fallback: string): string {
		const x = e as HttpErrorResponse;
		return x?.error?.message || x?.error?.error || fallback;
	}

	load(): void {
		this.loading.set(true);
		this.loadError.set('');
		this.api.list({ kind: this.kindFilter(), active: this.activeFilter(), search: this.search().trim() }).subscribe({
			next: (r) => { this.items.set(r.data.items); this.storageReady.set(r.data.storageReady !== false); this.loading.set(false); },
			error: (e) => { this.loadError.set(this.err(e, 'تعذر تحميل المواد التسويقية.')); this.loading.set(false); },
		});
	}

	openForm(): void { this.resetForm(); this.showForm.set(true); }
	closeForm(): void { this.showForm.set(false); }

	private resetForm(): void {
		this.title = ''; this.description = ''; this.kind = 'IMAGE'; this.linkUrl = ''; this.text = ''; this.audience = 'MARKETER'; this.sortOrder = null; this.file = null; this.formError.set('');
	}

	onKindChange(): void { this.file = null; this.formError.set(''); }

	onFile(ev: Event): void {
		const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
		this.formError.set('');
		if (f && f.size > MAX_ASSET_BYTES) { this.file = null; (ev.target as HTMLInputElement).value = ''; void reportAdminProblems(this.host.nativeElement, [{ field: 'ma-file', message: 'حجم الملف يتجاوز 25 ميغابايت.' }]); return; }
		this.file = f;
	}

	/** What is wrong with the form right now (field ids = the inputs in the template). */
	problems(): FieldProblem[] {
		const out: FieldProblem[] = [];
		if (this.title.trim().length < 2) out.push({ field: 'ma-title', message: 'العنوان مطلوب (حرفان على الأقل).' });
		if (this.needsFile && !this.file) out.push({ field: 'ma-file', message: 'ارفع ملفاً لهذا النوع من المواد.' });
		if (this.kind === 'LINK') {
			const u = this.linkUrl.trim();
			if (!u) out.push({ field: 'ma-link', message: 'الرابط مطلوب.' });
			else if (!/^https?:\/\/\S+$/i.test(u)) out.push({ field: 'ma-link', message: 'الرابط غير صالح، يجب أن يبدأ بـ http:// أو https://' });
		}
		if (this.kind === 'TEXT' && !this.text.trim()) out.push({ field: 'ma-text', message: 'النص مطلوب.' });
		if (this.sortOrder !== null && this.sortOrder !== undefined && (!Number.isFinite(Number(this.sortOrder)) || Number(this.sortOrder) < 0)) out.push({ field: 'ma-sort', message: 'الترتيب يجب أن يكون رقماً صفراً أو أكبر.' });
		return out;
	}

	async submit(): Promise<void> {
		if (this.saving()) return;
		this.formError.set('');
		const problems = this.problems();
		if (problems.length) { await reportAdminProblems(this.host.nativeElement, problems); return; }
		if (!this.guard.enter()) return;
		const fd = new FormData();
		fd.append('title', this.title.trim());
		if (this.description.trim()) fd.append('description', this.description.trim());
		fd.append('kind', this.kind);
		fd.append('audience', this.audience);
		fd.append('sortOrder', String(Math.max(0, Math.floor(Number(this.sortOrder) || 0))));
		fd.append('active', 'true');
		if (this.kind === 'LINK') fd.append('linkUrl', this.linkUrl.trim());
		if (this.kind === 'TEXT') fd.append('text', this.text.trim());
		if (this.needsFile && this.file) fd.append('file', this.file, this.file.name);
		this.saving.set(true);
		this.api.create(fd).subscribe({
			next: () => { this.guard.release(); this.saving.set(false); this.showForm.set(false); this.notify.success('تمت إضافة المادة.'); this.load(); },
			error: (e) => {
				this.guard.release();
				this.saving.set(false);
				// Inputs and the picked file stay as they are; a field-named 400/422 goes under its field, anything else is the honest banner.
				handleAdminError(this.host.nativeElement, e, { fallback: 'تعذر إضافة المادة.', resolve: { title: 'ma-title', linkUrl: 'ma-link', text: 'ma-text', sortOrder: 'ma-sort', file: 'ma-file', description: 'ma-desc' } }, (m) => this.formError.set(m));
			},
		});
	}

	async toggle(a: MarketingAsset): Promise<void> {
		if (this.busyId()) return;
		const enabling = !a.active;
		const ok = await this.confirmModal.confirm({
			title: enabling ? 'تفعيل المادة' : 'تعطيل المادة',
			message: enabling ? `ستظهر «${a.title}» للجمهور المحدد مرة أخرى.` : `لن تظهر «${a.title}» للوسطاء بعد التعطيل، ويمكنك تفعيلها لاحقاً.`,
			type: enabling ? 'info' : 'warning',
			confirmText: enabling ? 'تفعيل' : 'تعطيل',
		});
		if (!ok) return;
		this.busyId.set(a.id);
		this.rowErrors.update((m) => { const n = { ...m }; delete n[a.id]; return n; });
		this.api.setActive(a.id, enabling).subscribe({
			next: (r) => { this.items.update((l) => l.map((x) => (x.id === a.id ? r.data : x))); this.busyId.set(''); this.notify.success(enabling ? 'تم تفعيل المادة.' : 'تم تعطيل المادة.'); },
			error: (e) => { this.busyId.set(''); const m = mapHttpError(e, { fallback: 'تعذر تحديث المادة، ولم تتغير حالتها.' }); this.rowErrors.update((r) => ({ ...r, [a.id]: m.message })); if (m.status === 409) this.load(); },
		});
	}
}
