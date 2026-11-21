import { describe, expect, it } from "vitest";
import { getDistributedWidth, layoutWidths } from "./width";

describe("幅の決め方", () => {
  it("余りが無ければ広げない（入れ物より大きくても縮めない）", () => {
    expect(layoutWidths([{ width: 300 }, { width: 300 }], 500, 8)).toEqual([
      300, 300,
    ]);
  });

  it("余りを widthWeight（無ければ幅）の比で配る。間の幅は余りから引く", () => {
    // 合計 100+300+8 = 408、余り 92 を 1:3 で配る
    expect(layoutWidths([{ width: 100 }, { width: 300 }], 500, 8)).toEqual([
      123, 369,
    ]);
    expect(
      layoutWidths(
        [
          { width: 100, widthWeight: 1 },
          { width: 300, widthWeight: 0 },
        ],
        500,
        8,
      ),
    ).toEqual([192, 300]);
  });

  it("入れ物の幅が分からない（0）ときは、そのままの幅", () => {
    expect(layoutWidths([{ width: 280 }], 0)).toEqual([280]);
  });

  it("重みの合計が 0 なら配らない", () => {
    expect(getDistributedWidth(100, 0, 50, 0)).toBe(100);
  });
});
