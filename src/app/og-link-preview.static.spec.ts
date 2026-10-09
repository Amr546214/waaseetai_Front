import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Link preview (WhatsApp / social): the tags live in the STATIC index.html (crawlers do not run JS) and point at a dedicated 1200x630 image.
const root = join(__dirname, '..', '..');
const html = readFileSync(join(root, 'src', 'index.html'), 'utf8');
const IMAGE_PATH = 'public/assets/social/waseetai-og-v1.png';
const IMAGE_URL = 'https://dev.waseetai.com/assets/social/waseetai-og-v1.png';
const meta = (attr: 'property' | 'name', key: string) => new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`).exec(html)?.[1];

describe('link preview meta (static index.html)', () => {
  it('Open Graph: type, title, description, url, absolute image (+secure_url), 1200x630 and alt', () => {
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:title')).toBe('وسيط AI | منصة الخدمات المهنية الذكية');
    expect(meta('property', 'og:description')).toBe('اربط طلبات الخدمة والعقود والمدفوعات في تجربة موثوقة مدعومة بالذكاء الاصطناعي.');
    expect(meta('property', 'og:url')).toBe('https://dev.waseetai.com/');
    expect(meta('property', 'og:image')).toBe(IMAGE_URL);
    expect(meta('property', 'og:image:secure_url')).toBe(IMAGE_URL);
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('property', 'og:image:height')).toBe('630');
    expect(meta('property', 'og:image:alt')).toBe('وسيط AI - منصة الخدمات المهنية الذكية');
  });

  it('Twitter: summary_large_image with title, description and the same image', () => {
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(meta('name', 'twitter:title')).toBeTruthy();
    expect(meta('name', 'twitter:description')).toBeTruthy();
    expect(meta('name', 'twitter:image')).toBe(IMAGE_URL);
  });

  it('the share image exists, is a real 1200x630 PNG, and is a separate asset from the site logo / favicon', () => {
    const png = readFileSync(join(root, IMAGE_PATH));
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    expect(IMAGE_PATH).not.toContain('brand/');
    expect(html).toContain('href="assets/brand/waseet-mark.png"');      // the favicon / logo are untouched
  });
});
