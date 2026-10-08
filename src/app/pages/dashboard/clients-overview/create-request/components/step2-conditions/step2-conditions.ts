import { Component, Input } from '@angular/core';
import { WsSelectComponent } from '../../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CreateRequest } from '../../create-request';

@Component({
	selector: 'app-step2-conditions',
	standalone: true,
	imports: [CommonModule, FormsModule, WsSelectComponent],
	templateUrl: './step2-conditions.html',
	styleUrl: './step2-conditions.css',
})
export class Step2Conditions {
	@Input({ required: true }) parent!: CreateRequest;
}
