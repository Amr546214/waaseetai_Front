import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MarketerOverviewService, MarketerAssetFile, RefLinksData } from '../../../../core/services/marketer-overview.service';
import { buildReferralUrl } from '../../../../core/utils/referral-link.util';

const KIND_LABEL: Record<MarketerAssetFile['kind'], string> = { BANNER: 'بنر', TEMPLATE: 'قالب', FILE: 'ملف', IMAGE: 'صورة', VIDEO: 'فيديو', DOCUMENT: 'مستند', LINK: 'رابط', TEXT: 'نص' };

/**
 * المواد التسويقية: the marketer's own referral links (real, from the referral-links data) and the files an admin published for marketers.
 * Nothing is invented: when no file has been published the page says so, and there are no upload / edit controls (the marketer cannot publish material).
 */
@Component({
	selector: 'app-marketer-assets',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './assets.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketerAssets implements OnInit {
	private service = inject(MarketerOverviewService);

	files = signal<MarketerAssetFile[]>([]);
	links = signal<RefLinksData | null>(null);
	loading = signal(true);
	error = signal(false);
	copied = signal<string>('');

	primaryLink = computed(() => buildReferralUrl(this.links()?.primarySlug));
	channelLinks = computed(() => {
		const base = this.primaryLink();
		return base ? (this.links()?.customLinks ?? []).map(l => ({ id: l.id, name: l.channelName, url: `${base}?utm_source=${l.utmSource}` })) : [];
	});

	kindLabel(kind: MarketerAssetFile['kind']) { return KIND_LABEL[kind] ?? 'ملف'; }

	ngOnInit() { this.load(); }

	load() {
		this.loading.set(true);
		this.error.set(false);
		this.service.getAssets().subscribe({
			next: (res) => { this.files.set(res.data?.items ?? []); this.loading.set(false); },
			error: () => { this.error.set(true); this.loading.set(false); }
		});
		this.service.getRefLinks().subscribe({ next: (res) => { if (res.success) this.links.set(res.data); }, error: () => {} });
	}

	copy(url: string, key: string) {
		if (!url) return;
		navigator.clipboard.writeText(url).then(() => { this.copied.set(key); setTimeout(() => this.copied.set(''), 2000); }).catch(() => {});
	}
}
