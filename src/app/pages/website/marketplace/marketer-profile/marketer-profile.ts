import { Component, OnInit, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';

export interface MarketerChannel {
	id: string;
	platform: string;
	icon: string;
	iconBg: string;
	handle: string;
	description: string;
	followers: number;
	followersLabel: string;
	followersUnit: string;
	engagementRate: number;
	reachLabel: string;
	niches: string[];
	status: 'available' | 'completed' | 'seasonal';
	aiScore: number;
}

export interface MarketerPublicProfile {
	id: string;
	name: string;
	initials: string;
	headline: string;
	bio: string[];
	isVerified: boolean;
	respondsWithin: string;
	niches: string[];
	stats: {
		totalFollowers: string;
		engagementRate: string;
		monthlyReach: string;
		campaigns: number;
		aiScore: number;
	};
	aiRings: { label: string; value: number; color: string }[];
	aiBars: { label: string; value: number; valueLabel: string; color: string }[];
	audience: {
		countries: { label: string; pct: number; color: string }[];
		ageRange: string;
		gender: string;
		interests: string;
	};
	channels: MarketerChannel[];
}

function buildMockMarketerProfile(id: string): MarketerPublicProfile {
	return {
		id,
		name: 'فهد الغامدي',
		initials: 'فه',
		headline: 'صانع محتوى ومسوّق رقمي — متخصص في الترويج للخدمات المهنية عبر منصات سوشيال ميديا · 7 سنوات خبرة',
		bio: [
			'صانع محتوى ومسوّق رقمي بخبرة 7 سنوات في مجال الترويج للخدمات المهنية عبر سوشيال ميديا. جمهوري يتكوّن من أصحاب الأعمال ورواد الأعمال السعوديين الذين يبحثون باستمرار عن خدمات احترافية موثوقة.',
			'أعمل كوسيط بين مقدمي الخدمات المتميزين وجمهوري المستهدف — أختار بعناية الخدمات التي أؤمن بجودتها وأروّج لها بأسلوب صادق وموثوق. لم أروّج لأي خدمة لم أختبرها أو أتحقق من جودتها بنفسي.'
		],
		isVerified: true,
		respondsWithin: 'نشط الآن · يرد خلال ساعة',
		niches: ['التسويق الرقمي', 'ريادة الأعمال', 'Content Creator', 'Instagram · YouTube · TikTok'],
		stats: {
			totalFollowers: '1.2M',
			engagementRate: '4.8%',
			monthlyReach: '340K',
			campaigns: 127,
			aiScore: 96
		},
		aiRings: [
			{ label: 'أصالة المتابعين', value: 98, color: '#2BD4C7' },
			{ label: 'جودة المحتوى', value: 96, color: '#A56BE0' },
			{ label: 'معدل التحويل', value: 94, color: '#5DA0FF' },
			{ label: 'رضا المعلنين', value: 95, color: '#0FA99A' }
		],
		aiBars: [
			{ label: 'نسبة المتابعين الحقيقيين (AI Verified)', value: 98, valueLabel: '98%', color: 'linear-gradient(90deg,#2BD4C7,#2B7FFF)' },
			{ label: 'معدل الوصول العضوي مقابل المدفوع', value: 78, valueLabel: '78% عضوي', color: 'linear-gradient(90deg,#2BD4C7,#0FA99A)' },
			{ label: 'معدل الطلبات بعد كل حملة', value: 84, valueLabel: '4.2%', color: 'linear-gradient(90deg,#D98A0B,#FFB400)' },
			{ label: 'تكرار التعاون مع نفس المعلن', value: 67, valueLabel: '67%', color: 'linear-gradient(90deg,#2BD4C7,#2B7FFF)' }
		],
		audience: {
			countries: [
				{ label: 'السعودية', pct: 68, color: 'linear-gradient(90deg,#2BD4C7,#2B7FFF)' },
				{ label: 'الإمارات والخليج', pct: 22, color: 'linear-gradient(90deg,#2BD4C7,#0FA99A)' },
				{ label: 'دول أخرى', pct: 10, color: 'rgba(107,118,153,.4)' }
			],
			ageRange: '25-40 سنة',
			gender: '62% ذكور',
			interests: 'أعمال · تقنية'
		},
		channels: [
			{ id: 'ig', platform: 'Instagram', icon: 'ws-social-instagram', iconBg: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)', handle: '@fahad.creative', description: 'محتوى تسويقي · نصائح ريادية · استعراض خدمات', followers: 620000, followersLabel: '620K', followersUnit: 'متابع', engagementRate: 5.2, reachLabel: '280K', niches: ['Reels', 'Stories', 'Carousel', 'تسويق'], status: 'available', aiScore: 97 },
			{ id: 'yt', platform: 'YouTube', icon: 'ws-social-youtube', iconBg: '#FF0000', handle: 'فهد الغامدي', description: 'مراجعات خدمات · رأيي · تجارب حقيقية', followers: 380000, followersLabel: '380K', followersUnit: 'مشترك', engagementRate: 4.1, reachLabel: '180K', niches: ['فيديو طويل', 'Shorts', 'مراجعات'], status: 'available', aiScore: 98 },
			{ id: 'tt', platform: 'TikTok', icon: 'ws-social-tiktok', iconBg: '#010101', handle: '@fahad.mkt', description: 'فيديوهات قصيرة · ترندز تسويقية', followers: 210000, followersLabel: '210K', followersUnit: 'متابع', engagementRate: 6.8, reachLabel: '95K', niches: ['ترند', 'تحدي', 'تسويق'], status: 'completed', aiScore: 92 },
			{ id: 'sc', platform: 'Snapchat', icon: 'ws-social-snapchat', iconBg: 'linear-gradient(135deg,#FFFC00,#FFE600)', handle: 'fahad.g', description: 'قصص يومية · كواليس العمل', followers: 95000, followersLabel: '95K', followersUnit: 'مشاهد', engagementRate: 3.4, reachLabel: '40K', niches: ['قصص', 'كواليس'], status: 'available', aiScore: 89 },
			{ id: 'x', platform: 'X', icon: 'ws-social-x', iconBg: '#000', handle: '@fahad_g', description: 'تغريدات ريادية · نقاشات تقنية', followers: 65000, followersLabel: '65K', followersUnit: 'متابع', engagementRate: 2.9, reachLabel: '22K', niches: ['نص', 'نقاش'], status: 'available', aiScore: 90 },
		]
	};
}

@Component({
	selector: 'app-marketer-profile',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './marketer-profile.html',
	styleUrl: './marketer-profile.css'
})
export class MarketerProfileComponent implements OnInit {
	private platformId = inject(PLATFORM_ID);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private authStore = inject(AuthStore);

	profile = signal<MarketerPublicProfile | null>(null);
	loading = signal<boolean>(true);
	activeTab = signal<'profile' | 'channels'>('profile');
	channelStatusFilter = signal<'all' | 'available' | 'completed' | 'seasonal'>('all');
	isFavorite = signal<boolean>(false);

	filteredChannels = computed(() => {
		const channels = this.profile()?.channels || [];
		const filter = this.channelStatusFilter();
		return filter === 'all' ? channels : channels.filter(c => c.status === filter);
	});

	channelCountByStatus(status: 'available' | 'completed' | 'seasonal'): number {
		return (this.profile()?.channels || []).filter(c => c.status === status).length;
	}

	ngOnInit(): void {
		this.route.paramMap.subscribe(params => {
			const id = params.get('id') || 'unknown';
			this.loading.set(true);
			// No public marketer-by-id endpoint exists yet on the backend (marketer-profile.service
			// only exposes the authenticated marketer's own profile). Using representative mock data
			// that mirrors the shape of MarketerProfile / AffiliateChannelHandle so a real endpoint
			// can be swapped in later with minimal changes.
			setTimeout(() => {
				this.profile.set(buildMockMarketerProfile(id));
				this.loading.set(false);
				if (isPlatformBrowser(this.platformId)) {
					setTimeout(() => this.initParticles(), 0);
				}
			}, 150);
		});
	}

	setTab(tab: 'profile' | 'channels') {
		this.activeTab.set(tab);
	}

	setChannelFilter(filter: 'all' | 'available' | 'completed' | 'seasonal') {
		this.channelStatusFilter.set(filter);
	}

	toggleFavorite() {
		this.isFavorite.set(!this.isFavorite());
	}

	requestMarketing() {
		if (!this.authStore.isAuthenticated()) {
			this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
			return;
		}
		this.router.navigate(['/client-overview/messages']);
	}

	ringOffset(value: number): number {
		const circumference = 175.9;
		return circumference - (circumference * value) / 100;
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
