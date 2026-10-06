import { Component, ChangeDetectionStrategy, signal, inject, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

interface ChatMessage {
	from: 'me' | 'agent' | 'sys';
	time: string;
	text: string;
}

@Component({
	selector: 'app-provider-live-support',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	templateUrl: './live-support.html',
	styleUrls: ['./live-support.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiveSupportComponent implements AfterViewChecked {
	private router = inject(Router);
	private authStore = inject(AuthStore);

	@ViewChild('thread') threadRef?: ElementRef<HTMLDivElement>;
	private shouldScroll = false;

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	agentName = computed(() => this.isCompanyMode() ? 'عبدالله المطيري' : 'سارة');
	agentInitial = computed(() => this.isCompanyMode() ? 'عم' : 'س');
	agentTitle = computed(() => this.isCompanyMode() ? 'دعم الشركات' : 'فريق الدعم');

	inputText = signal<string>('');
	isTyping = signal<boolean>(false);
	toast = signal<string | null>(null);

	messages = signal<ChatMessage[]>([]);

	quickReplies = computed<string[]>(() => this.isCompanyMode()
		? ['استفسار عن أمر تغيير', 'مشكلة في محفظة الشركة', 'استفسار عن فاتورة رسمية', 'أريد فتح تذكرة']
		: ['عندي مشكلة في مبلغ الضمان', 'استفسار عن تسوية رصيد', 'مشكلة تقنية في الطلب', 'أريد فتح تذكرة']
	);

	// No real live-support ticket context exists for this chat, so no ticket reference is invented.
	ticketRef = computed<string | null>(() => null);

	constructor() {
		this.messages.set([
			{ from: 'sys', time: 'الآن', text: 'بدأت المحادثة مع فريق الدعم' },
			{
				from: 'agent',
				time: 'الآن',
				text: this.isCompanyMode()
					? 'أهلًا بكم، معك عبدالله من دعم الشركات. كيف أقدر أساعد شركتكم اليوم؟'
					: 'أهلًا، معي سارة من فريق دعم وسيط AI. كيف أقدر أساعدك اليوم؟ تقدر تكتب استفسارك وسأتابعه معك مباشرة'
			}
		]);
	}

	ngAfterViewChecked() {
		if (this.shouldScroll && this.threadRef) {
			const el = this.threadRef.nativeElement;
			el.scrollTop = el.scrollHeight;
			this.shouldScroll = false;
		}
	}

	send(event?: Event, text?: string) {
		event?.preventDefault();
		const value = (text ?? this.inputText()).trim();
		if (!value) return;

		this.messages.update(msgs => [...msgs, { from: 'me', time: 'الآن', text: value }]);
		this.inputText.set('');
		this.shouldScroll = true;
		this.isTyping.set(true);

		setTimeout(() => {
			this.isTyping.set(false);
			this.messages.update(msgs => [...msgs, {
				from: 'agent',
				time: 'الآن',
				text: 'تم استلام رسالتك، سأتحقق من التفاصيل وأعود إليك خلال دقائق. هل تحتاج أي معلومة إضافية بخصوص نفس الموضوع؟'
			}]);
			this.shouldScroll = true;
		}, 1100);
	}

	sendQuick(text: string) {
		this.send(undefined, text);
	}

	escalateToTicket() {
		this.showToast('يمكنك تحويل هذه المحادثة إلى تذكرة دعم متتبَّعة');
		setTimeout(() => this.router.navigate(['/provider-overview/help/tickets/new']), 900);
	}

	goToTickets() {
		this.router.navigate(['/provider-overview/help/tickets']);
	}

	goToHelp() {
		this.router.navigate(['/provider-overview/help']);
	}

	showToast(msg: string) {
		this.toast.set(msg);
		setTimeout(() => this.toast.set(null), 3000);
	}
}
