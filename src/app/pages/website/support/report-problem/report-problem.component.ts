import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
	selector: 'app-report-problem',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, RouterModule],
	templateUrl: './report-problem.component.html',
	styleUrls: ['./report-problem.component.css']
})
export class ReportProblemComponent {
	reportForm: FormGroup;
	isSubmitting = false;
	submitted = false;

	categories = [
		{ id: 'payment', label: 'مشكلة دفع' },
		{ id: 'delivery', label: 'مشكلة تسليم' },
		{ id: 'account', label: 'مشكلة حساب' },
		{ id: 'dispute', label: 'نزاع' },
		{ id: 'technical', label: 'مشكلة تقنية' },
		{ id: 'other', label: 'أخرى' }
	];

	constructor(private fb: FormBuilder) {
		this.reportForm = this.fb.group({
			category: ['', Validators.required],
			subject: ['', [Validators.required, Validators.minLength(5)]],
			description: ['', [Validators.required, Validators.minLength(20)]],
			email: ['', [Validators.required, Validators.email]],
			projectId: ['']
		});
	}

	onSubmit() {
		if (this.reportForm.valid) {
			this.isSubmitting = true;
			// Presentational only — no backend call per constraints
			setTimeout(() => {
				this.isSubmitting = false;
				this.submitted = true;
			}, 800);
		} else {
			this.reportForm.markAllAsTouched();
		}
	}

	resetForm() {
		this.submitted = false;
		this.reportForm.reset();
	}
}
