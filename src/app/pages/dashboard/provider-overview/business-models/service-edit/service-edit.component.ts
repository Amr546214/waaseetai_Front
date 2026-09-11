import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
	selector: 'app-service-edit',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, RouterModule],
	templateUrl: './service-edit.component.html',
	styleUrls: ['./service-edit.component.css']
})
export class ServiceEditComponent {
	serviceForm: FormGroup;
	isSubmitting = false;
	saved = false;

	tiers = [
		{ id: 'basic', name: 'أساسي', price: 500, desc: 'الحد الأدنى من الخدمة' },
		{ id: 'standard', name: 'قياسي', price: 1500, desc: 'الخدمة القياسية الأكثر طلباً' },
		{ id: 'premium', name: 'احترافي', price: 3500, desc: 'خدمة شاملة مع دعم متقدم' }
	];

	constructor(private fb: FormBuilder) {
		this.serviceForm = this.fb.group({
			name: ['', [Validators.required, Validators.minLength(5)]],
			category: ['', Validators.required],
			description: ['', [Validators.required, Validators.minLength(20)]],
			basePrice: [0, [Validators.required, Validators.min(50)]],
			deliveryDays: [7, [Validators.required, Validators.min(1)]],
			revisions: [2, [Validators.required, Validators.min(0)]],
			active: [true]
		});
	}

	ngOnInit() {
		// Pre-fill with sample data for presentational purposes
		this.serviceForm.patchValue({
			name: 'تصميم تطبيق جوال احترافي',
			category: 'mobile-design',
			description: 'تصميم واجهة مستخدم احترافية لتطبيقات الجوال مع تجربة مستخدم متكاملة وتسليم المصدر القابل للتعديل',
			basePrice: 2500,
			deliveryDays: 10,
			revisions: 3,
			active: true
		});
	}

	onSubmit() {
		if (this.serviceForm.valid) {
			this.isSubmitting = true;
			setTimeout(() => {
				this.isSubmitting = false;
				this.saved = true;
				setTimeout(() => this.saved = false, 3000);
			}, 600);
		} else {
			this.serviceForm.markAllAsTouched();
		}
	}
}
