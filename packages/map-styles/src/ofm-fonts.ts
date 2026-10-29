/**
 * OpenFreeMap glyph stacks that actually resolve.
 *
 * OFM serves Noto Sans Regular / Bold / Italic. Composite stacks that include
 * "Open Sans …" 404 (`Noto Sans Bold,Open Sans Bold`), and MapLibre then holds
 * the whole vector tile (fills + roads) until those glyphs arrive — blank map.
 */
export const OFM_FONT_REGULAR = ["Noto Sans Regular"] as const;
export const OFM_FONT_BOLD = ["Noto Sans Bold"] as const;
export const OFM_FONT_ITALIC = ["Noto Sans Italic"] as const;
