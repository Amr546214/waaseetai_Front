import { UserRole } from '../models/auth.model';
import { tourIntentFor } from './tour-intent';

describe('tourIntentFor: «اشرحلي لوحتي» starts the dashboard tour', () => {
	it('explain-the-dashboard requests match the acting role', () => {
		expect(tourIntentFor('اشرحلي لوحة طالب الخدمة', UserRole.CLIENT)).toBe(UserRole.CLIENT);
		expect(tourIntentFor('وريني لوحتي', UserRole.PROVIDER)).toBe(UserRole.PROVIDER);
		expect(tourIntentFor('عايز جولة في الداشبورد', UserRole.AFFILIATE)).toBe(UserRole.AFFILIATE);
		expect(tourIntentFor('اشرح لوحة المسوق', UserRole.AFFILIATE)).toBe(UserRole.AFFILIATE);
	});
	it('another role\'s dashboard, other questions, empty and signed-out are not matched', () => {
		expect(tourIntentFor('اشرحلي لوحة مقدم الخدمة', UserRole.CLIENT)).toBeNull();
		expect(tourIntentFor('ازاي انشر طلب', UserRole.CLIENT)).toBeNull();
		expect(tourIntentFor('اشرحلي ازاي اسحب فلوسي', UserRole.CLIENT)).toBeNull();
		expect(tourIntentFor('لوحة التحكم فين', UserRole.CLIENT)).toBeNull();
		expect(tourIntentFor('', UserRole.CLIENT)).toBeNull();
		expect(tourIntentFor('اشرحلي لوحتي', null)).toBeNull();
	});
});

import { isPageTourRequest, namedTourPage } from './tour-intent';
describe('isPageTourRequest', () => {
	it('matches «اشرحلي الصفحة دي» but not a dashboard request or plain talk', () => {
		expect(isPageTourRequest('اشرحلي الصفحة دي')).toBe(true);
		expect(isPageTourRequest('جولة في الصفحة')).toBe(true);
		expect(isPageTourRequest('اشرحلي لوحة طالب الخدمة')).toBe(false);
		expect(isPageTourRequest('ازاي ادفع')).toBe(false);
		expect(isPageTourRequest('اشرح المدونة')).toBe(true);
		expect(namedTourPage('اشرحلي صفحة من نحن')).toBe('/about');
		expect(namedTourPage('وريني اتصل بنا')).toBe('/contact');
	});
});
