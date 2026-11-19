import { TourDefinition } from '../tour.types';

/**
 * The tour for someone who has no account yet: what Waseet is, how it works, and how to register. It never enters the dashboard.
 * Every sentence below restates what the pages themselves say (home sections and the registration page); nothing is promised beyond them.
 * Written in Modern Standard Arabic; the audio files are rendered from exactly these texts.
 */
export const VISITOR_TOUR: TourDefinition = {
	id: 'visitor-v1',
	title: 'جولة التعريف بوسيط AI',
	steps: [
		{ id: 'visitor-welcome', route: '/', title: 'مرحبًا بك في وسيط AI',
			text: 'أنا وسيط AI، وسأصحبك في جولة قصيرة أعرّفك فيها بالمنصة وبطريقة التسجيل فيها. يمكنك أن تتخطى الجولة في أي وقت.' },
		{ id: 'visitor-hero', route: '/', target: '.hero', title: 'ما هي المنصة؟',
			text: 'وسيط AI منصة تربط طالبي الخدمات بمقدّميها عبر عقود رقمية موثقة وضمانات مالية. التسجيل بدون رسوم، والقرار النهائي دائمًا لك.' },
		{ id: 'visitor-how', route: '/', target: '#how-it-works', title: 'كيف تعمل؟',
			text: 'تعمل المنصة في أربع خطوات. تنشئ حسابك، ثم تنشر طلبك أو عرضك، ثم توقّع العقد وتدفع الضمان، وأخيرًا تسلّم وتستلم.' },
		{ id: 'visitor-ops', route: '/', target: '#ops', title: 'الحماية والضمان',
			text: 'تبقى المدفوعات في حساب ضمان حتى يكتمل التسليم، والعقود موثقة، والفواتير والسجلات قابلة للتتبع. وفي حال النزاع يقترح الذكاء الاصطناعي ثم يراجع الدعم البشري، ويبقى حق الاستئناف محفوظًا.' },
		{ id: 'visitor-ai', route: '/', target: '#ai', title: 'دور الذكاء الاصطناعي',
			text: 'الذكاء الاصطناعي في وسيط يدعمك ولا يقرر وحده. يوصي بالمقدّم المناسب ويحلل التقييمات، لكنه يقترح ولا يفرض، والقرار النهائي لك.' },
		{ id: 'visitor-roles', route: '/', target: '#audience', title: 'خمسة أدوار في موقع واحد',
			text: 'للمنصة خمسة أدوار: طالب خدمة فردًا أو شركة، ومقدّم خدمة فردًا أو شركة، ووسيط تسويقي يكسب عمولة عن الصفقات الناجحة.' },
		{ id: 'visitor-register', route: '/auth/register', target: '.roles-grid', title: 'كيف تسجّل؟',
			text: 'هنا تختار نوع حسابك. حسابات الأفراد وحساب الوسيط التسويقي متاحة الآن، وحسابات الشركات قريبًا، ومقدّم الخدمة يحتاج إلى توثيق هويته. بعد ذلك تدخل اسم المستخدم والبريد الإلكتروني ورقم الجوال وكلمة المرور، ثم تؤكد بريدك الإلكتروني برمز يصلك.' },
		{ id: 'visitor-end', route: '/auth/register', title: 'وبعد التسجيل',
			text: 'عند دخولك إلى لوحة التحكم ستجد جولة أخرى تشرح لك كل صفحة وكل زر بحسب دورك. بالتوفيق.' },
	],
};
