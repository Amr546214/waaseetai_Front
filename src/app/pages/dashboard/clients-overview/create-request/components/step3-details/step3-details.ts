import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CreateRequest } from '../../create-request';

@Component({
	selector: 'app-step3-details',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './step3-details.html',
	styleUrl: './step3-details.css',
})
export class Step3Details {
	@Input({ required: true }) parent!: CreateRequest;
}
