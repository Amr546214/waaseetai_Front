import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { LegalNameService, LegalNameView } from '../../core/services/legal-name.service';
import { cleanLegalName, legalNameProblem } from '../../core/validators/legal-name.validator';

/**
 * The legal name (as on the identity document) next to the identity data. It is NOT the display name: the display name is what others see, this one is only compared with the document
 * and is private. Missing (older accounts, Google sign-ups) -> asks for it. Provided -> editable until the identity is verified or under review; after that a change is a REQUEST that
 * an admin decides and the identity is verified again against the new name.
 */
@Component({
	selector: 'ws-legal-name-field',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<section class="legal-name" dir="rtl" data-testid="legal-name-field">
		@if (view(); as v) {
			<label class="block text-sm font-bold mb-1" for="legal-name-field-input">الاسم الحقيقي (كما في الهوية)</label>
			@if (v.status === 'MISSING') {
				<p class="text-xs text-amber-300 mb-2" role="note" data-testid="legal-name-missing">أكمل اسمك الحقيقي كما هو مكتوب في وثيقة الهوية؛ نطابقه معها ولا يظهر للآخرين. اسم العرض لا يتغيّر.</p>
			}
			@if (v.pendingRequest; as p) {
				<p class="text-xs text-slate-300 mb-2" role="status" data-testid="legal-name-pending">طلب تعديل الاسم إلى «{{ p.requestedValue }}» قيد المراجعة. سيبقى الاسم الحالي حتى القرار، ثم تُعاد مطابقة الهوية.</p>
			}
			@if (editing() || v.status === 'MISSING') {
				<input id="legal-name-field-input" type="text" maxlength="120" autocomplete="off" class="field-in w-full" data-testid="legal-name-field-input" [value]="draft()" (input)="onInput($event)" [attr.aria-invalid]="problem() ? 'true' : null" />
				@if (problem(); as pr) { <div class="text-xs text-red-400 mt-1" role="alert" data-testid="legal-name-problem">{{ pr }}</div> }
				@if (v.changeNeedsReview && v.status === 'PROVIDED') { <p class="text-xs text-slate-300 mt-1">اسمك مرتبط بهوية موثقة أو قيد المراجعة: التعديل يُرسل كطلب للمراجعة ثم تُعاد مطابقة الهوية.</p> }
				<div class="flex gap-2 mt-2">
					<button type="button" class="px-4 py-2 rounded-xl bg-[#2BD4C7] text-[#04101f] text-sm font-bold" [disabled]="saving() || !!problem() || !draft().trim()" (click)="save()" data-testid="legal-name-save">{{ v.changeNeedsReview && v.status === 'PROVIDED' ? 'إرسال طلب التعديل' : 'حفظ الاسم الحقيقي' }}</button>
					@if (v.status === 'PROVIDED') { <button type="button" class="px-4 py-2 rounded-xl border border-white/20 text-sm" (click)="cancel()">إلغاء</button> }
				</div>
			} @else {
				<div class="flex items-center gap-3">
					<span class="text-sm" data-testid="legal-name-value">{{ v.legalName }}</span>
					@if (!v.pendingRequest) { <button type="button" class="text-xs underline text-[#2BD4C7]" (click)="startEdit(v)" data-testid="legal-name-edit">{{ v.changeNeedsReview ? 'طلب تعديل' : 'تعديل' }}</button> }
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
	/** emitted when the legal name was saved (so the page can re-read what depends on it) */
	readonly saved = output<void>();

	ngOnInit() { this.load(); }
	private load() { this.api.get().subscribe({ next: r => { if (r?.data) this.view.set(r.data); }, error: () => undefined }); }
	startEdit(v: LegalNameView) { this.draft.set(v.legalName ?? ''); this.problem.set(null); this.note.set(null); this.editing.set(true); }
	cancel() { this.editing.set(false); this.problem.set(null); }
	onInput(e: Event) { const v = (e.target as HTMLInputElement).value; this.draft.set(v); this.problem.set(legalNameProblem(v)); }
	save() {
		const value = cleanLegalName(this.draft()); const p = legalNameProblem(value);
		if (!value || p) { this.problem.set(p ?? 'الاسم الحقيقي مطلوب'); return; }
		this.saving.set(true);
		this.api.save(value).subscribe({
			next: r => {
				this.saving.set(false); this.view.set(r.data.view); this.editing.set(false);
				this.note.set(r.data.outcome === 'REQUEST_CREATED' ? 'أُرسل طلب التعديل للمراجعة.' : r.data.outcome === 'SAVED' ? 'تم حفظ الاسم الحقيقي.' : null);
				if (r.data.outcome !== 'UNCHANGED') this.saved.emit();
			},
			error: e => { this.saving.set(false); this.problem.set(e?.error?.message ?? 'تعذر حفظ الاسم الحقيقي. حاول مرة أخرى.'); }
		});
	}
}
