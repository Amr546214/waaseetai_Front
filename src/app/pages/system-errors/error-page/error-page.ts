import { AfterViewInit, Component, ElementRef, HostBinding, Input, OnInit, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { CommonModule, Location, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

export type ErrorType = '404' | '500' | '403' | 'maintenance' | 'session-expired';

interface ErrorConfig {
	code: string;
	icon: 'search' | 'alert' | 'lock' | 'clock' | 'user';
	tone: 'red' | 'kahr' | 'blue' | 'ai';
	title: string;
	desc: string;
	primaryBtn: string;
	/** Router link for the primary button; when empty the button reloads the page. */
	primaryRoute: string;
	secondaryBtn: string;
	secondaryRoute: string;
	showRef?: boolean;
	showEta?: boolean;
	showBack?: boolean;
}

// Texts, icons and colours follow design-reference/.../12-النظام-والاخطاء/P-SY-001..005.html
const CONFIGS: Record<ErrorType, ErrorConfig> = {
	'404': {
		code: '404', icon: 'search', tone: 'red',
		title: 'الصفحة غير موجودة',
		desc: 'الصفحة التي تبحث عنها ربما نُقلت أو حُذفت أو الرابط غير صحيح.',
		primaryBtn: 'العودة للرئيسية', primaryRoute: '/',
		secondaryBtn: 'تصفح الخدمات', secondaryRoute: '/marketplace',
		showBack: true
	},
	'500': {
		code: '500', icon: 'alert', tone: 'red',
		title: 'خطأ في الخادم',
		desc: 'حدث خطأ غير متوقع من جانبنا. فريقنا أُشعر تلقائياً وسيعمل على الإصلاح فوراً.',
		primaryBtn: 'حاول مجدداً', primaryRoute: '',
		secondaryBtn: 'أبلغ عن المشكلة', secondaryRoute: '/support/report-problem',
		showRef: true
	},
	'403': {
		code: '403', icon: 'lock', tone: 'ai',
		title: 'وصول مرفوض',
		desc: 'ليس لديك صلاحية الوصول لهذه الصفحة. سجّل دخولك بحساب مناسب أو عد للرئيسية.',
		primaryBtn: 'تسجيل الدخول', primaryRoute: '/auth/login',
		secondaryBtn: 'الرئيسية', secondaryRoute: '/'
	},
	'maintenance': {
		code: '', icon: 'clock', tone: 'kahr',
		title: 'صيانة مجدولة',
		desc: 'وسيط في وضع الصيانة لتحديثات مهمة. سنعود بعد اكتمال التحديثات — شكراً لصبرك.',
		primaryBtn: 'تحديث الصفحة', primaryRoute: '',
		secondaryBtn: '', secondaryRoute: '',
		showEta: true
	},
	'session-expired': {
		code: '', icon: 'user', tone: 'blue',
		title: 'انتهت جلستك',
		desc: 'انتهت صلاحية جلستك لأسباب أمنية. سجّل دخولك مجدداً للمتابعة.',
		primaryBtn: 'تسجيل الدخول', primaryRoute: '/auth/login',
		secondaryBtn: 'الرئيسية', secondaryRoute: '/'
	}
};

@Component({
	selector: 'app-error-page',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './error-page.html',
	styleUrls: ['./error-page.css']
})
export class ErrorPageComponent implements OnInit, AfterViewInit {
	@Input() type: ErrorType | '' = '';
	/**
	 * True when the page is rendered INSIDE the dashboard layout (route data `embedded: true`):
	 * the layout already provides the background grid, particles and logo, so only the card is drawn.
	 */
	@HostBinding('class.embedded') embedded = false;

	@ViewChild('particles') private particlesRef?: ElementRef<HTMLDivElement>;

	private route = inject(ActivatedRoute);
	private location = inject(Location);
	private platformId = inject(PLATFORM_ID);

	ngOnInit() {
		// Read from route data if the type input was not set explicitly
		const data = this.route.snapshot.data;
		if (!this.type) {
			this.type = (data && data['type'] ? data['type'] : '500') as ErrorType;
		}
		this.embedded = data?.['embedded'] === true;
	}

	ngAfterViewInit() {
		// Same floating particles as the design (25 desktop / 11 mobile)
		const pc = this.particlesRef?.nativeElement;
		if (!pc || !isPlatformBrowser(this.platformId)) return;
		const n = window.innerWidth < 768 ? 11 : 25;
		for (let i = 0; i < n; i++) {
			const p = document.createElement('div');
			p.className = 'particle';
			const sz = (Math.random() * 2.5 + 2).toFixed(1) + 'px';
			p.style.cssText = 'left:' + (Math.random() * 100) + '%;width:' + sz + ';height:' + sz + ';animation-duration:' + (Math.random() * 9 + 5).toFixed(1) + 's;animation-delay:-' + (Math.random() * 12).toFixed(1) + 's;opacity:' + (Math.random() * .35 + .08).toFixed(2);
			pc.appendChild(p);
		}
	}

	get config(): ErrorConfig {
		return CONFIGS[(this.type || '500') as ErrorType] ?? CONFIGS['500'];
	}

	doPrimary(ev: Event) {
		ev.preventDefault();
		window.location.reload();
	}

	goBack(ev: Event) {
		ev.preventDefault();
		this.location.back();
	}
}
