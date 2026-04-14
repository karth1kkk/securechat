/** Prefix for structured chat payloads (encrypted as a single UTF-8 string). */
export const SC_MSG_PREFIX = '__SC_MSG__:';

export type RichMessageType = 'text' | 'sticker' | 'gif' | 'image' | 'video';

export type RichMessagePayload =
  | { type: 'text'; text: string }
  | { type: 'sticker'; emoji: string }
  | { type: 'gif'; url: string }
  | { type: 'image'; mime: string; base64: string }
  | { type: 'video'; mime: string; base64: string };

export function serializeRichMessage(payload: RichMessagePayload): string {
  return SC_MSG_PREFIX + JSON.stringify(payload);
}

/**
 * Accepts optional BOM, leading whitespace, and whitespace after `:` before the JSON payload.
 */
export function parseRichMessage(content: string): RichMessagePayload | null {
  if (!content || typeof content !== 'string') {
    return null;
  }
  const s = content.replace(/^\uFEFF/, '').trimStart();
  if (!s.startsWith(SC_MSG_PREFIX)) {
    return null;
  }
  const raw = s.slice(SC_MSG_PREFIX.length).trimStart();
  try {
    const p = JSON.parse(raw) as RichMessagePayload;
    if (!p || typeof p.type !== 'string') {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function previewRichMessage(content: string): string | null {
  const p = parseRichMessage(content);
  if (!p) {
    return null;
  }
  switch (p.type) {
    case 'text':
      return p.text;
    case 'sticker':
      return `Sticker ${p.emoji}`;
    case 'gif':
      return 'GIF';
    case 'image':
      return '📷 Photo';
    case 'video':
      return '🎬 Video';
    default:
      return 'Message';
  }
}
