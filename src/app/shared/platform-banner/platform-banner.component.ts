import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { PlatformInfoService } from '../../core/services/platform-info.service';

/** Top-of-app notice from the server's settings: the maintenance message when the server is refusing traffic, else the announcement banner when the SUPER_ADMIN enabled it. */
@Component({
	selector: 'app-platform-banner',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	@if (info.maintenance(); as m) { <div class="pb pb-maint" role="alert" data-testid="maintenance-notice">{{ m }}</div> }
	@else if (info.banner().enabled && info.banner().text) { <div class="pb" role="status" data-testid="platform-banner">{{ info.banner().text }}</div> }`,
	styles: [`.pb{position:relative;z-index:50;text-align:center;font-size:13px;font-weight:700;padding:8px 14px;background:rgba(43,127,255,.14);color:#A9CBFF;border-bottom:1px solid rgba(43,127,255,.3)}.pb-maint{background:rgba(255,140,105,.14);color:#FFB29C;border-bottom-color:rgba(255,140,105,.35)}:host-context(.light-theme) .pb{background:#EAF2FF;color:#1E40AF}:host-context(.light-theme) .pb-maint{background:#FFEDE5;color:#9A3412}`],
})
export class PlatformBannerComponent implements OnInit {
	readonly info = inject(PlatformInfoService);
	ngOnInit() { this.info.load(); }
}
