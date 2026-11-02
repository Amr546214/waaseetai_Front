import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AssistantPositionService } from '../assistant-widget/assistant-position.service';

@Component({
	selector: 'app-assistant-position-settings', standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<fieldset class="position-settings" dir="rtl">
		<legend>موضع الشخصية</legend>
		<label>ارتفاع الشخصية <output>{{ position.preferences().verticalOffset }} بكسل</output></label>
		<input type="range" dir="ltr" min="-240" max="240" step="1" aria-label="ارتفاع الشخصية" [value]="position.preferences().verticalOffset" (input)="position.preview('verticalOffset', +$any($event.target).value)" (change)="position.save()" />
		<div class="position-directions"><span>أسفل</span><span>أعلى</span></div>
		<p>القيمة السالبة تنزل الشخصية والموجبة ترفعها. تظهر التغييرات فورًا وتُحفظ عند ترك الشريط.</p>
		<strong>حدود الحركة</strong>
		<div class="position-edges">
			@for (edge of edges; track edge.field) {
				<label>{{ edge.label }} <output>{{ position.preferences()[edge.field] }} بكسل</output><input type="range" min="0" max="240" step="1" [attr.aria-label]="'المسافة من ' + edge.label" [value]="position.preferences()[edge.field]" (input)="position.preview(edge.field, +$any($event.target).value)" (change)="position.save()" /></label>
			}
		</div>
		<p>المسافات تبقي الشخصية داخل الشاشة أثناء السحب، وتتكيف مع الشاشات الصغيرة.</p>
		<button type="button" class="position-reset" (click)="position.reset()">إرجاع الموضع الافتراضي</button>
	</fieldset>`,
	styles: [`
		:host { display:block; }
		.position-settings { display:flex;flex-direction:column;gap:10px;min-width:0;margin:0;padding:12px;border:1px solid var(--assistant-input-border,var(--tc-line,var(--pg-border,#ccc)));border-radius:12px;color:inherit;font-size:var(--font-size-small); }
		legend { padding:0 6px;font-weight:700;font-size:var(--font-size-label); }
		label { display:flex;align-items:center;justify-content:space-between;gap:8px;font:inherit;color:inherit; }
		output { font-size:var(--font-size-small);white-space:nowrap;opacity:.75; }
		input { width:100%;min-width:0;accent-color:var(--pg-accent,var(--tc-accent,#2f68c9)); }
		.position-directions { display:flex;justify-content:space-between;direction:ltr;font-size:var(--font-size-small);opacity:.8; }
		p { margin:0;font-size:var(--font-size-small);line-height:1.6;opacity:.8; }
		.position-edges { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px; }
		.position-edges label { display:flex;flex-wrap:wrap; }
		.position-edges input { flex-basis:100%; }
		.position-reset { align-self:flex-start;padding:7px 10px;border:1px solid var(--assistant-input-border,var(--tc-line,var(--pg-border,#ccc)));border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer; }
		input:focus-visible,button:focus-visible { outline:2px solid var(--pg-accent,var(--tc-accent,#2f68c9));outline-offset:2px; }
	`],
})
export class AssistantPositionSettingsComponent {
	readonly position = inject(AssistantPositionService);
	readonly edges = [
		{ field: 'top', label: 'فوق' }, { field: 'bottom', label: 'تحت' },
		{ field: 'right', label: 'اليمين' }, { field: 'left', label: 'الشمال' },
	] as const;
}
