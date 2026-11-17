import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlatformInfoService } from '../../core/services/platform-info.service';

/**
 * The standalone «جارٍ تحديث المنصة — Under Deployment» page. It replaces the whole site while maintenance is on: no navbar, no menus, no footer, no assistant (the root renders it INSTEAD of them).
 * The text is the server's saved maintenance message. There is no entry button here: Super Admins control the platform from the admin panel (dev panel controls the official site), and the server alone decides who may pass (the page never trusts the browser).
 */
@Component({
	selector: 'app-under-deployment',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<main class="ud" dir="rtl" role="main" data-testid="under-deployment">
		<div class="ud-card">
			<div class="ud-mark" aria-hidden="true"><span></span></div>
			<h1 class="ud-title">جارٍ تحديث المنصة</h1>
			<p class="ud-en" lang="en" dir="ltr">Under Deployment</p>
			<p class="ud-msg" role="status" data-testid="under-deployment-message">{{ info.maintenance() }}</p>
			<p class="ud-hint">نتحقق تلقائيًا، وستعود المنصة فور انتهاء التحديث دون حاجة لإعادة تحميل الصفحة.</p>
		</div>
	</main>`,
	styles: [`
	:host{display:block}
	.ud{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:var(--ws-bg,#0b1220);color:var(--ws-text,#e8eefc);font-family:inherit}
	.ud-card{max-width:520px;width:100%;text-align:center;padding:40px 28px;border-radius:20px;background:var(--ws-surface,rgba(255,255,255,.04));border:1px solid var(--ws-border,rgba(255,255,255,.12))}
	.ud-mark{width:64px;height:64px;margin:0 auto 20px;border-radius:50%;border:3px solid rgba(43,212,199,.25);border-top-color:#2BD4C7;animation:ud-spin 1.4s linear infinite}
	.ud-mark span{display:block}
	.ud-title{margin:0 0 4px;font-size:26px;font-weight:800}
	.ud-en{margin:0 0 18px;font-size:15px;letter-spacing:.08em;opacity:.7}
	.ud-msg{margin:0 0 12px;font-size:16px;line-height:1.8;white-space:pre-line}
	.ud-hint{margin:0 0 24px;font-size:13px;opacity:.7}
	@keyframes ud-spin{to{transform:rotate(360deg)}}
	@media (prefers-reduced-motion:reduce){.ud-mark{animation:none}}`],
})
export class UnderDeploymentComponent {
	readonly info = inject(PlatformInfoService);
}
