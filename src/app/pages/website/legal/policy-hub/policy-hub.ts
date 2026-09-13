import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface PolicyItem {
	title: string;
	desc: string;
	route: string;
	icon: 'file' | 'shield' | 'ai';
}

interface PolicyGroup {
	label: string;
	items: PolicyItem[];
}

@Component({
	selector: 'app-policy-hub',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './policy-hub.html',
	styleUrls: ['./policy-hub.css']
})
export class PolicyHub {
	groups: PolicyGroup[] = [
		{
			label: 'الأساسيات',
			items: [
				{ title: 'الشروط والأحكام', desc: 'القواعد الأساسية لاستخدام وسيط AI والعلاقة بين المستخدم والخدمة', route: '/terms', icon: 'file' },
				{ title: 'سياسة الخصوصية والبيانات', desc: 'كيف نجمع البيانات ونحفظها ونحميها وما حقوقك في بياناتك', route: '/privacy', icon: 'shield' },
				{ title: 'سياسة الكوكيز', desc: 'أنواع الكوكيز المستخدمة وكيفية التحكم فيها', route: '/cookies', icon: 'file' }
			]
		},
		{
			label: 'العقود والخدمات',
			items: [
				{ title: 'المستخدمون والخدمات والعقود', desc: 'متى ينشأ العقد، بدء العمل، التسليم والتعديلات، تغيير النطاق', route: '/legal/users-services-contracts', icon: 'file' },
				{ title: 'اتفاقية مقدم الخدمة', desc: 'الشروط والالتزامات والحقوق الخاصة بمقدمي الخدمات', route: '/legal/provider-agreement', icon: 'file' }
			]
		},
		{
			label: 'الوسيط والمستويات',
			items: [
				{ title: 'الوسيط التسويقي والعمولات والمستويات', desc: 'قاعدة First-Touch، متى تستحق العمولة، منع الإحالة الذاتية', route: '/legal/marketing-broker-commissions', icon: 'file' }
			]
		},
		{
			label: 'الاعتماد والذكاء الاصطناعي',
			items: [
				{ title: 'الاعتماد والتحقق وحوكمة AI', desc: 'KYC/KYB، اعتماد التخصصات، دور AI، الاعتراض على قرار AI', route: '/legal/accreditation-ai-governance', icon: 'ai' }
			]
		},
		{
			label: 'الاستخدام والملكية',
			items: [
				{ title: 'الاستخدام المقبول والملكية الفكرية والبلاغات', desc: 'السلوك الممنوع، البلاغات، انتقال حقوق المخرجات', route: '/legal/acceptable-use-ip', icon: 'shield' }
			]
		}
	];
}
