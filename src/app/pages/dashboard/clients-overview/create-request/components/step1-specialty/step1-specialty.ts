import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CreateRequest } from '../../create-request';

@Component({
	selector: 'app-step1-specialty',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './step1-specialty.html',
})
export class Step1Specialty {
	@Input({ required: true }) parent!: CreateRequest;
}
