import { Component, HostListener, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
	selector: 'app-terms',
	standalone: true,
	imports: [CommonModule, RouterLink, RouterLinkActive],
	templateUrl: './terms.component.html',
	styleUrls: ['./terms.component.css']
})
export class TermsComponent implements OnInit {
	activeSection = 's1';

	constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

	ngOnInit() { }

	@HostListener('window:scroll')
	onScroll() {
		if (isPlatformBrowser(this.platformId)) {
			const scrollPosition = window.scrollY + 150;
			const sections = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12'];
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
