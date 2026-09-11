import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';

export type ErrorType = '500' | '403' | 'maintenance' | 'session-expired';

@Component({
	selector: 'app-error-page',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './error-page.html',
	styleUrls: ['./error-page.css']
})
export class ErrorPageComponent {
	@Input() type: ErrorType = '500';

	private router = inject(Router);
	private route = inject(ActivatedRoute);

	ngOnInit() {
		// Read from route data if type input not set explicitly
		if (!this.type || this.type === '500') {
			const data = this.route.snapshot.data;
			if (data && data['type']) {
				this.type = data['type'] as ErrorType;
			}
		}
	}

	get config() {
		switch (this.type) {
			case '500':
				return {
					code: '500',
					icon: 'alert',
					iconBg: 'rgba(255,140,105,.1)',
					iconBd: 'rgba(255,140,105,.25)',
					iconColor: '#FF8068',
					title: 'خطأ في الخادم',
					desc: 'حدث خطأ غير متوقع من جانبنا. فريقنا أُشعر تلقائياً وسيعمل على الإصلاح فوراً.',
					primaryBtn: 'حاول مجدداً',
					primaryAction: 'reload',
					secondaryBtn: 'أبلغ عن المشكلة',
					secondaryRoute: '/help',
					showRef: true
				};
			case '403':
				return {
					code: '403',
					icon: 'lock',
					iconBg: 'rgba(123,47,190,.1)',
					iconBd: 'rgba(123,47,190,.25)',
					iconColor: '#A56BE0',
					title: 'وصول مرفوض',
					desc: 'ليس لديك صلاحية الوصول لهذه الصفحة. سجّل دخولك بحساب مناسب أو عد للرئيسية.',
					primaryBtn: 'تسجيل الدخول',
					primaryAction: 'login',
					secondaryBtn: 'الرئيسية',
					secondaryRoute: '/',
					showRef: false
				};
			case 'maintenance':
				return {
					code: '',
					icon: 'clock',
					iconBg: 'rgba(217,138,11,.1)',
					iconBd: 'rgba(217,138,11,.25)',
					iconColor: '#D98A0B',
					title: 'صيانة مجدولة',
					desc: 'وسيط في وضع الصيانة لتحديثات مهمة. سنعود قريباً — شكراً لصبرك.',
					primaryBtn: 'تحديث الصفحة',
					primaryAction: 'reload',
					secondaryBtn: '',
					secondaryRoute: '',
					showRef: false,
					showEta: true
				};
			case 'session-expired':
				return {
					code: '',
					icon: 'user',
					iconBg: 'rgba(43,127,255,.1)',
					iconBd: 'rgba(43,127,255,.25)',
					iconColor: '#5DA0FF',
					title: 'انتهت جلستك',
					desc: 'انتهت صلاحية جلستك لأسباب أمنية. سجّل دخولك مجدداً للمتابعة.',
					primaryBtn: 'تسجيل الدخول',
					primaryAction: 'login',
					secondaryBtn: 'الرئيسية',
					secondaryRoute: '/',
					showRef: false
				};
			default:
				return {
					code: '500',
					icon: 'alert',
					iconBg: 'rgba(255,140,105,.1)',
					iconBd: 'rgba(255,140,105,.25)',
					iconColor: '#FF8068',
					title: 'خطأ',
					desc: 'حدث خطأ غير متوقع.',
					primaryBtn: 'حاول مجدداً',
					primaryAction: 'reload',
					secondaryBtn: '',
					secondaryRoute: '',
					showRef: false
				};
		}
	}

	doPrimary() {
		const action = this.config.primaryAction;
		if (action === 'reload') {
			window.location.reload();
		} else if (action === 'login') {
			this.router.navigate(['/auth/login']);
		}
	}

	goHome() {
		this.router.navigate(['/']);
	}
}
