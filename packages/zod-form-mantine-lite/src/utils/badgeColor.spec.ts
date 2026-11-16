import { describe, expect, it } from "vitest";
import {
  badgeTextColor,
  computeBadgeColors,
  contrastRatio,
  oklchToRgb,
  parseCssColor,
  rgbToOklch,
  type Rgb,
} from "./badgeColor";

const WHITE: Rgb = [255, 255, 255];

describe("rgbToOklch / oklchToRgb", () => {
  it("往復で元の色に戻る", () => {
    for (const rgb of [
      [34, 139, 230],
      [250, 82, 82],
      [64, 192, 87],
      [0, 0, 0],
      [255, 255, 255],
    ] as Rgb[]) {
      expect(oklchToRgb(rgbToOklch(rgb))).toEqual(rgb);
    }
  });

  it("白の L は 1、黒の L は 0", () => {
    expect(rgbToOklch(WHITE)[0]).toBeCloseTo(1, 3);
    expect(rgbToOklch([0, 0, 0])[0]).toBeCloseTo(0, 3);
  });

  it("sRGB に収まらない色は鮮やかさを下げて収める", () => {
    const rgb = oklchToRgb([0.5, 0.4, 0]);
    rgb.forEach((c) => {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(255);
    });
  });
});

describe("contrastRatio", () => {
  it("白と黒は 21、同じ色は 1", () => {
    expect(contrastRatio(WHITE, [0, 0, 0])).toBeCloseTo(21, 5);
    expect(contrastRatio([10, 20, 30], [10, 20, 30])).toBe(1);
  });
});

describe("badgeTextColor", () => {
  it("明るい背景は、同じ色相で背景の L − 0.45 の暗い文字", () => {
    const bg: Rgb = [208, 235, 255]; // blue.1
    const text = badgeTextColor(bg);
    const [bgL, , bgH] = rgbToOklch(bg);
    const [L, , h] = rgbToOklch(text);
    expect(L).toBeCloseTo(bgL - 0.45, 2);
    expect(h).toBeCloseTo(bgH, 1);
    expect(contrastRatio(text, bg)).toBeGreaterThan(4.5);
  });

  it("暗い背景は白", () => {
    expect(badgeTextColor([25, 113, 194])).toEqual(WHITE); // blue.8
    expect(badgeTextColor([0, 0, 0])).toEqual(WHITE);
  });

  it("文字の L が 0.30 未満になる背景（背景の L が 0.75 未満）は白", () => {
    const bg: Rgb = [34, 139, 230]; // blue.6（L ≈ 0.63）
    expect(rgbToOklch(bg)[0]).toBeLessThan(0.75);
    expect(badgeTextColor(bg)).toEqual(WHITE);
  });

  it("灰色の背景は灰色の文字", () => {
    const [r, g, b] = badgeTextColor([233, 233, 233]);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(1);
    expect(r).toBeLessThan(128);
  });

  it("白の方がコントラストが高ければ白", () => {
    // L は 0.75 以上だが、文字候補より白の方が見やすい鮮やかな色
    const bg: Rgb = [255, 140, 0];
    const text = badgeTextColor(bg);
    if (text !== WHITE) {
      expect(contrastRatio(text, bg)).toBeGreaterThan(contrastRatio(WHITE, bg));
    }
  });
});

describe("parseCssColor", () => {
  it("#hex（3・4・6・8 桁）", () => {
    expect(parseCssColor("#fff")).toEqual([255, 255, 255]);
    expect(parseCssColor("#3b82f6")).toEqual([59, 130, 246]);
    expect(parseCssColor("#3B82F6FF")).toEqual([59, 130, 246]);
    expect(parseCssColor("#f00f")).toEqual([255, 0, 0]);
  });

  it("rgb() / rgba() / hsl()", () => {
    expect(parseCssColor("rgb(59, 130, 246)")).toEqual([59, 130, 246]);
    expect(parseCssColor("rgb(59 130 246)")).toEqual([59, 130, 246]);
    expect(parseCssColor("rgba(59, 130, 246, 1)")).toEqual([59, 130, 246]);
    expect(parseCssColor("rgb(100%, 0%, 0%)")).toEqual([255, 0, 0]);
    expect(parseCssColor("hsl(0, 100%, 50%)")).toEqual([255, 0, 0]);
    expect(parseCssColor("hsl(120 100% 25%)")).toEqual([0, 128, 0]);
  });

  it("透明度のある色・var()・名前の色は計算しない", () => {
    expect(parseCssColor("#3b82f680")).toBeNull();
    expect(parseCssColor("rgba(59, 130, 246, 0.5)")).toBeNull();
    expect(parseCssColor("rgb(59 130 246 / 50%)")).toBeNull();
    expect(parseCssColor("var(--mantine-color-blue-6)")).toBeNull();
    expect(parseCssColor("tomato")).toBeNull();
    expect(parseCssColor("blue.6")).toBeNull();
  });
});

describe("computeBadgeColors", () => {
  it("背景はそのまま、文字色を足す", () => {
    expect(computeBadgeColors("#1971c2")).toEqual({
      background: "rgb(25, 113, 194)",
      color: "rgb(255, 255, 255)",
    });
  });

  it("計算できない色は null", () => {
    expect(computeBadgeColors("tomato")).toBeNull();
  });
});
