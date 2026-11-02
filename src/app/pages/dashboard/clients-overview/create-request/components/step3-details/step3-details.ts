import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SkillsPickerComponent } from '../../../../../../shared/forms/skills-picker.component';
import type { CreateRequest } from '../../create-request';

@Component({
	selector: 'app-step3-details',
	standalone: true,
	imports: [CommonModule, FormsModule, SkillsPickerComponent],
	templateUrl: './step3-details.html',
	styleUrl: './step3-details.css',
})
export class Step3Details {
	@Input({ required: true }) parent!: CreateRequest;

	@ViewChild('rewriteDialog') set rewriteDialog(ref: ElementRef<HTMLDialogElement> | undefined) {
		// Native modal dialogs live above the dashboard and keep keyboard focus inside.
		if (ref && !ref.nativeElement.open) ref.nativeElement.showModal?.();
	}
}
