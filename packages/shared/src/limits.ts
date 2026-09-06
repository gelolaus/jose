/** Soft ceiling for student attempt JSON (bytes of serialized body). */
export const MAX_ATTEMPT_PAYLOAD_BYTES = 8_192;

/** Authoring ceiling for lesson markdown. */
export const MAX_LESSON_MARKDOWN_CHARS = 50_000;

export function serializedJsonBytes(value: unknown): number | null {
  try {
    return JSON.stringify(value).length;
  } catch {
    return null;
  }
}
