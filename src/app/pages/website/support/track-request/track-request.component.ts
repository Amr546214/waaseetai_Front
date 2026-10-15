import { Component, ElementRef, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { attemptSubmit } from '../../../../core/forms/form-helpers';
import { focusInvalidControls } from '../../../../shared/forms/form-error-focus';

@Component({
	selector: 'app-track-request',
	standalone: true,
	imports: [ReactiveFormsModule, RouterModule],
	templateUrl: './track-request.component.html',
	styleUrls: ['./track-request.component.css']
})
export class TrackRequestComponent implements OnInit {
	private readonly host = inject(ElementRef<HTMLElement>);
	trackForm: FormGroup;
	searched = false;
	requestId = '';

	constructor(private fb: FormBuilder, private route: ActivatedRoute) {
		this.trackForm = this.fb.group({
			requestId: ['', [Validators.required, Validators.minLength(3)]]
		});
	}

	/** Design P-SP-006: auto-track when the page is opened with ?order=… */
	ngOnInit() {
		const order = this.route.snapshot.queryParamMap.get('order');
		if (order) {
			this.trackForm.get('requestId')?.setValue(order);
			this.onSubmit();
		}
	}

	onSubmit() {
		const attempt = attemptSubmit(this.trackForm, { labels: { requestId: 'رقم الطلب' } });
		if (attempt.valid) {
			this.requestId = String(this.trackForm.value.requestId).trim().toUpperCase();
			this.searched = true;
		} else {
			void focusInvalidControls(this.host.nativeElement, attempt.missing);
		}
	}

	resetSearch() {
		this.searched = false;
		this.requestId = '';
		this.trackForm.reset();
	}
}
