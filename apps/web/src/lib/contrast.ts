/** Relative luminance and contrast helpers for author-selectable colors (WCAG). */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim().replace(/^#/, "");
  if (!/^[\da-fA-F]{6}$/.test(raw)) return null;
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

export function relativeLuminance(hex: string): number | null {
  const rgb = parseHexColor(hex);
  if (!rgb) return null;
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(foreground: string, background: string): number | null {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  if (l1 === null || l2 === null) return null;
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function meetsWcagAa(foreground: string, background: string, largeText = false): boolean {
  const ratio = contrastRatio(foreground, background);
  if (ratio === null) return false;
  return largeText ? ratio >= 3 : ratio >= 4.5;
}

export function accessibleColorName(hex: string): string {
  const map: Record<string, string> = {
    "#A855F7": "Violet",
    "#22C55E": "Green",
    "#38BDF8": "Sky blue",
    "#F97316": "Orange",
    "#EF4444": "Red",
    "#F5C518": "Gold",
    "#FB7185": "Rose",
  };
  return map[hex.toUpperCase()] ?? `Color ${hex}`;
}

/** Prefer white or near-black label ink on a cover swatch. */
export function bestLabelInk(background: string): "#FFFFFF" | "#0F172A" {
  const white = contrastRatio("#FFFFFF", background) ?? 0;
  const ink = contrastRatio("#0F172A", background) ?? 0;
  return white >= ink ? "#FFFFFF" : "#0F172A";
}
