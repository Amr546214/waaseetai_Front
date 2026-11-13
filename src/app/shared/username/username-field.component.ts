import { ChangeDetectionStrategy, Component, OnInit, inject, output, signal } from '@angular/core';
import { UsernameService } from '../../core/services/username.service';
import { cleanUsername, usernameProblem } from '../../core/validators/username.validator';

/**
 * The username: the name you use with others and the name shown on the platform (profile, cards, chat, search, notifications). ONE field; a single word is fine. It is NOT your legal name
 * (that one is private and only used to verify your identity document) and changing it never touches it.
 */
@Component({
	selector: 'ws-username-field',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<section class="username-field" dir="rtl" data-testid="username-field">
		<label class="block text-sm font-bold mb-1" for="username-field-input">اسم المستخدم (الاسم الذي يظهر للآخرين)</label>
		<div class="flex gap-2 items-start">
			<input id="username-field-input" type="text" maxlength="60" autocomplete="nickname" class="field-in inp-field w-full" data-testid="username-field-input" [value]="draft()" (input)="onInput($event)" [attr.aria-invalid]="problem() ? 'true' : null" />
			<button type="button" class="px-4 py-2 rounded-xl bg-[#2BD4C7] text-[#04101f] text-sm font-bold whitespace-nowrap" [disabled]="!dirty() || saving() || !!problem() || !draft().trim()" (click)="save()" data-testid="username-save">حفظ</button>
		</div>
		@if (problem(); as p) { <div class="text-xs text-red-400 mt-1" role="alert" data-testid="username-problem">{{ p }}</div> }
		<p class="text-xs opacity-70 mt-1">يمكن أن يكون كلمة واحدة، ويختلف عن اسمك الحقيقي في الهوية (الخاص بالتحقق فقط).</p>
		@if (note(); as n) { <p class="text-xs mt-1" role="status" data-testid="username-note">{{ n }}</p> }
	</section>`
})
export class UsernameFieldComponent implements OnInit {
	private readonly api = inject(UsernameService);
	readonly draft = signal('');
	private readonly saved = signal('');
	readonly saving = signal(false);
	readonly problem = signal<string | null>(null);
	readonly note = signal<string | null>(null);
	/** emitted with the new username after the server saved it, so the page can keep any form that still carries the display name in step */
	readonly changed = output<string>();

	dirty = () => cleanUsername(this.draft()) !== this.saved();
	ngOnInit() { this.api.get().subscribe({ next: r => { const v = r?.data?.username ?? r?.data?.displayName ?? ''; this.draft.set(v); this.saved.set(v); }, error: () => undefined }); }
	onInput(e: Event) { const v = (e.target as HTMLInputElement).value; this.draft.set(v); this.problem.set(usernameProblem(v)); this.note.set(null); }
	save() {
		const v = cleanUsername(this.draft()); const p = usernameProblem(v);
		if (!v || p) { this.problem.set(p ?? 'اسم المستخدم مطلوب'); return; }
		this.saving.set(true);
		this.api.save(v).subscribe({
			next: r => { this.saving.set(false); this.saved.set(r.data.username ?? v); this.draft.set(r.data.username ?? v); this.note.set(r.data.changed ? 'تم حفظ اسم المستخدم.' : null); if (r.data.changed) this.changed.emit(r.data.username ?? v); },
			error: e => { this.saving.set(false); this.problem.set(e?.error?.message ?? 'تعذر حفظ اسم المستخدم. حاول مرة أخرى.'); }
		});
	}
}
