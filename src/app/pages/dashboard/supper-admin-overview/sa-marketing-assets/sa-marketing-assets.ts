import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
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
	readonly notice = signal('');
	readonly noticeIsError = signal(false);

	title = '';
	description = '';
	kind: MarketingAssetKind = 'IMAGE';
	linkUrl = '';
	text = '';
	audience: 'MARKETER' | 'ALL' = 'MARKETER';
	sortOrder = 0;
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
		this.title = ''; this.description = ''; this.kind = 'IMAGE'; this.linkUrl = ''; this.text = ''; this.audience = 'MARKETER'; this.sortOrder = 0; this.file = null; this.formError.set('');
	}

	onKindChange(): void { this.file = null; this.formError.set(''); }

	onFile(ev: Event): void {
		const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
		this.formError.set('');
		if (f && f.size > MAX_ASSET_BYTES) { this.file = null; (ev.target as HTMLInputElement).value = ''; this.formError.set('حجم الملف يتجاوز 25 ميغابايت.'); return; }
		this.file = f;
	}

	submit(): void {
		if (this.saving()) return;
		if (this.title.trim().length < 2) { this.formError.set('العنوان مطلوب.'); return; }
		if (this.needsFile && !this.file) { this.formError.set('ارفع ملفاً لهذا النوع من المواد.'); return; }
		if (this.kind === 'LINK' && !this.linkUrl.trim()) { this.formError.set('الرابط مطلوب.'); return; }
		if (this.kind === 'TEXT' && !this.text.trim()) { this.formError.set('النص مطلوب.'); return; }
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
		this.formError.set('');
		this.api.create(fd).subscribe({
			next: () => { this.saving.set(false); this.showForm.set(false); this.flash('تمت إضافة المادة.', false); this.load(); },
			error: (e) => { this.saving.set(false); this.formError.set(this.err(e, 'تعذر إضافة المادة.')); },
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
		this.api.setActive(a.id, enabling).subscribe({
			next: (r) => { this.items.update((l) => l.map((x) => (x.id === a.id ? r.data : x))); this.busyId.set(''); this.flash(enabling ? 'تم تفعيل المادة.' : 'تم تعطيل المادة.', false); },
			error: (e) => { this.busyId.set(''); this.flash(this.err(e, 'تعذر تحديث المادة.'), true); },
		});
	}

	private flash(msg: string, isError: boolean): void {
		this.notice.set(msg); this.noticeIsError.set(isError);
		setTimeout(() => this.notice.set(''), 3500);
	}
}
