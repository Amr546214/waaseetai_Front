import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
	selector: 'app-join-provider',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './join-provider.component.html',
	styleUrls: ['./join-provider.component.css']
})
export class JoinProviderComponent {
	steps = [
		{ num: 1, title: 'سجّل حسابك', desc: 'أنشئ حساب مقدم خدمة وأكمل التحقق' },
		{ num: 2, title: 'اعتمد تخصصاتك', desc: 'اختبر التصنيف الأولي واعتمد تخصصاتك' },
		{ num: 3, title: 'انشر خدماتك', desc: 'أنشئ نماذج أعمال واعرض خدماتك' },
		{ num: 4, title: 'استقبل الطلبات', desc: 'استقبل عروض واقبل المشاريع بعقود موثقة' }
	];

	benefits = [
		{ icon: 'shield', title: 'ضمان مالي', desc: 'كل مشروع محمي بحساب الضمان المالي' },
		{ icon: 'ai', title: 'ذكاء اصطناعي', desc: 'مساعد AI يساعدك في التسعير والتسليم' },
		{ icon: 'wallet', title: 'سحب مرن', desc: 'سحب أسبوعي مع حد أدنى 500 ريال' },
		{ icon: 'star', title: 'تقييم موثق', desc: 'بناء سمعة عبر تقييمات حقيقية' }
	];
}
