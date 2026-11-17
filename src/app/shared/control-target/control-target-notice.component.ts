import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { OperationsPanelService } from '../../core/services/operations-panel.service';

/** Shown on an admin page whose data is the OFFICIAL site's although this panel runs on another deployment (dev). Nothing renders where the panel controls its own deployment. */
@Component({
	selector: 'ws-control-target-notice',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `@if (panel.state()?.controlTarget === 'OFFICIAL') {
		<p class="ws-control-target" role="status" data-testid="control-target-official" style="margin:0 0 12px;padding:10px 14px;border-radius:12px;border:1px solid rgba(43,212,199,.35);background:rgba(43,212,199,.08);font-size:13px;line-height:1.7">
			هذه الصفحة تتحكم في <strong>الموقع الرسمي</strong> (waseetai.com)، ولا تؤثر على هذا الموقع التجريبي.
		</p>
	}`,
})
export class ControlTargetNoticeComponent implements OnInit {
	readonly panel = inject(OperationsPanelService);
	ngOnInit() { this.panel.load(); }
}
