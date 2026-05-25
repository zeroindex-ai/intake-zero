/**
 * Mirrors app/globals.css tokens for use in TS where we need string values
 * (e.g., dynamic styles, charts, email templates). Source of truth is the
 * STYLE_GUIDE.md in the zeroindex-site repo.
 */
export const palette = {
  bg: '#faf9f5',
  bgSoft: '#f4f3ef',
  ink: '#18181b',
  muted: '#52525b',
  muted2: '#71717a',
  line: '#cfc9bd',
  lineStrong: '#9c958a',
  accent1: '#7c3aed',
  accent2: '#4f46e5',
  accent3: '#c026d3',
  accentGo: '#16a34a',
  warn: '#b45309',
  error: '#be123c',
  card: '#18181b',
  cardInk: '#fafaf9',
  cardMuted: '#a1a1aa',
  cardLine: '#3f3f46',
} as const;
