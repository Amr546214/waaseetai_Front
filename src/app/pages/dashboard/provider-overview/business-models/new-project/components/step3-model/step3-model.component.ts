import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
	selector: 'app-step3-model',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './step3-model.component.html',
	styleUrl: './step3-model.component.css'
})
export class Step3ModelComponent {
	@Input({ required: true }) accreditedCount!: number;
	@Input({ required: true }) distinctSpecialtiesCount!: number;
	@Input({ required: true }) totalViewsCount!: number;
	@Input({ required: true }) averageAiScore!: number;
	@Input({ required: true }) isLoadingModels!: boolean;
	@Input({ required: true }) filteredModels!: any[];
	@Input({ required: true }) selectedModel!: string;
	@Input({ required: true }) galleryUrls!: string[];
	@Input({ required: true }) isUploadingImage!: boolean;

	@Output() onSelectModel = new EventEmitter<string>();
	@Output() onRemoveGalleryImage = new EventEmitter<number>();
	@Output() onGalleryFileSelected = new EventEmitter<Event>();

	currentSort: 'views' | 'score' | 'newest' = 'views';
	searchQuery: string = '';

	get displayedModels() {
		if (!this.filteredModels) return [];
		
		// 1. Filter by search
		let result = this.filteredModels;
		if (this.searchQuery.trim()) {
			const q = this.searchQuery.toLowerCase().trim();
			result = result.filter(m => 
				(m.title && m.title.toLowerCase().includes(q)) || 
				(m.specialtyName && m.specialtyName.toLowerCase().includes(q))
			);
		}

		// 2. Sort
		result = [...result].sort((a, b) => {
			if (this.currentSort === 'views') {
				return (b.views || 0) - (a.views || 0);
			} else if (this.currentSort === 'score') {
				return (b.score || 0) - (a.score || 0);
			} else {
				// newest - assuming we might have createdAt, if not we rely on id or just order
				// For now fallback to ID comparison or default to views if createdAt is missing
				const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				return dateB - dateA;
			}
		});

		return result;
	}

	setSort(sortType: 'views' | 'score' | 'newest') {
		this.currentSort = sortType;
	}

	updateSearch(event: Event) {
		this.searchQuery = (event.target as HTMLInputElement).value;
	}

	selectModel(id: string) {
		this.onSelectModel.emit(id);
	}

	removeGalleryImage(index: number) {
		this.onRemoveGalleryImage.emit(index);
	}

	getFirstImage(model: any): string | null {
		if (model.attachments && model.attachments.length > 0) {
			const first = model.attachments[0];
			return first.url || first.fileUrl || first.preview || first;
		}
		if (model.images && model.images.length > 0) {
			return model.images[0].url || model.images[0];
		}
		if (model.thumbnail) {
			return model.thumbnail;
		}
		return null;
	}
}
