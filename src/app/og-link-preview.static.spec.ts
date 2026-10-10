import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Link preview (WhatsApp / social): the tags live in the STATIC index.html (crawlers do not run JS) and point at a dedicated 1200x630 image.
const root = join(__dirname, '..', '..');
const html = readFileSync(join(root, 'src', 'index.html'), 'utf8');
const IMAGE_PATH = 'public/assets/social/waseetai-og-v3.jpg';
const IMAGE_URL = 'https://dev.waseetai.com/assets/social/waseetai-og-v3.jpg';
const TITLE = 'وسيط AI | الوساطة المهنية الذكية';
const DESCRIPTION = 'يربط طالبي الخدمات بمقدميها عبر الذكاء الاصطناعي، من اختيار الأنسب والتعاقد إلى متابعة التنفيذ والتسليم، مع ضمان مالي يحفظ حقوق الطرفين.';
const meta = (attr: 'property' | 'name', key: string) => new RegExp(`<meta\\s+${attr}="${key}"\\s+content="([^"]*)"`).exec(html)?.[1];

describe('link preview meta (static index.html)', () => {
  it('Open Graph: type, title, description, url, absolute image (+secure_url), 1200x630 and alt', () => {
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:title')).toBe(TITLE);
    expect(meta('property', 'og:description')).toBe(DESCRIPTION);
    expect(meta('property', 'og:url')).toBe('https://dev.waseetai.com/');
    expect(meta('property', 'og:image')).toBe(IMAGE_URL);
    expect(meta('property', 'og:image:url')).toBe(IMAGE_URL);
    expect(meta('property', 'og:image:secure_url')).toBe(IMAGE_URL);
    expect(meta('property', 'og:image:type')).toBe('image/jpeg');
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('property', 'og:image:height')).toBe('630');
    expect(meta('property', 'og:image:alt')).toBe('شعار وسيط AI');
  });

  it('Twitter: summary_large_image with title, description and the same image', () => {
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(meta('name', 'twitter:title')).toBe(TITLE);
    expect(meta('name', 'twitter:description')).toBe(DESCRIPTION);
    expect(meta('name', 'twitter:image:alt')).toBe('شعار وسيط AI');
    expect(meta('name', 'twitter:image')).toBe(IMAGE_URL);
  });

  it('the share image is a real 1200x630 baseline JPEG under 200 KB (RGB, no transparency), separate from the logo / favicon', () => {
    const jpg = readFileSync(join(root, IMAGE_PATH));
    expect(jpg[0]).toBe(0xff); expect(jpg[1]).toBe(0xd8);              // JPEG signature
    expect(jpg.length).toBeLessThan(200_000);
    // find the SOF0/SOF2 marker: precision, height, width, components(3 = YCbCr/RGB, never an alpha channel)
    let i = 2, w = 0, h = 0, comps = 0;
    while (i < jpg.length) {
      const marker = jpg[i + 1]; const len = jpg.readUInt16BE(i + 2);
      if (marker === 0xc0 || marker === 0xc2) { h = jpg.readUInt16BE(i + 5); w = jpg.readUInt16BE(i + 7); comps = jpg[i + 9]; break; }
      i += 2 + len;
    }
    expect([w, h, comps]).toEqual([1200, 630, 3]);
    expect(IMAGE_PATH).not.toContain('brand/');
    expect(html).toContain('href="assets/brand/waseet-mark.png"');      // the favicon / logo are untouched
    expect(html).not.toContain('waseetai-og-v2.jpg');                    // the old cached file name is no longer referenced (new name defeats the WhatsApp cache)
  });
});
