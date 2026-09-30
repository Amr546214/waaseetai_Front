import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { AssistantStore } from '../../../../core/store/assistant.store';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MarketerOverviewService, MarketerSummary } from '../../../../core/services/marketer-overview.service';

@Component({
	selector: 'app-marketer-help',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	templateUrl: './help.html',
	styleUrl: './help.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Help implements OnInit {
	readonly assistant = inject(AssistantStore);
	private overviewService = inject(MarketerOverviewService);

	summary = signal<MarketerSummary | null>(null);

	searchQuery = signal<string>('');
	searchedQuery = signal<string>('');

	toastMessage = signal<string | null>(null);
	faqState = signal<boolean[]>([false, false, false, false, false]);

	ngOnInit(): void {
		this.overviewService.getSummary().subscribe(res => {
			if (res.success) this.summary.set(res.data);
		});
	}

	// The help search box now asks the ONE real shared assistant (WaseetAI
	// help via the backend) and shows the streamed answer in the dashboard
	// Avatar panel. The previous client-side keyword match + setTimeout
	// "answer" was removed.
	askAI(): void {
		const q = this.searchQuery().trim();
		if (!q) {
			this.showToast('اكتب سؤالك أولًا');
			return;
		}
		this.searchedQuery.set(q);
		this.assistant.openAndAsk(q);
	}

	fillQ(text: string): void {
		this.searchQuery.set(text);
		this.askAI();
	}

	toggleFaq(index: number): void {
		const state = [...this.faqState()];
		state[index] = !state[index];
		this.faqState.set(state);
	}

	showToast(msg: string): void {
		this.toastMessage.set(msg);
		setTimeout(() => this.toastMessage.set(null), 3000);
	}
}
