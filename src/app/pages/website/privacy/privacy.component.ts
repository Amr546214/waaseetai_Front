import { Component, HostListener, Inject, PLATFORM_ID, OnInit, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PlatformInfoService } from '../../../core/services/platform-info.service';
import { LEGAL_PREPARED_ON } from '../../../core/constants/legal-meta';

@Component({
	selector: 'app-privacy',
	standalone: true,
	imports: [CommonModule, RouterLink, RouterLinkActive],
	templateUrl: './privacy.component.html',
	styleUrls: ['./privacy.component.css']
})
export class PrivacyComponent implements OnInit {
	readonly platform = inject(PlatformInfoService);
	readonly preparedOn = LEGAL_PREPARED_ON;
	activeSection = 's1';

	constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

	ngOnInit() { }

	@HostListener('window:scroll')
	onScroll() {
		if (isPlatformBrowser(this.platformId)) {
			const scrollPosition = window.scrollY + 150;
			const sections = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
			for (const id of sections) {
				const el = document.getElementById(id);
				if (el) {
					const top = el.offsetTop;
					const height = el.offsetHeight;
					if (scrollPosition >= top && scrollPosition < top + height) {
						this.activeSection = id;
					}
				}
			}
		}
	}

	scrollTo(sectionId: string) {
		if (isPlatformBrowser(this.platformId)) {
			const element = document.getElementById(sectionId);
			if (element) {
				const y = element.getBoundingClientRect().top + window.scrollY - 100;
				window.scrollTo({ top: y, behavior: 'smooth' });
				this.activeSection = sectionId;
			}
		}
	}
}
