import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CreateRequest } from '../../create-request';

@Component({
	selector: 'app-step2-conditions',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './step2-conditions.html',
	styleUrl: './step2-conditions.css',
})
export class Step2Conditions {
	@Input({ required: true }) parent!: CreateRequest;
}
