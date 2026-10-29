import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CreateRequest } from '../../create-request';

@Component({
	selector: 'app-step1-specialty',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './step1-specialty.html',
	styleUrl: './step1-specialty.css',
})
export class Step1Specialty {
	@Input({ required: true }) parent!: CreateRequest;

	chooseCategory(id: string, detailPanel: HTMLElement): void {
		if (this.parent.selectedSpec() !== id) this.parent.selectSpec(id);
		if (window.innerWidth < 768) {
			detailPanel.scrollIntoView({
				behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
				block: 'start',
			});
		}
	}
}
