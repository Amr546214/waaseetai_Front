import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { SiteControlScope } from '../core/site-control-scope.service';
import { DesignTokensService } from '../core/design-tokens.service';

/**
 * «التحكم بالموقع» section host. Every page of the section renders inside `.sc-root`: the panel's design tokens are written on THIS element only (never on the document),
 * so the rest of the platform keeps its own colours, fonts and layout. The pages are shadow-DOM components, so the platform's global CSS cannot restyle them either.
 * The nine imported pages run entirely in this browser (localStorage + JSON export / import) - the notice says so on each of them; nothing there changes the live site.
 * «الهوية» and «مكتبة الأيقونات» are the exception: they talk to the server (real, versioned platform identity) and carry their own explanation instead of the local-only notice.
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
	/** the two pages that hold a SERVER-backed section (the platform's design tokens) above their local sandbox: «القيم والألوان» and «الخطوط» */
	readonly onMixed = toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd), startWith(null), map(() => /\/site-control\/(tokens|typography)(?:[/?#]|$)/.test(this.router.url))), { initialValue: false });
	/** the real, server-backed page: no "local only" notice there */
	readonly onIdentity = toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd), startWith(null), map(() => /\/site-control\/(?:identity|icons)(?:[/?#]|$)/.test(this.router.url))), { initialValue: false });

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
