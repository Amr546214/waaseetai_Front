import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { specialtyEmptyView, type RegisteredSpecialty } from '../../core/utils/specialty-states';

/** The one "no selectable specialty" notice (upload-a-model and accreditation selectors): says "none registered" only when none is, else each specialty's state. */
@Component({
	selector: 'ws-specialty-empty',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	template: `
		<div class="wse" role="status" data-testid="specialty-empty">
			<div class="wse-ico" aria-hidden="true">⚠️</div>
			<h3 class="wse-title" data-testid="specialty-empty-title">{{ view().title }}</h3>
			<p class="wse-body">{{ view().body }}</p>
			@if (view().items.length) {
			<ul class="wse-list" data-testid="specialty-empty-items">
				@for (it of view().items; track it.name) {
				<li [attr.data-state]="it.state"><strong>{{ it.name }}</strong><span>{{ it.text }}</span></li>
				}
			</ul>
			}
			<a class="wse-cta" [routerLink]="view().ctaLink" data-testid="specialty-empty-cta">{{ view().ctaLabel }}</a>
		</div>
	`,
	styles: [`
		.wse{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:32px 20px;margin:20px 0;border-radius:24px;background:var(--crd-bg);border:1px solid var(--crd-bd)}
		.wse-ico{width:56px;height:56px;border-radius:16px;display:grid;place-items:center;font-size:26px;background:rgba(255,180,0,.1);border:1px solid rgba(255,180,0,.25)}
		.wse-title{margin:0;font-size:17px;font-weight:900;color:var(--txt)}
		.wse-body{margin:0;max-width:460px;font-size:12.5px;line-height:1.8;color:var(--txt-2)}
		.wse-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;width:100%;max-width:460px}
		.wse-list li{display:flex;flex-direction:column;gap:2px;padding:9px 12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid var(--crd-bd);font-size:12px;color:var(--txt-2)}
		.wse-list strong{color:var(--txt);font-size:13px}
		.wse-cta{margin-top:6px;padding:11px 26px;border-radius:999px;font-size:12px;font-weight:800;text-decoration:none;color:#070D24;background:linear-gradient(135deg,#2BD4C7,#2B7FFF)}
	`],
})
export class SpecialtyEmptyComponent {
	readonly registered = input<readonly RegisteredSpecialty[] | null | undefined>(null);
	protected readonly view = computed(() => specialtyEmptyView(this.registered()));
}
