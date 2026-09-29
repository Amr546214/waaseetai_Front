import { Component, ElementRef, HostListener, PLATFORM_ID, ViewChild, effect, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ConfirmModalService } from '../../core/services/confirm-modal.service';

@Component({
	selector: 'app-confirm-modal',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './confirm-modal.component.html',
	styleUrl: './confirm-modal.component.css',
})
export class ConfirmModalComponent {
	modal = inject(ConfirmModalService);
	private platformId = inject(PLATFORM_ID);
	private isBrowser = isPlatformBrowser(this.platformId);
	private previouslyFocused: HTMLElement | null = null;

	@ViewChild('confirmBtn') confirmBtnRef?: ElementRef<HTMLButtonElement>;
	@ViewChild('box') boxRef?: ElementRef<HTMLDivElement>;

	constructor() {
		effect(() => {
			if (!this.isBrowser) return;
			if (this.modal.isOpen()) {
				this.previouslyFocused = document.activeElement as HTMLElement;
				document.body.style.overflow = 'hidden';
				// Wait a tick for the box to render before focusing it.
				setTimeout(() => this.confirmBtnRef?.nativeElement.focus(), 0);
			} else {
				document.body.style.overflow = '';
				this.previouslyFocused?.focus();
				this.previouslyFocused = null;
			}
		});
	}

	@HostListener('document:keydown.escape')
	onEscape() {
		if (this.modal.isOpen()) this.modal.reject();
	}

	@HostListener('document:keydown', ['$event'])
	onTab(event: KeyboardEvent) {
		if (event.key !== 'Tab' || !this.modal.isOpen() || !this.boxRef) return;
		const focusable = this.boxRef.nativeElement.querySelectorAll<HTMLElement>('button');
		if (!focusable.length) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	onBackdrop() {
		this.modal.reject();
	}

	iconPath(type: string): string {
		switch (type) {
			case 'success': return 'M8.5 12l2.5 2.5 4.5-4.5';
			case 'info': return 'M12 16v-4m0-4h.01';
			default: return 'M12 9v4m0 4h.01';
		}
	}
}
