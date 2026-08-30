import { Component, OnInit, AfterViewInit, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ProviderApiService } from '../../../../../../core/services/provider-api.service';

@Component({
	selector: 'app-accreditation-details',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './accreditation-details.html',
	styleUrl: './accreditation-details.css'
})
export class AccreditationDetails implements OnInit, AfterViewInit {
	private route = inject(ActivatedRoute);
	private providerApi = inject(ProviderApiService);
	private platformId = inject(PLATFORM_ID);

	sampleDetails = signal<any>(null);
	isLoading = signal<boolean>(true);
	isDescExpanded = signal<boolean>(false);

	ngOnInit(): void {
		const id = this.route.snapshot.paramMap.get('id');
		if (id) {
			this.loadSampleDetails(id);
		} else {
			this.isLoading.set(false);
		}
	}

	loadSampleDetails(id: string) {
		this.isLoading.set(true);
		this.providerApi.getAccreditationSampleById(id).subscribe((res) => {
			if (res && res.success) {
				this.sampleDetails.set(res.sample);
			}
			this.isLoading.set(false);
		});
	}

	getPreviewImage(): string | null {
		const attachments = this.sampleDetails()?.attachments;
		if (!Array.isArray(attachments)) return null;
		return attachments.find((url: unknown) => typeof url === 'string' && (url.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url))) || null;
	}

	async shareSample(): Promise<void> {
		if (!isPlatformBrowser(this.platformId)) return;
		const title = this.sampleDetails()?.title || document.title;
		if (navigator.share) {
			await navigator.share({ title, url: window.location.href }).catch(() => undefined);
			return;
		}
		await navigator.clipboard?.writeText(window.location.href);
	}

	ngAfterViewInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			setTimeout(() => this.initParticles(), 100);
		}
	}

	private initParticles(): void {
		const pc = document.getElementById('particles-container');
		if (pc) {
			const isMob = window.innerWidth < 768;
			const count = isMob ? 11 : 25;
			for (let i = 0; i < count; i++) {
				const p = document.createElement('div');
				p.className = 'particle';
				const sz = (Math.random() * 2.5 + 2).toFixed(1) + 'px';
				p.style.cssText = 'left:' + (Math.random() * 100) + '%;width:' + sz + ';height:' + sz + ';animation-duration:' + (Math.random() * 9 + 5).toFixed(1) + 's;animation-delay:' + (Math.random() * -12).toFixed(1) + 's;opacity:' + (Math.random() * 0.5 + 0.1).toFixed(2);
				pc.appendChild(p);
			}
		}
	}
}
