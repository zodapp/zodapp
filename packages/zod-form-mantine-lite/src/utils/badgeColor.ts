/**
 * バッジの背景色から、読みやすい文字色を決める（React・Mantine に依存しない純粋な関数）。
 *
 * - 背景を OKLCH（見た目に沿った明るさ L・鮮やかさ C・色相 H）にする
 * - 暗い文字の候補は、色相は背景と同じ、明るさは背景の L − 0.45、
 *   鮮やかさは min(0.35 × 文字の L, 背景の C × 8)。sRGB に収まらなければ鮮やかさだけ下げる
 * - 候補の L が 0.30 未満（黒っぽすぎる）か、白の方がコントラスト比が高ければ白
 */

export type Rgb = readonly [number, number, number];
export type Oklch = readonly [number, number, number];

/** 文字の明るさ ＝ 背景の L − この値 */
export const BADGE_TEXT_L_OFFSET = 0.45;
/** 文字の明るさがこれ未満なら白にする */
export const BADGE_TEXT_MIN_L = 0.3;

const WHITE: Rgb = [255, 255, 255];

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const fromLinear = (c: number) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return v * 255;
};

/** sRGB（0〜255）→ OKLCH（H はラジアン） */
export const rgbToOklch = ([r, g, b]: Rgb): Oklch => {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(a, bb), Math.atan2(bb, a)];
};

/** OKLab → 線形 sRGB（範囲外もそのまま返す） */
const oklabToLinear = (L: number, a: number, b: number) => {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ] as const;
};

const inGamut = (rgb: readonly number[]) =>
  rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6);

/** OKLCH → sRGB（0〜255）。sRGB に収まらなければ鮮やかさだけ下げる */
export const oklchToRgb = ([L, C, h]: Oklch): Rgb => {
  const at = (c: number) => oklabToLinear(L, c * Math.cos(h), c * Math.sin(h));
  let linear = at(C);
  if (!inGamut(linear)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(at(mid))) lo = mid;
      else hi = mid;
    }
    linear = at(lo);
  }
  const [r, g, b] = linear.map((c) =>
    Math.round(fromLinear(Math.min(1, Math.max(0, c)))),
  );
  return [r!, g!, b!];
};

/** WCAG の相対輝度 */
export const relativeLuminance = ([r, g, b]: Rgb) =>
  0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

/** WCAG のコントラスト比（1〜21） */
export const contrastRatio = (x: Rgb, y: Rgb) => {
  const a = relativeLuminance(x);
  const b = relativeLuminance(y);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** 背景色から文字色を決める */
export const badgeTextColor = (background: Rgb): Rgb => {
  const [L, C, h] = rgbToOklch(background);
  const textL = Math.max(0, L - BADGE_TEXT_L_OFFSET);
  if (textL < BADGE_TEXT_MIN_L) return WHITE;
  const dark = oklchToRgb([textL, Math.min(0.35 * textL, C * 8), h]);
  return contrastRatio(WHITE, background) >= contrastRatio(dark, background)
    ? WHITE
    : dark;
};

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`;
const HEX_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_RE = new RegExp(
  String.raw`^(rgba?|hsla?)\(\s*(${NUMBER})(%?)\s*[,\s]\s*(${NUMBER})(%?)\s*[,\s]\s*(${NUMBER})(%?)\s*(?:[,/]\s*(${NUMBER})(%?)\s*)?\)$`,
  "i",
);

const clamp255 = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const hue = (((h % 360) + 360) % 360) / 360;
  const sat = Math.min(1, Math.max(0, s));
  const lig = Math.min(1, Math.max(0, l));
  const q = lig < 0.5 ? lig * (1 + sat) : lig + sat - lig * sat;
  const p = 2 * lig - q;
  const channel = (t0: number) => {
    const t = t0 < 0 ? t0 + 1 : t0 > 1 ? t0 - 1 : t0;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    clamp255(channel(hue + 1 / 3) * 255),
    clamp255(channel(hue) * 255),
    clamp255(channel(hue - 1 / 3) * 255),
  ];
};

/**
 * `#hex`・`rgb()`・`hsl()` を sRGB にする。
 * 透明度が 1 未満の色、`var()`、名前の CSS 色など、計算できないものは null
 */
export const parseCssColor = (input: string): Rgb | null => {
  const text = input.trim();
  const hex = HEX_RE.exec(text);
  if (hex) {
    let digits = hex[1]!;
    if (digits.length <= 4) {
      digits = digits
        .split("")
        .map((d) => d + d)
        .join("");
    }
    if (digits.length === 8 && digits.slice(6).toLowerCase() !== "ff") {
      return null;
    }
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
    ];
  }

  const fn = FUNC_RE.exec(text);
  if (!fn) return null;
  const [, name, v1, p1, v2, p2, v3, p3, alpha, alphaPercent] = fn;
  if (alpha !== undefined) {
    const a = parseFloat(alpha) / (alphaPercent ? 100 : 1);
    if (a < 1) return null;
  }
  if (name!.toLowerCase().startsWith("rgb")) {
    const channel = (v: string, percent: string) =>
      clamp255(percent ? (parseFloat(v) / 100) * 255 : parseFloat(v));
    return [channel(v1!, p1!), channel(v2!, p2!), channel(v3!, p3!)];
  }
  if (p1) return null;
  return hslToRgb(
    parseFloat(v1!),
    parseFloat(v2!) / 100,
    parseFloat(v3!) / 100,
  );
};

export const rgbToCss = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;

/**
 * バッジの背景と文字色。計算できない色は null（Mantine の `light` のまま描く）
 */
export const computeBadgeColors = (
  background: string,
): { background: string; color: string } | null => {
  const rgb = parseCssColor(background);
  if (!rgb) return null;
  return { background: rgbToCss(rgb), color: rgbToCss(badgeTextColor(rgb)) };
};
