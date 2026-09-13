import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';

export interface ClientProjectHistoryItem {
	id: string;
	title: string;
	icon: string;
	iconColor: string;
	status: 'done' | 'active';
	providerName: string;
	date: string;
	price: string;
}

export interface ClientReviewGiven {
	id: string;
	providerName: string;
	initial: string;
	avatarColor: string;
	rating: number;
	project: string;
	date: string;
	comment: string;
}

export interface ClientPublicProfile {
	id: string;
	name: string;
	initial: string;
	isVerified: boolean;
	trustLabel: string;
	location: string;
	memberSince: string;
	interests: string[];
	stats: {
		completedProjects: number;
		avgRating: number;
		commitmentRate: number;
		avgResponseTime: string;
		activeRequests: number;
	};
	aiTrust: {
		overall: number;
		payment: number;
		commitment: number;
		bars: { label: string; value: number; valueLabel: string }[];
	};
	about: string;
	history: ClientProjectHistoryItem[];
	reviewsGiven: ClientReviewGiven[];
	accountType: string;
	language: string;
	lastActive: string;
	budgetRange: string;
	avgSpend: string;
	preferredCategories: { label: string; color: string }[];
	aiRecommendation: string;
}

function buildMockClientProfile(id: string): ClientPublicProfile {
	return {
		id,
		name: 'محمد الغامدي',
		initial: 'م',
		isVerified: true,
		trustLabel: 'عميل موثوق',
		location: 'جدة، المملكة العربية السعودية',
		memberSince: '2023',
		interests: ['التصميم الجرافيكي', 'التسويق الرقمي', 'تطوير المواقع', 'المحتوى'],
		stats: { completedProjects: 18, avgRating: 4.8, commitmentRate: 92, avgResponseTime: '48 س', activeRequests: 3 },
		aiTrust: {
			overall: 94,
			payment: 97,
			commitment: 89,
			bars: [
				{ label: 'تاريخ الدفع', value: 97, valueLabel: 'ممتاز' },
				{ label: 'وضوح متطلباته', value: 82, valueLabel: 'جيد' },
				{ label: 'سرعة الاستجابة', value: 76, valueLabel: 'جيد' },
				{ label: 'مستوى التعاون', value: 91, valueLabel: 'مرتفع' }
			]
		},
		about: 'يستعين بمقدمي خدمات في مجالات التصميم والتسويق الرقمي والبرمجة وتطوير المحتوى. سجله يُظهر التزاماً بالمدفوعات في الوقت المحدد وتعاوناً إيجابياً مع المقدمين. يوضح متطلباته مسبقاً ويستجيب للتواصل بانتظام.',
		history: [
			{ id: 'p1', title: 'تصميم هوية بصرية لتطبيق توصيل', icon: 'ws-tag', iconColor: 'var(--teal)', status: 'done', providerName: 'سارة الحربي', date: 'مارس 2024', price: '1,800 ريال' },
			{ id: 'p2', title: 'إدارة حملة سوشيال ميديا — 3 أشهر', icon: 'ws-tag', iconColor: '#0FA99A', status: 'done', providerName: 'أحمد العتيبي', date: 'يناير 2024', price: '4,500 ريال' },
			{ id: 'p3', title: 'تطوير موقع إلكتروني للشركة', icon: 'ws-briefcase', iconColor: '#5DA0FF', status: 'active', providerName: 'فيصل السلمي', date: 'يونيو 2024', price: '8,200 ريال' },
			{ id: 'p4', title: 'كتابة محتوى تسويقي — 20 مقال', icon: 'ws-tag', iconColor: 'var(--teal)', status: 'done', providerName: 'نور الزهراني', date: 'نوفمبر 2023', price: '2,200 ريال' }
		],
		reviewsGiven: [
			{ id: 'r1', providerName: 'سارة الحربي', initial: 'س', avatarColor: 'var(--grad)', rating: 5, project: 'تصميم هوية بصرية', date: 'مارس 2024', comment: 'متميزة جداً، فهمت المتطلبات من أول وهلة وسلّمت العمل قبل الموعد. سأتعامل معها مجدداً بلا تردد.' },
			{ id: 'r2', providerName: 'أحمد العتيبي', initial: 'أ', avatarColor: 'linear-gradient(135deg,#0FA99A,#2BD4C7)', rating: 4.5, project: 'إدارة حملة سوشيال', date: 'يناير 2024', comment: 'محترف وملتزم، نتائج الحملة كانت أفضل من التوقعات. التقارير منظمة وواضحة.' },
			{ id: 'r3', providerName: 'نور الزهراني', initial: 'ن', avatarColor: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', rating: 5, project: 'كتابة محتوى', date: 'نوفمبر 2023', comment: 'كاتبة رائعة، أسلوبها سلس ومقنع. التزمت بالمواعيد وقبلت الملاحظات باحترافية عالية.' }
		],
		accountType: 'فرد',
		language: 'العربية، الإنجليزية',
		lastActive: 'اليوم',
		budgetRange: '500 — 10,000',
		avgSpend: '3,200 ريال',
		preferredCategories: [
			{ label: 'التصميم', color: 'var(--teal)' },
			{ label: 'التسويق', color: '#5DA0FF' },
			{ label: 'المحتوى', color: '#0FA99A' },
			{ label: 'البرمجة', color: '#5DA0FF' }
		],
		aiRecommendation: 'عميل موثوق بمعدل دفع 97% — يُنصح بقبول عروضه. متطلباته واضحة ويتعاون بشكل إيجابي مع المقدمين.'
	};
}

@Component({
	selector: 'app-client-profile',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './client-profile.html',
	styleUrl: './client-profile.css'
})
export class ClientProfileComponent implements OnInit {
	private platformId = inject(PLATFORM_ID);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private authStore = inject(AuthStore);

	profile = signal<ClientPublicProfile | null>(null);
	loading = signal<boolean>(true);

	ngOnInit(): void {
		this.route.paramMap.subscribe(params => {
			const id = params.get('id') || 'unknown';
			this.loading.set(true);
			// Clients/requesters are not publicly listed by the backend today, so this page is
			// built with representative mock data matching the design until such an endpoint exists.
			setTimeout(() => {
				this.profile.set(buildMockClientProfile(id));
				this.loading.set(false);
				if (isPlatformBrowser(this.platformId)) {
					setTimeout(() => this.initParticles(), 0);
				}
			}, 150);
		});
	}

	sendMessage() {
		if (!this.authStore.isAuthenticated()) {
			this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
			return;
		}
		this.router.navigate(['/provider-overview/messages']);
	}

	ringDashOffset(value: number, radius: number): number {
		const circumference = 2 * Math.PI * radius;
		return circumference - (circumference * value) / 100;
	}

	starArray(rating: number): ('full' | 'half' | 'empty')[] {
		const result: ('full' | 'half' | 'empty')[] = [];
		for (let i = 1; i <= 5; i++) {
			if (rating >= i) result.push('full');
			else if (rating >= i - 0.5) result.push('half');
			else result.push('empty');
		}
		return result;
	}

	private initParticles() {
		const pc = document.getElementById('particles-container');
		if (!pc || pc.children.length > 0) return;
		const n = window.innerWidth < 768 ? 11 : 25;
		for (let i = 0; i < n; i++) {
			const p = document.createElement('div');
			p.className = 'particle';
			p.style.cssText = 'left:' + Math.random() * 100 + '%;width:' + (Math.random() * 3 + 2) + 'px;height:' + (Math.random() * 3 + 2) + 'px;animation-duration:' + (Math.random() * 20 + 15) + 's;animation-delay:-' + (Math.random() * 20) + 's';
			pc.appendChild(p);
		}
	}
}
