import { isPlatformBrowser } from "@angular/common";
import { AfterViewInit, Component, Inject, PLATFORM_ID } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { Navbar } from "../../sheards/navbar/navbar";
import { Footer } from "../../sheards/footer/footer";

@Component({
	selector: 'app-auth-layout',
	templateUrl: './auth-layout.html',
	standalone: true,
	imports: [RouterOutlet, Navbar, Footer],

})
export class AuthLayoutComponent implements AfterViewInit {
	constructor(@Inject(PLATFORM_ID) private platformId: Object) { }

	ngAfterViewInit() {
		if (isPlatformBrowser(this.platformId)) {
			this.generateParticles();
		}
	}

	generateParticles() {
		const pc = document.getElementById('particles-container');
		if (pc) {
			const isMobile = window.innerWidth < 768;
			const count = isMobile ? 11 : 25;
			for (let i = 0; i < count; i++) {
				const p = document.createElement('div');
				p.className = 'particle';
				const sz = (Math.random() * 2.5 + 2).toFixed(1) + 'px';
				p.style.cssText = `left: ${Math.random() * 100}%; width: ${sz}; height: ${sz}; animation-duration: ${(Math.random() * 9 + 5).toFixed(1)}s; animation-delay: ${(Math.random() * -12).toFixed(1)}s; opacity: ${(Math.random() * 0.35 + 0.08).toFixed(2)};`;
				pc.appendChild(p);
			}
		}
	}
}
