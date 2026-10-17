export interface DescriptionRewriteOption {
  id: string;
  title: string;
  markdown: string;
  text: string;
}

export interface DescriptionRewritePreview {
  introduction: string;
  options: DescriptionRewriteOption[];
  advice: string;
}

export const REWRITE_PREVIEW_MAX_CHARS = 30000;

/** Plain editable description; presentation Markdown never leaks into the submitted field. */
export function descriptionPlainText(markdown: string): string {
  return markdown.replace(/\r\n?/g, '\n')
    .replace(/^\s*```[^\n]*\n?|^\s*```\s*$/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1').replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*>\s?/gm, '').replace(/^\s*[-*•]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n').trim();
}

const headingText = (line: string) => line.trim().replace(/^#{1,6}\s*/, '').replace(/^[-*]\s+/, '').replace(/\*\*|__/g, '').trim();
const normalized = (text: string) => text.normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[أإآ]/g, 'ا');
const optionHeading = (line: string) => /^(?:(?:الخيار|الاقتراح|الصياغة|النسخة)\s+(?:الاول[ى]?|الاول|الثاني[ة]?|الثالث[ة]?|الرابع[ة]?|الخامس[ة]?|[0-9٠-٩]+)|(?:option|alternative|version)\s+(?:one|two|three|four|five|\d+))(?:\s*[:：\-–—.)]|\s*\(|\s*$)/i.test(normalized(headingText(line)));
const adviceHeading = (line: string) => /^(?:نصائح|نصيحة|ملاحظات|ملاحظة|ملحوظة|توصية|توصيات|قبل الارسال|انصحك|يمكنك اختيار|اختر الصياغة|tips?|notes?|recommendations?)(?:\s|[:：]|$)/i.test(normalized(headingText(line)));

/** Older service returns prose, not JSON. Split only explicit option headings, keeping advice separate. */
export function parseDescriptionRewrite(raw: string): DescriptionRewritePreview {
  const lines = String(raw ?? '').slice(0, REWRITE_PREVIEW_MAX_CHARS).replace(/\r\n?/g, '\n').split('\n');
  const introduction: string[] = [], advice: string[] = [], drafts: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null, inAdvice = false;
  for (const line of lines) {
    if (optionHeading(line)) {
      const heading = headingText(line), colon = heading.search(/[:：]/), suffix = colon >= 0 ? heading.slice(colon + 1).trim() : '';
      const inlineDraft = /^["“«]/.test(suffix) || /^(?:احتاج|ارغب|نحتاج|مطلوب|i need|we need|looking for)(?:\s|$)/i.test(normalized(suffix));
      current = { title: inlineDraft ? heading.slice(0, colon) : heading.replace(/[:：]\s*$/, ''), lines: inlineDraft ? [suffix.replace(/^["“«]|["”»]$/g, '')] : [] };
      drafts.push(current); inAdvice = false; continue;
    }
    if (current && adviceHeading(line)) { inAdvice = true; current = null; }
    if (inAdvice) advice.push(line);
    else if (current) current.lines.push(line);
    else introduction.push(line);
  }
  if (!drafts.length) {
    const body = lines.join('\n').trim();
    if (!body) return { introduction: '', options: [], advice: '' };
    // A single draft may still have a separate introduction/advice, but ordinary headings remain part of it.
    const firstBody = lines.findIndex(line => /^\s*#{1,6}\s+(?:الوصف|الصياغة|description|draft)(?:\s|[:：]|$)/i.test(line));
    const bodyLines = firstBody >= 0 ? lines.slice(firstBody + 1) : [...lines];
    const adviceStart = bodyLines.findIndex(adviceHeading);
    const singleAdvice = adviceStart >= 0 ? bodyLines.splice(adviceStart).join('\n').trim() : '';
    const markdown = bodyLines.join('\n').trim();
    return { introduction: firstBody > 0 ? lines.slice(0, firstBody).join('\n').trim() : '', options: markdown ? [{ id: 'option-1', title: 'الصياغة المقترحة', markdown, text: descriptionPlainText(markdown) }] : [], advice: singleAdvice };
  }
  return {
    introduction: introduction.join('\n').trim(), advice: advice.join('\n').trim(),
    options: drafts.map((draft, index) => {
      const markdown = draft.lines.join('\n').replace(/^\s*(?:---|\*\*\*)\s*$/gm, '').trim();
      return { id: `option-${index + 1}`, title: draft.title, markdown, text: descriptionPlainText(markdown) };
    }).filter(draft => !!draft.text),
  };
}

