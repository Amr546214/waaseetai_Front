import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
	selector: 'app-track-request',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, RouterModule],
	templateUrl: './track-request.component.html',
	styleUrls: ['./track-request.component.css']
})
export class TrackRequestComponent {
	trackForm: FormGroup;
	searched = false;
	requestId = '';

	constructor(private fb: FormBuilder) {
		this.trackForm = this.fb.group({
			requestId: ['', [Validators.required, Validators.minLength(3)]]
		});
	}

	onSubmit() {
		if (this.trackForm.valid) {
			this.requestId = this.trackForm.value.requestId;
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
