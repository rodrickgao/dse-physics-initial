// Standalone lecture notes do not send readers to exercise pages in the source book.
export const textbookReferencePattern=/^(?:(?:單元|单元)?(?:練習|练习)|複習|複雜|复习|溫習|温习|Revision|Exercise)\s*\d[\s\S]*(?:Q\s*\d|第\s*\d[^<>]*[題题])[\s\S]*(?:[（(]\s*p\.?\s*\d+\s*[）)]|[（(]\s*第\s*\d+\s*[頁页]\s*[）)])\s*$/i;
const inlineReference=/(?:(?:單元|单元)?(?:練習|练习)|複習|複雜|复习|溫習|温习|Revision|Exercise)\s*\d+(?:\.\d+)*\s*Q\s*\d+(?:\([a-z]\))?\s*[（(]\s*p\.?\s*\d+\s*[）)]/gi;
const superscriptReference=/<sup>(?:複習|複雜|复习|溫習|温习|練習|练习)\s*\d+(?:\.\d+)*<\/sup>\s*<sup>Q\s*\d+<\/sup>\s*<sup>\(p\.?\s*\d+\)<\/sup>/gi;
export function omitTextbookReferences(html=''){
 return html.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/g,(paragraph,body)=>textbookReferencePattern.test(body.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim())?'':paragraph.replace(superscriptReference,'').replace(inlineReference,''));
}
