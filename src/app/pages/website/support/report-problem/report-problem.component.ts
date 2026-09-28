import { Component } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

type Priority = 'low' | 'med' | 'high';

interface ProblemType { id: string; label: string; desc: string; icon: string; icoStyle: string; color: string; }

@Component({
	selector: 'app-report-problem',
	standalone: true,
	imports: [ReactiveFormsModule, RouterModule],
	templateUrl: './report-problem.component.html',
	styleUrls: ['./report-problem.component.css']
})
export class ReportProblemComponent {
	reportForm: FormGroup;
	isSubmitting = false;
	submitted = false;
	/** Number of attachments picked in the upload zone. */
	fileCount = 0;

	/** Problem types, verbatim from the design (P-SP-003 type grid). */
	categories: ProblemType[] = [
		{ id: 'payment', label: 'مدفوعات ومالية', desc: 'دفع، استرداد، حساب ضمان', icon: 'dollar', icoStyle: 'background:rgba(43,212,199,.08);border:1px solid rgba(43,212,199,.18)', color: 'var(--teal)' },
		{ id: 'account', label: 'حساب ودخول', desc: 'تسجيل الدخول، كلمة المرور، الملف', icon: 'user', icoStyle: 'background:rgba(43,127,255,.08);border:1px solid rgba(43,127,255,.18)', color: 'var(--blue-txt)' },
		{ id: 'service', label: 'مشروع وخدمة', desc: 'جودة التسليم، توقف المقدم', icon: 'file', icoStyle: 'background:rgba(217,138,11,.08);border:1px solid rgba(217,138,11,.18)', color: 'var(--kahr)' },
		{ id: 'fraud', label: 'احتيال وانتهاك', desc: 'سلوك مسيء، محتوى مخالف', icon: 'shield', icoStyle: 'background:rgba(255,140,105,.08);border:1px solid rgba(255,140,105,.18)', color: 'var(--red)' },
		{ id: 'technical', label: 'مشكلة تقنية', desc: 'خطأ في الموقع، ميزة لا تعمل', icon: 'settings', icoStyle: 'background:rgba(123,47,190,.08);border:1px solid rgba(123,47,190,.18)', color: 'var(--ai-txt)' },
		{ id: 'other', label: 'أخرى', desc: 'أي شيء لا ينطبق عليه ما سبق', icon: 'lock', icoStyle: 'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)', color: 'var(--txt-3)' }
	];

	constructor(private fb: FormBuilder) {
		this.reportForm = this.fb.group({
			category: ['', Validators.required],
			name: ['', Validators.required],
			email: ['', [Validators.required, Validators.email]],
			projectId: [''],
			subject: ['', [Validators.required, Validators.minLength(5)]],
			description: ['', [Validators.required, Validators.minLength(20)]],
			priority: ['' as Priority | '']
		});
	}

	get category(): string { return this.reportForm.get('category')?.value; }
	get priority(): Priority | '' { return this.reportForm.get('priority')?.value; }

	selectType(id: string) {
		this.reportForm.get('category')?.setValue(id);
		this.reportForm.get('category')?.markAsTouched();
	}

	setPri(p: Priority) {
		this.reportForm.get('priority')?.setValue(p);
	}

	onFiles(event: Event) {
		const input = event.target as HTMLInputElement;
		this.fileCount = input.files?.length ?? 0;
	}

	invalid(name: string): boolean {
		const c = this.reportForm.get(name);
		return !!(c && c.touched && c.invalid);
	}

	onSubmit() {
		if (this.reportForm.valid) {
			this.isSubmitting = true;
			// Presentational only — no backend call per constraints
			setTimeout(() => {
				this.isSubmitting = false;
				this.submitted = true;
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}, 800);
		} else {
			this.reportForm.markAllAsTouched();
		}
	}

	resetForm() {
		this.submitted = false;
		this.fileCount = 0;
		this.reportForm.reset({ category: '', name: '', email: '', projectId: '', subject: '', description: '', priority: '' });
	}
}
