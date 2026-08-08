export type HighlightSegmentType = "text" | "highlight" | "wavy";

export interface HighlightSegment {
  type: HighlightSegmentType;
  content: string;
}

/**
 * 把模型返回文本中的轻量标记解析为可渲染片段。
 *
 * 语法：
 * - `==关键句==`    → 荧光笔高亮（highlight）
 * - `~~风险点~~`    → 波浪下划线（wavy）
 *
 * 标记必须成对出现、不嵌套；未匹配到的文本原样返回。
 */
export function parseHighlight(text: string): HighlightSegment[] {
  const segments: HighlightSegment[] = [];
  const pattern = /==([^=]+)==|~~([^~]+)~~/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "highlight", content: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ type: "wavy", content: match[2] });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}
