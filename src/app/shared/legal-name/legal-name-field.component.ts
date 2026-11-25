import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { LegalNameService, LegalNameView } from '../../core/services/legal-name.service';
import { cleanLegalName, legalNameProblem } from '../../core/validators/legal-name.validator';

/** Private identity-matching name. Every owner saves it directly, explicitly.
 * A legacy pending request is only a draft to recover, never an approval gate. */
@Component({
	selector: 'ws-legal-name-field',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<section class="legal-name" dir="rtl" data-testid="legal-name-field">
		@if (!view() && problem(); as loadProblem) { <p class="text-xs text-red-400" role="alert">{{ loadProblem }}</p> }
		@if (view(); as v) {
			<label class="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-400" for="legal-name-field-input">الاسم الحقيقي (كما في الهوية) <span class="ws-req" aria-hidden="true">*</span></label>
			@if (!readOnly() && (editing() || v.status === 'MISSING')) {
				<input id="legal-name-field-input" type="text" maxlength="120" autocomplete="off" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#131C31] border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-cyan-500 dark:focus:ring-[#38BDF8] focus:border-cyan-500 dark:focus:border-[#38BDF8] outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" placeholder="مثال: عمرو محمود" data-testid="legal-name-field-input" [value]="draft()" [disabled]="saving()" (input)="onInput($event)" [attr.aria-invalid]="problem() ? 'true' : null" />
				@if (problem(); as pr) { <div class="text-xs text-red-400 mt-1" role="alert" data-testid="legal-name-problem">{{ pr }}</div> }
				<div class="flex gap-2 mt-2">
					<button type="button" class="px-4 py-2 rounded-xl bg-[#2BD4C7] text-[#04101f] text-sm font-bold" [disabled]="saving() || !!problem() || !draft().trim()" (click)="save()" data-testid="legal-name-save">{{ saving() ? 'جارٍ الحفظ…' : 'حفظ الاسم الحقيقي' }}</button>
					@if (v.status === 'PROVIDED' && !alwaysEdit()) { <button type="button" class="px-4 py-2 rounded-xl border border-white/20 text-sm" [disabled]="saving()" (click)="cancel()">إلغاء</button> }
				</div>
			} @else {
				<div class="flex items-center gap-3">
					<span class="text-sm" data-testid="legal-name-value">{{ v.legalName || '—' }}</span>
					@if (!readOnly()) { <button type="button" class="text-xs underline text-[#2BD4C7]" (click)="startEdit(v)" data-testid="legal-name-edit">تعديل</button> }
				</div>
			}
			@if (note(); as n) { <p class="text-xs text-slate-300 mt-2" role="status" data-testid="legal-name-note">{{ n }}</p> }
		}
	</section>`
})
export class LegalNameFieldComponent implements OnInit {
	private readonly api = inject(LegalNameService);
	readonly view = signal<LegalNameView | null>(null);
	readonly editing = signal(false);
	readonly draft = signal('');
	readonly saving = signal(false);
	readonly note = signal<string | null>(null);
	readonly problem = signal<string | null>(null);
	readonly alwaysEdit = input(false);
	/** display only (the profile edit page): the name is shown, never edited from here */
	readonly readOnly = input(false);
	readonly saved = output<void>();

	ngOnInit() {
		this.api.get().subscribe({ next: r => {
			if (!r?.data) return;
			this.view.set(r.data);
			if (this.alwaysEdit() || r.data.pendingRequest) this.startEdit(r.data);
		}, error: () => this.problem.set('تعذر تحميل الاسم الحقيقي. أعد تحميل الصفحة وحاول مرة أخرى.') });
	}
	startEdit(v: LegalNameView) { this.draft.set(v.pendingRequest?.requestedValue ?? v.legalName ?? ''); this.problem.set(null); this.note.set(null); this.editing.set(true); }
	cancel() { this.editing.set(false); this.problem.set(null); }
	onInput(e: Event) { const value = (e.target as HTMLInputElement).value; this.draft.set(value); this.problem.set(legalNameProblem(value)); this.note.set(null); }
	save() {
		if (this.saving()) return;
		const value = cleanLegalName(this.draft()); const p = legalNameProblem(value);
		if (!value || p) { this.problem.set(p ?? 'الاسم الحقيقي مطلوب'); return; }
		this.saving.set(true); this.problem.set(null); this.note.set(null);
		this.api.save(value).subscribe({
			next: r => {
				this.saving.set(false);
				// During a rolling deploy, an old backend may still create a request.
				// Never show that as a successful direct save or discard the typed name.
				if (!r?.success || r.data?.outcome === 'REQUEST_CREATED' || cleanLegalName(r.data?.view?.legalName) !== value) {
					this.problem.set('لم يُحفظ الاسم مباشرة. أعد المحاولة بعد اكتمال تحديث الموقع.'); return;
				}
				this.view.set(r.data.view); this.draft.set(r.data.view.legalName ?? ''); this.editing.set(this.alwaysEdit());
				this.note.set('تم حفظ الاسم الحقيقي.'); this.saved.emit();
			},
			error: e => { this.saving.set(false); this.problem.set(e?.error?.message ?? 'تعذر حفظ الاسم الحقيقي. حاول مرة أخرى.'); }
		});
	}
}
