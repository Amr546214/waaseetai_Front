import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CreateRequest } from '../../create-request';

@Component({
	selector: 'app-step5-files',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './step5-files.html',
})
export class Step5Files {
	@Input({ required: true }) parent!: CreateRequest;
}
