const ID_RE = /^[A-Za-z0-9_-]{11}$/;

const URL_PATTERNS = [
  /(?:youtube\.com\/watch\?[^#]*v=)([A-Za-z0-9_-]{11})/,
  /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  /(?:youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{11})/,
];

export function parseYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (ID_RE.test(trimmed)) return trimmed;
  for (const pattern of URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}
