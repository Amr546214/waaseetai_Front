import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
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
			<label class="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-400" for="legal-name-field-input">الاسم الحقيقي (كما في الهوية) <span class="ws-req" aria-hidden="true">*</span></label>
			@if (v.status === 'MISSING') {
				@if (v.changeNeedsReview) { <p class="text-xs text-slate-300 mb-2" role="note" data-testid="legal-name-legacy-verified">حسابك موثَّق حاليًا كما هو ويبقى كذلك؛ إضافة الاسم الحقيقي تُرسل كطلب للمراجعة، وبعد اعتماده تُعاد مطابقة وثيقتك به.</p> }
			}
			@if (v.pendingRequest; as p) {
				<p class="text-xs text-slate-300 mb-2" role="status" data-testid="legal-name-pending">طلب تعديل الاسم إلى «{{ p.requestedValue }}» قيد المراجعة. سيبقى الاسم الحالي حتى القرار، ثم تُعاد مطابقة الهوية.</p>
			}
			@if ((editing() && !v.pendingRequest) || v.status === 'MISSING') {
				<input id="legal-name-field-input" type="text" [readOnly]="lockedHere(v)" maxlength="120" autocomplete="off" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#131C31] border border-slate-200 dark:border-slate-700/80 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-cyan-500 dark:focus:ring-[#38BDF8] focus:border-cyan-500 dark:focus:border-[#38BDF8] outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" placeholder="مثال: عمرو محمود" data-testid="legal-name-field-input" [value]="draft()" (input)="onInput($event)" (blur)="flush()" [attr.aria-invalid]="problem() ? 'true' : null" />
				@if (problem(); as pr) { <div class="text-xs text-red-400 mt-1" role="alert" data-testid="legal-name-problem">{{ pr }}</div> }
				@if (v.changeNeedsReview && v.status === 'PROVIDED') { <p class="text-xs text-slate-300 mt-1">@if (lockedHere(v)) {اسمك مرتبط بهوية موثقة أو قيد المراجعة ولا يمكن تعديله من هنا.} @else {اسمك مرتبط بهوية موثقة أو قيد المراجعة: التعديل يُرسل كطلب للمراجعة ثم تُعاد مطابقة الهوية.}</p> }
				@if (!autoSaves(v) && !lockedHere(v)) {
				<div class="flex gap-2 mt-2">
					<button type="button" class="px-4 py-2 rounded-xl bg-[#2BD4C7] text-[#04101f] text-sm font-bold" [disabled]="saving() || !!problem() || !draft().trim()" (click)="save()" data-testid="legal-name-save">{{ v.changeNeedsReview ? (v.status === 'PROVIDED' ? 'إرسال طلب التعديل' : 'إرسال طلب إضافة الاسم') : 'حفظ الاسم الحقيقي' }}</button>
					@if (v.status === 'PROVIDED' && !alwaysEdit()) { <button type="button" class="px-4 py-2 rounded-xl border border-white/20 text-sm" (click)="cancel()">إلغاء</button> }
				</div>
				}
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
export class LegalNameFieldComponent implements OnInit, OnDestroy {
	private readonly api = inject(LegalNameService);
	readonly view = signal<LegalNameView | null>(null);
	readonly editing = signal(false);
	readonly draft = signal('');
	readonly saving = signal(false);
	readonly note = signal<string | null>(null);
	readonly problem = signal<string | null>(null);
	/** setup pages: the name is always a box right here (prefilled when already provided), never a read-only value with an edit link */
	readonly alwaysEdit = input(false);
	/** setup pages: no save button, the name is saved by itself when typing stops / the box loses focus. A change that needs an administrator's review (verified or pending identity) still keeps its explicit button, so no request is ever created by accident. */
	readonly autoSave = input(false);
	private timer: ReturnType<typeof setTimeout> | null = null;
	/** auto-saving pages: no button for the name at all. An EXISTING name tied to a verified / pending identity cannot be changed from here (the box is read-only); a missing one is added by itself */
	autoSaves(v: LegalNameView): boolean { return this.autoSave() && (!v.changeNeedsReview || v.status === 'MISSING'); }
	lockedHere(v: LegalNameView): boolean { return this.autoSave() && v.changeNeedsReview && v.status === 'PROVIDED'; }
	/** emitted when the legal name was saved (so the page can re-read what depends on it) */
	readonly saved = output<void>();

	ngOnInit() { this.load(); }
	private load() { this.api.get().subscribe({ next: r => { if (r?.data) { this.view.set(r.data); this.openIfAlways(r.data); } }, error: () => undefined }); }
	private openIfAlways(v: LegalNameView) { if (this.alwaysEdit() && v.status === 'PROVIDED' && !v.pendingRequest) this.startEdit(v); }
	startEdit(v: LegalNameView) { this.draft.set(v.legalName ?? ''); this.problem.set(null); this.note.set(null); this.editing.set(true); }
	cancel() { this.editing.set(false); this.problem.set(null); }
	onInput(e: Event) {
		const v = (e.target as HTMLInputElement).value; this.draft.set(v); this.problem.set(legalNameProblem(v));
		if (this.timer) clearTimeout(this.timer);
		const view = this.view();
		if (view && this.autoSaves(view)) this.timer = setTimeout(() => this.flush(), 800);
	}
	/** saves a valid, changed name right now (auto-save mode only) */
	flush() {
		if (this.timer) { clearTimeout(this.timer); this.timer = null; }
		const view = this.view();
		if (!view || !this.autoSaves(view) || this.saving()) return;
		const value = cleanLegalName(this.draft());
		if (!value || legalNameProblem(value) || value === (view.legalName ?? '')) return;
		this.save();
	}
	ngOnDestroy() { if (this.timer) clearTimeout(this.timer); }
	save() {
		const value = cleanLegalName(this.draft()); const p = legalNameProblem(value);
		if (!value || p) { this.problem.set(p ?? 'الاسم الحقيقي مطلوب'); return; }
		this.saving.set(true);
		this.api.save(value).subscribe({
			next: r => {
				this.saving.set(false); this.view.set(r.data.view); this.editing.set(false); this.openIfAlways(r.data.view);
				this.note.set(r.data.outcome === 'REQUEST_CREATED' ? 'أُرسل طلب التعديل للمراجعة.' : r.data.outcome === 'SAVED' ? 'تم حفظ الاسم الحقيقي.' : null);
				if (r.data.outcome !== 'UNCHANGED') this.saved.emit();
			},
			error: e => { this.saving.set(false); this.problem.set(e?.error?.message ?? 'تعذر حفظ الاسم الحقيقي. حاول مرة أخرى.'); }
		});
	}
}
