import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { SiteControlScope } from '../core/site-control-scope.service';
import { DesignTokensService } from '../core/design-tokens.service';

/**
 * «التحكم بالموقع» section host. Every page of the section renders inside `.sc-root`: the panel's design tokens are written on THIS element only (never on the document),
 * so the rest of the platform keeps its own colours, fonts and layout. The pages are shadow-DOM components, so the platform's global CSS cannot restyle them either.
 * The imported pages that stay local run entirely in this browser (localStorage + JSON export / import) - the notice says so on each of them; nothing there changes the live site.
 * «الهوية» and «مكتبة الأيقونات» talk to the server (real, versioned platform identity); the design aids READ that identity; «المستويات والنقاط» is outside this system (see `kind`).
 */
@Component({
	selector: 'app-site-control-shell',
	imports: [RouterOutlet],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './site-control-shell.html',
	styleUrl: './site-control-shell.css'
})
export class SiteControlShell implements AfterViewInit, OnDestroy {
	private readonly scope = inject(SiteControlScope);
	private readonly tokens = inject(DesignTokensService);
	private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
	private readonly router = inject(Router);
	private readonly url = toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd), startWith(null), map(() => this.router.url)), { initialValue: '' });
	/**
	 * What each page of the section really is (decision table: IDENTITY-SECTIONS-2026-10-28.md):
	 *  - server: «الهوية» and «مكتبة الأيقونات» write the platform's identity on the server (no notice, the pages explain themselves);
	 *  - mixed: «القيم والألوان» and «الخطوط» hold a SERVER-backed editor above a local sandbox;
	 *  - aid: design aids that READ the live identity (style guide, live preview, health scan) and save nothing on the site;
	 *  - rules: «المستويات والنقاط» = business rules of the platform, out of this system's scope, logic untouched;
	 *  - local: the remaining local tools (templates, export) and anything unknown.
	 */
	readonly kind = computed<'server' | 'mixed' | 'aid' | 'rules' | 'local'>(() => {
		const m = /\/site-control\/([^/?#]+)/.exec(this.url());
		switch (m?.[1]) {
			case 'identity': case 'icons': return 'server';
			case 'tokens': case 'typography': return 'mixed';
			case 'style-guide': case 'live-preview': case 'health': return 'aid';
			case 'accounts': return 'rules';
			default: return 'local';
		}
	});

	async ngAfterViewInit(): Promise<void> {
		this.scope.setHost(this.host().nativeElement);
		// a re-entry keeps the in-memory state: re-apply it to the NEW host element; the first entry loads it
		if (this.tokens.loaded()) this.tokens.applyAll();
		else await this.tokens.loadAndApply();
	}

	ngOnDestroy(): void {
		this.scope.setHost(null);
	}
}
