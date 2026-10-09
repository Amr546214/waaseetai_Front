import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// A passed assessment is never an approval (the admin decides): none of the old approval claims may come back.
const root = join(process.cwd(), 'src/app');
const files = [
	'pages/dashboard/provider-overview/profile/specialties/specialties.html',
	'pages/dashboard/provider-overview/profile/specialties/specialties.ts',
	'core/services/anti-cheat.service.ts',
];
const forbidden = [
	'مبروك! تم اجتياز الاختبار بنجاح واعتماد تخصصك',
	'واعتماد تخصصك',
	'تم ربط شارة الجدارة المهنية',
	'اعتماد الشارة رسمياً',
	'واعتماد شارة التميز',
	'مفعلة وموثقة',
	'لتفعيل التخصص وبشارة التميز',
	'تسليم واعتماد النتيجة',
	'STATIC_FALLBACK',
	"'APPROVED' : 'FAILED'",
];

describe('assessment flow never claims an approval the backend did not make', () => {
	for (const f of files) {
		const text = readFileSync(join(root, f), 'utf8');
		for (const phrase of forbidden) {
			it(`${f.split('/').pop()} does not contain "${phrase}"`, () => {
				expect(text.includes(phrase)).toBe(false);
			});
		}
	}
});
