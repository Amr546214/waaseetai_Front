import { stageHeading, deliveryHeading, stripStagePrefix } from './stage-title.util';
import { deliveryFileOpenUrl, deliveryFileDownloadUrl, isOpenableUrl } from './delivery-file.util';

describe('stage title helpers: one «المرحلة N», never two', () => {
	it('strips a stored prefix (digits, Arabic-Indic digits, ordinal words, any separator)', () => {
		for (const t of ['المرحلة 1: تصميم', 'المرحلة 1 - تصميم', 'المرحلة ١: تصميم', 'المرحلة الأولى: تصميم', 'تسليم المرحلة 1: تصميم', ' المرحلة 1 تصميم']) expect(stripStagePrefix(t), t).toBe('تصميم');
		expect(stripStagePrefix('تصميم المرحلة الأخيرة')).toBe('تصميم المرحلة الأخيرة');
	});
	it('builds exactly one heading', () => {
		expect(stageHeading(1, 'المرحلة 1: تصميم')).toBe('المرحلة 1: تصميم');
		expect(stageHeading(2, 'تصميم')).toBe('المرحلة 2: تصميم');
		expect(stageHeading(3, 'المرحلة 3')).toBe('المرحلة 3');
		expect(deliveryHeading(1, 'المرحلة 1: تصميم')).toBe('تسليم المرحلة 1: تصميم');
		expect(deliveryHeading(1, 'تسليم المرحلة 1: تصميم')).toBe('تسليم المرحلة 1: تصميم');
		expect(stageHeading(null, 'تصميم')).toBe('تصميم');
	});
});

describe('delivery file helpers: how a stored file opens / downloads', () => {
	const UP = 'https://res.cloudinary.com/demo/image/upload/v123/waseetai/deliveries/p/s/a.pdf';
	it('open = the stored https URL; anything else is not a link', () => {
		expect(deliveryFileOpenUrl({ url: UP })).toBe(UP);
		for (const bad of ['logo.png', 'javascript:alert(1)', 'data:text/html,x', 'http://example.com/a', '', undefined]) expect(isOpenableUrl(bad), String(bad)).toBe(false);
		expect(deliveryFileOpenUrl({ name: 'x', url: 'logo.png' })).toBeNull();
	});
	it('download = the same Cloudinary file with the attachment flag; external links and raw names have none', () => {
		expect(deliveryFileDownloadUrl({ url: UP })).toBe('https://res.cloudinary.com/demo/image/upload/fl_attachment/v123/waseetai/deliveries/p/s/a.pdf');
		expect(deliveryFileDownloadUrl({ url: 'https://res.cloudinary.com/demo/raw/upload/v1/x/y.zip' })).toBe('https://res.cloudinary.com/demo/raw/upload/fl_attachment/v1/x/y.zip');
		expect(deliveryFileDownloadUrl({ url: 'https://res.cloudinary.com/demo/image/upload/fl_attachment/v1/x.pdf' })).toBe('https://res.cloudinary.com/demo/image/upload/fl_attachment/v1/x.pdf');
		expect(deliveryFileDownloadUrl({ url: 'https://www.figma.com/file/abc' })).toBeNull();
		expect(deliveryFileDownloadUrl({ url: 'https://evil.com/res.cloudinary.com/image/upload/x.pdf' })).toBeNull();
		expect(deliveryFileDownloadUrl({ url: 'logo.png' })).toBeNull();
	});
});
