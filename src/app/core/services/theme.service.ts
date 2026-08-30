import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({
	providedIn: 'root'
})
export class ThemeService {
	private readonly THEME_KEY = 'waseet_theme';

	// Use Angular Signal for reactive state
	public theme = signal<Theme>('dark'); // Default theme

	constructor(@Inject(PLATFORM_ID) private platformId: Object) {
		this.initTheme();
	}

	private initTheme(): void {
		if (isPlatformBrowser(this.platformId)) {
			const savedTheme = localStorage.getItem(this.THEME_KEY) as Theme | null;
			if (savedTheme) {
				this.setTheme(savedTheme);
			} else {
				const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
				this.setTheme(prefersDark ? 'dark' : 'light');
			}
		}
	}

	public setTheme(newTheme: Theme): void {
		this.theme.set(newTheme);
		if (isPlatformBrowser(this.platformId)) {
			localStorage.setItem(this.THEME_KEY, newTheme);
			if (newTheme === 'dark') {
				document.body.classList.remove('light-theme');
				document.body.classList.remove('theme-light');
				document.documentElement.classList.remove('light-theme', 'theme-light');
				document.documentElement.classList.add('dark');
			} else {
				document.body.classList.add('light-theme', 'theme-light');
				document.documentElement.classList.add('light-theme', 'theme-light');
				document.documentElement.classList.remove('dark');
			}
		}
	}

	public toggleTheme(): void {
		this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
	}
}
