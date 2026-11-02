import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, output, signal } from '@angular/core';

export const SKILLS_PICKER_MAX = 30;

/**
 * Searchable, selectable skills list. The provider can only add skills from `options` (the catalog of the chosen main specialty); there is no
 * free text. Chips are removable. Presentational: the page owns the selected list and the options.
 */
@Component({
	selector: 'ws-skills-picker',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None,
	template: `
		<div class="skp" data-testid="skills-picker">
			@if (selected().length) {
			<div class="skp-chips" data-testid="skills-selected">
				@for (skill of selected(); track skill) {
				<span class="skp-chip" [attr.data-skill]="skill">{{ skill }}<button type="button" class="skp-x" (click)="remove(skill)" [attr.aria-label]="'حذف ' + skill">&times;</button></span>
				}
			</div>
			}
			@if (!options().length) {
			<p class="skp-empty" data-testid="skills-need-field" role="status">{{ emptyMessage() }}</p>
			} @else {
			<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
				<input type="search" class="skp-search" style="flex:1;min-width:200px" data-testid="skills-search" [value]="query()" (input)="query.set($any($event.target).value)" placeholder="ابحث في مهارات مجالك…" autocomplete="off" [disabled]="full()" />
				@if (!full() && batchCandidates().length > 1) {
				<button type="button" class="skp-batch-btn" data-testid="skills-add-batch" (click)="addBatch()">
					⚡ {{ query().trim() ? 'إضافة نتائج البحث دفعة واحدة' : 'إضافة مجموعة سريعة' }} (+{{ batchCandidates().length }})
				</button>
				}
			</div>
			<div class="skp-list" role="listbox" aria-label="مهارات المجال" data-testid="skills-options">
				@for (opt of visible(); track opt) {
				<button type="button" class="skp-opt" role="option" [attr.data-skill]="opt" (click)="add(opt)">+ {{ opt }}</button>
				} @empty {
				<p class="skp-none" data-testid="skills-none">لا توجد مهارة مطابقة</p>
				}
			</div>
			@if (full()) { <p class="skp-hint">وصلت للحد الأقصى ({{ max }} مهارة)</p> }
			}
		</div>
	`,
	styles: [`
		.skp{display:flex;flex-direction:column;gap:10px}
		.skp-chips{display:flex;flex-wrap:wrap;gap:8px}
		.skp-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 6px 5px 12px;border-radius:999px;font-size:var(--font-size-label);font-weight:700;background:rgba(43,127,255,.14);border:1px solid rgba(43,127,255,.35);color:var(--txt,#fff)}
		.skp-x{border:0;background:transparent;color:inherit;cursor:pointer;font-size:var(--font-size-body);line-height:1;padding:0 4px;border-radius:50%}
		.skp-x:hover{background:rgba(255,255,255,.14)}
		.skp-search{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--border,rgba(255,255,255,.14));background:var(--surface,rgba(255,255,255,.04));color:var(--txt,#fff);font-family:inherit}
		.skp-batch-btn{padding:9px 14px;border-radius:10px;border:1px solid rgba(43,127,255,.45);background:rgba(43,127,255,.15);color:var(--txt,#fff);font-size:var(--font-size-label);font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap}
		.skp-batch-btn:hover{background:rgba(43,127,255,.26)}
		.skp-list{display:flex;flex-wrap:wrap;gap:8px;max-height:210px;overflow:auto;padding:2px}
		.skp-opt{padding:6px 12px;border-radius:999px;border:1px dashed var(--border,rgba(255,255,255,.25));background:transparent;color:var(--txt,#fff);font-size:var(--font-size-label);cursor:pointer;font-family:inherit}
		.skp-opt:hover,.skp-opt:focus-visible{border-style:solid;border-color:#2B7FFF;background:rgba(43,127,255,.12);outline:none}
		.skp-empty,.skp-none,.skp-hint{margin:0;font-size:var(--font-size-label);color:var(--txt-3,#94a3b8)}
	`],
})
export class SkillsPickerComponent {
	readonly options = input<string[]>([]);
	readonly selected = input<string[]>([]);
	readonly emptyMessage = input('اختر التخصص الرئيسي أولًا لتظهر مهارات مجالك');
	readonly selectedChange = output<string[]>();

	protected readonly max = SKILLS_PICKER_MAX;
	protected readonly query = signal('');
	protected readonly full = computed(() => this.selected().length >= SKILLS_PICKER_MAX);
	protected readonly visible = computed(() => {
		const q = this.query().trim().toLowerCase();
		const taken = new Set(this.selected());
		return this.options().filter(o => !taken.has(o) && (!q || o.toLowerCase().includes(q)));
	});
	protected readonly batchCandidates = computed(() => {
		const remaining = Math.max(0, SKILLS_PICKER_MAX - this.selected().length);
		const limit = this.query().trim() ? remaining : Math.min(8, remaining);
		return this.visible().slice(0, limit);
	});

	protected add(skill: string): void {
		if (this.full() || this.selected().includes(skill) || !this.options().includes(skill)) return;
		this.selectedChange.emit([...this.selected(), skill]);
	}

	protected addBatch(): void {
		const batch = this.batchCandidates();
		if (!batch.length) return;
		this.selectedChange.emit([...this.selected(), ...batch]);
	}

	protected remove(skill: string): void {
		this.selectedChange.emit(this.selected().filter(s => s !== skill));
	}
}
