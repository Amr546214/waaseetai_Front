import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, inject, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SiteControlScope } from '../core/site-control-scope.service';
import { DesignTokensService } from '../core/design-tokens.service';

/**
 * «التحكم بالموقع» section host. Every page of the section renders inside `.sc-root`: the panel's design tokens are written on THIS element only (never on the document),
 * so the rest of the platform keeps its own colours, fonts and layout. The pages are shadow-DOM components, so the platform's global CSS cannot restyle them either.
 * The panel runs entirely in this browser (localStorage + JSON export / import) - the notice says so; nothing here changes the live site.
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
