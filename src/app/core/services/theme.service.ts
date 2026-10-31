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
			try { localStorage.setItem('ws-theme', newTheme); } catch {}
			const html = document.documentElement;
			const body = document.body;
			if (newTheme === 'dark') {
				body.classList.remove('light-theme', 'theme-light', 'light');
				html.classList.remove('light-theme', 'theme-light', 'light');
				html.classList.add('dark');
				body.classList.add('dark');
				html.setAttribute('data-theme', 'dark');
				body.setAttribute('data-theme', 'dark');
				html.style.background = '#070D24';
				body.style.background = '#070D24';
			} else {
				body.classList.remove('dark');
				html.classList.remove('dark');
				body.classList.add('light-theme', 'theme-light');
				html.classList.add('light-theme', 'theme-light');
				html.setAttribute('data-theme', 'light');
				body.setAttribute('data-theme', 'light');
				html.style.background = '#EEF2FA';
				body.style.background = '#EEF2FA';
			}
			try {
				window.dispatchEvent(new CustomEvent('ws-theme-change', { detail: newTheme }));
			} catch {}
		}
	}

	public toggleTheme(): void {
		this.setTheme(this.theme() === 'dark' ? 'light' : 'dark');
	}
}
