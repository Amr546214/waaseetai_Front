import { Component, computed, HostListener, Inject, PLATFORM_ID, OnInit, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PlatformInfoService } from '../../../core/services/platform-info.service';
import { LEGAL_PREPARED_ON } from '../../../core/constants/legal-meta';
import { TERMS_DEFAULT_TEXT } from '../../../core/constants/legal-text';
import { parseLegalText } from '../../../core/utils/legal-text';

@Component({
	selector: 'app-terms',
	standalone: true,
	imports: [CommonModule, RouterLink, RouterLinkActive],
	templateUrl: './terms.component.html',
	styleUrls: ['./terms.component.css']
})
export class TermsComponent implements OnInit {
	readonly platform = inject(PlatformInfoService);
	readonly preparedOn = LEGAL_PREPARED_ON;
	/** the saved text (setting `termsContent`) when there is one, else the static text of the page - parsed to typed blocks, rendered as plain text only */
	readonly sections = computed(() => parseLegalText(this.platform.termsContent() || TERMS_DEFAULT_TEXT));
	activeSection = 's1';

	constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

	ngOnInit() { }

	@HostListener('window:scroll')
	onScroll() {
		if (isPlatformBrowser(this.platformId)) {
			const scrollPosition = window.scrollY + 150;
			const sections = this.sections().map(s => s.id);
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
