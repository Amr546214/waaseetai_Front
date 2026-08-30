import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
	selector: 'app-step2-specialty',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './step2-specialty.component.html',
	styleUrl: './step2-specialty.component.css'
})
export class Step2SpecialtyComponent {
	@Input({ required: true }) isLoadingSpecialties!: boolean;
	@Input({ required: true }) passedCategories!: any[];
	@Input({ required: true }) selectedSpecialty!: string;
	@Input({ required: true }) selectedMainSpecialtyObj!: any;
	@Input({ required: true }) selectedSubSpecialty!: string;

	@Output() onSelectMainSpecialty = new EventEmitter<any>();
	@Output() onSelectSubSpecialty = new EventEmitter<string>();

	constructor(private sanitizer: DomSanitizer) {}

	selectMainSpecialty(spec: any) {
		this.onSelectMainSpecialty.emit(spec);
	}

	selectSubSpecialty(sub: string) {
		this.onSelectSubSpecialty.emit(sub);
	}

	isSvgIcon(iconStr?: string): boolean {
		return !!iconStr && iconStr.includes('<');
	}

	getSanitizedIcon(iconStr?: string): SafeHtml | string {
		if (!iconStr) return '💻';
		if (iconStr.includes('<')) {
			let wrapped = iconStr;
			if (!iconStr.includes('<svg')) {
				wrapped = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-full h-full">${iconStr}</svg>`;
			}
			return this.sanitizer.bypassSecurityTrustHtml(wrapped);
		}
		return iconStr;
	}
}
