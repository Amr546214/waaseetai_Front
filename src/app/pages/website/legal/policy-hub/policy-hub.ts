import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface PolicyItem {
	title: string;
	desc: string;
	route: string;
	icon: 'file' | 'shield' | 'trust-ai';
	/** Icon tile colour, per design P-LG-001 */
	tone: 'teal' | 'blue' | 'ai';
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
				{ title: 'الشروط والأحكام', desc: 'القواعد الأساسية لاستخدام وسيط AI والعلاقة بين المستخدم والخدمة', route: '/terms', icon: 'file', tone: 'teal' },
				{ title: 'سياسة الخصوصية والبيانات', desc: 'كيف نجمع البيانات ونحفظها ونحميها وما حقوقك في بياناتك', route: '/privacy', icon: 'shield', tone: 'teal' },
				{ title: 'سياسة الكوكيز', desc: 'أنواع الكوكيز المستخدمة وكيفية التحكم فيها', route: '/cookies', icon: 'file', tone: 'teal' }
			]
		},
		{
			label: 'المالية والعقود',
			items: [
				{ title: 'الدفع والضمان والإلغاء والنزاعات', desc: 'الضمان المالي، رسوم الدفع، الإلغاء والاسترداد، النزاعات، السحب', route: '/legal/payment-escrow-disputes', icon: 'shield', tone: 'teal' },
				{ title: 'المستخدمون والخدمات والعقود', desc: 'متى ينشأ العقد، بدء العمل، التسليم والتعديلات، تغيير النطاق', route: '/legal/users-services-contracts', icon: 'file', tone: 'blue' },
				{ title: 'اتفاقية مقدم الخدمة', desc: 'الشروط والالتزامات والحقوق الخاصة بمقدمي الخدمات', route: '/legal/provider-agreement', icon: 'file', tone: 'blue' }
			]
		},
		{
			label: 'الوسيط والمستويات',
			items: [
				{ title: 'الوسيط التسويقي والعمولات والمستويات', desc: 'قاعدة First-Touch، متى تستحق العمولة، منع الإحالة الذاتية', route: '/legal/marketing-broker-commissions', icon: 'file', tone: 'blue' }
			]
		},
		{
			label: 'الاعتماد والذكاء الاصطناعي',
			items: [
				{ title: 'الاعتماد والتحقق وحوكمة AI', desc: 'KYC/KYB، اعتماد التخصصات، دور AI، كسر تقييم AI', route: '/legal/accreditation-ai-governance', icon: 'trust-ai', tone: 'ai' }
			]
		},
		{
			label: 'الاستخدام والملكية',
			items: [
				{ title: 'الاستخدام المقبول والملكية الفكرية والبلاغات', desc: 'السلوك الممنوع، البلاغات، انتقال حقوق المخرجات', route: '/legal/acceptable-use-ip', icon: 'shield', tone: 'teal' }
			]
		},
		{
			label: 'المساعدة',
			items: [
				{ title: 'مركز المساعدة والأسئلة المهمة', desc: 'إجابات مباشرة على الأسئلة الشائعة حول الضمان والنزاعات والسحب والعمولات', route: '/support/help-center', icon: 'file', tone: 'teal' }
			]
		}
	];
}
