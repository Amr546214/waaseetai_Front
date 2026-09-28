import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';

@Component({
	selector: 'app-track-request',
	standalone: true,
	imports: [ReactiveFormsModule, RouterModule],
	templateUrl: './track-request.component.html',
	styleUrls: ['./track-request.component.css']
})
export class TrackRequestComponent implements OnInit {
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
		if (this.trackForm.valid) {
			this.requestId = String(this.trackForm.value.requestId).trim().toUpperCase();
			this.searched = true;
		} else {
			this.trackForm.markAllAsTouched();
		}
	}

	resetSearch() {
		this.searched = false;
		this.requestId = '';
		this.trackForm.reset();
	}
}
