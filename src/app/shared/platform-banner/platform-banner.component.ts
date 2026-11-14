import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { AuthStore } from '../../core/store/auth.store';
import { PlatformInfoService } from '../../core/services/platform-info.service';

/** Top-of-app notice shown ONLY to someone who can still use the site while maintenance is on (a Super Admin): everyone else sees the Under Deployment page instead of the site. */
@Component({
	selector: 'app-platform-banner',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `@if (isSuperAdmin() && info.maintenance(); as m) { <div class="pb pb-maint" role="alert" data-testid="maintenance-notice">وضع الصيانة مفعّل — أنت ترى المنصة بصلاحية Super Admin. رسالة الزوار: {{ m }}</div> }`,
	styles: [`.pb{position:relative;z-index:50;text-align:center;font-size:13px;font-weight:700;padding:8px 14px;border-bottom:1px solid rgba(255,180,0,.35)}.pb-maint{background:var(--ws-surface,#18212e);color:var(--ws-text,#e8eefc);box-shadow:0 2px 8px #0002}`],
})
export class PlatformBannerComponent implements OnInit {
	readonly info = inject(PlatformInfoService);
	private readonly auth = inject(AuthStore);
	isSuperAdmin = () => String(this.auth.currentUser()?.accountType) === 'SUPER_ADMIN';
	ngOnInit() { this.info.load(); }
}
