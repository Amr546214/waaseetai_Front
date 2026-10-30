import { Component, ElementRef, Input, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { clearInvalid, FieldProblem } from '../../../../../../shared/forms/form-error-focus';
import { reportClientProblems } from '../../../client-form-report';
import type { CreateRequest } from '../../create-request';
import { printReviewDocument } from './review-pdf';

@Component({
	selector: 'app-step6-review',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterLink],
	templateUrl: './step6-review.html',
	styleUrl: './step6-review.css',
})
export class Step6Review implements OnDestroy {
	@Input({ required: true }) parent!: CreateRequest;
	isExporting = signal(false);
	exportError = signal('');
	private printFrame?: HTMLIFrameElement;
	budgetLabel = computed(() => {
		const p = this.parent;
		const number = (value: number | null) => value === null ? 'غير محدد' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
		if (p.budgetType() === 'range') return `${number(p.budgetMin())} - ${number(p.budgetMax())} $`;
		if (p.budgetType() === 'hourly') return `${number(p.budgetHourly())} $/ساعة`;
		return `${number(p.budgetFixed())} $`;
	});
	guaranteeFee = computed(() => {
		const p = this.parent;
		return ((p.budgetType() === 'range' ? p.budgetMin() : p.budgetType() === 'hourly' ? p.budgetHourly() : p.budgetFixed()) || 0) * 0.01;
	});

	async exportPdf(): Promise<void> {
		if (this.isExporting()) return;
		this.isExporting.set(true);
		this.exportError.set('');
		try {
			this.printFrame?.remove();
			const source = this.host.nativeElement.querySelector<HTMLElement>('#request-review-document');
			if (!source) throw new Error('Review is unavailable');
			await printReviewDocument(source, this.parent.title() || 'ملخص طلب مشروع', frame => this.printFrame = frame);
		} catch {
			this.printFrame?.remove();
			this.exportError.set('تعذّر فتح نافذة التصدير. حاول مرة أخرى من متصفح يدعم الطباعة.');
		} finally {
			this.isExporting.set(false);
		}
	}

	ngOnDestroy(): void { this.printFrame?.remove(); }

	// Acknowledgments state
	acks = {
		data: signal(false),
		terms: signal(false),
		privacy: signal(false),
		publish: signal(false)
	};

	allAcksChecked = computed(() => {
		return this.acks.data() && this.acks.terms() && this.acks.privacy() && this.acks.publish();
	});

	private host = inject<ElementRef<HTMLElement>>(ElementRef);

	private static readonly ACK_MESSAGES: Record<string, string> = {
		data: 'أكّد صحة البيانات المدخلة للمتابعة',
		terms: 'وافق على شروط الاستخدام للمتابعة',
		privacy: 'أكّد اطلاعك على سياسة الخصوصية للمتابعة',
		publish: 'وافق على نشر الطلب للمزودين المؤهلين للمتابعة',
	};

	toggleAck(key: keyof typeof this.acks) {
		this.acks[key].set(!this.acks[key]());
		// checking an acknowledgement answers its own message only; the others keep theirs
		const row = this.host.nativeElement.querySelector<HTMLElement>(`#ack-${key}`);
		if (row && this.acks[key]()) clearInvalid(row);
	}

	/** Every unchecked acknowledgement, in page order, each tied to its own row. */
	ackProblems(): FieldProblem[] {
		return (Object.keys(this.acks) as (keyof typeof this.acks)[])
			.filter(k => !this.acks[k]())
			.map(k => ({ field: `ack-${k}`, message: Step6Review.ACK_MESSAGES[k] }));
	}

	toggleAckFromKeyboard(event: KeyboardEvent, key: keyof typeof this.acks) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			this.toggleAck(key);
		}
	}

	// Modal state
	showConfirmModal = signal(false);

	openModal() {
		if (this.allAcksChecked()) {
			this.showConfirmModal.set(true);
			return;
		}
		// the button stays clickable: say which acknowledgement is missing, under it, and focus the first
		void reportClientProblems(this.host.nativeElement, this.ackProblems());
	}

	closeModal() {
		this.showConfirmModal.set(false);
	}

	confirmPublish() {
		this.showConfirmModal.set(false);
		this.parent.submitRequest();
	}
}
