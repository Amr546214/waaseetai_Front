import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface DeliveryFile {
	name: string;
	type: string;
}

@Component({
	selector: 'app-review-project',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './review-project.html',
})
export class ReviewProject {
	projectDetails = {
		id: '#ORD-2026-0428-047',
		title: 'تسليم المرحلة 2: الهوية الكاملة',
		provider: 'نورة التصميم',
		status: 'بانتظار اعتمادك',
		amount: '1,500 ريال',
		submitted: 'قبل يوم',
		deadline: '6 أيام',
		filesCount: '4 ملفات'
	};

	files: DeliveryFile[] = [
		{ name: 'الشعار النهائي.ai', type: 'ai' },
		{ name: 'دليل الهوية.pdf', type: 'pdf' },
		{ name: 'الخطوط.zip', type: 'zip' },
		{ name: 'معاينة.png', type: 'png' },
	];

	aiQualityCheck = 'اجتاز فحص الذكاء: الملفات كاملة، بدقّة عالية، وبدون علامات مائية';

	openAccept() {
		// Logic to accept the delivery
		console.log('Accepting delivery and releasing payment...');
	}
}
