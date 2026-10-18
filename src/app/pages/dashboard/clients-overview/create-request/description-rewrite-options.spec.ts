import { descriptionPlainText, parseDescriptionRewrite } from './description-rewrite-options';

describe('description rewrite options', () => {
  it('separates three real Arabic options from introduction and footer advice', () => {
    const result = parseDescriptionRewrite('تفضل الصياغات المقترحة:\n\n**الخيار الأول (موجز):**\nأحتاج إلى **متجر إلكتروني**.\n\n---\n### الخيار الثاني: تفصيلي\n- متجر ملابس\n- دفع إلكتروني\n\nالخيار الثالث: منظم\nوصف ثالث مستقل.\n\n**ملاحظات مهمة:**\nراجع الصياغة قبل استخدامها.');
    expect(result.options).toHaveLength(3);
    expect(result.introduction).toBe('تفضل الصياغات المقترحة:');
    expect(result.options[0].text).toBe('أحتاج إلى متجر إلكتروني.');
    expect(result.options[1].text).toBe('- متجر ملابس\n- دفع إلكتروني');
    expect(result.options[2].text).toBe('وصف ثالث مستقل.');
    expect(result.advice).toContain('راجع الصياغة');
    expect(result.options.every(option => !option.text.includes('ملاحظات'))).toBe(true);
  });

  it('recognizes feminine Arabic labels and English option headings without splitting ordinary paragraphs', () => {
    expect(parseDescriptionRewrite('## الصياغة الأولى: موجزة\nمسودة أولى\n## الصياغة الثانية: منظمة\nمسودة ثانية').options).toHaveLength(2);
    expect(parseDescriptionRewrite('### Option 1: Brief\nFirst draft\n### Option 2: Detailed\nSecond draft\n## Notes\nPlease review').options).toHaveLength(2);
    expect(parseDescriptionRewrite('أحتاج متجرًا. الخيار الأول للعميل هو اختيار المنتجات.').options).toHaveLength(1);
    const inline = parseDescriptionRewrite('**الخيار الأول:** "أحتاج متجرًا للملابس."\n**الخيار الثاني:** أحتاج متجرًا مع لوحة إدارة.');
    expect(inline.options.map(option => option.text)).toEqual(['أحتاج متجرًا للملابس.', 'أحتاج متجرًا مع لوحة إدارة.']);
  });

  it('keeps the full combined preview above the form limit and treats a single draft independently', () => {
    const first = 'وصف متجر إلكتروني واضح. '.repeat(60), second = 'وصف متجر مع تفاصيل الدفع. '.repeat(60);
    const result = parseDescriptionRewrite(`### الخيار الأول: موجز\n${first}\n### الخيار الثاني: تفصيلي\n${second}`);
    expect(result.options).toHaveLength(2);
    expect(result.options[1].text).toBe(second.trim());
    expect(parseDescriptionRewrite('## الوصف المقترح\n**وصف مرتب**\n- مطلب واحد').options[0].text).toBe('وصف مرتب\n- مطلب واحد');
  });

  it('removes presentation markup while preserving paragraphs, list structure and user numbers', () => {
    expect(descriptionPlainText('### الوصف\nأحتاج **متجرًا** خلال 14 يومًا.\n\n1. الدفع\n2. إدارة المخزون\n[تفاصيل](https://example.com)')).toBe('الوصف\nأحتاج متجرًا خلال 14 يومًا.\n\n1. الدفع\n2. إدارة المخزون\nتفاصيل');
  });
});
