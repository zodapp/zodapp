/**
 * 幅の決め方（表の列と、entries-horizontal のカードで共通）。
 * 各項目の幅（meta の `width`、無ければ既定）を下限にし、入れ物に余りがあれば、
 * `widthWeight`（無ければ幅）の比で余りを配って広げる。余りが無ければ広げない（入れ物が横にスクロールする）
 */

/** 余りを weight の比で配ったあとの幅 */
export const getDistributedWidth = (
  width: number,
  widthWeight: number,
  extraWidth: number,
  totalWidthWeight: number,
) => {
  if (extraWidth <= 0 || totalWidthWeight <= 0) return width;
  const ratio = widthWeight / totalWidthWeight;
  return width + extraWidth * ratio;
};

/**
 * 項目を並べたときの、それぞれの幅。containerWidth は並べる入れ物の幅、gap は項目の間の幅。
 * 幅の合計（間を含む）が containerWidth より小さいときだけ、余りを配る
 */
export const layoutWidths = (
  items: readonly { width: number; widthWeight?: number }[],
  containerWidth: number,
  gap = 0,
): number[] => {
  const totalWidth =
    items.reduce((sum, item) => sum + item.width, 0) +
    gap * Math.max(0, items.length - 1);
  const totalWidthWeight = items.reduce(
    (sum, item) => sum + (item.widthWeight ?? item.width),
    0,
  );
  const extraWidth = Math.max(0, containerWidth - totalWidth);
  return items.map((item) =>
    getDistributedWidth(
      item.width,
      item.widthWeight ?? item.width,
      extraWidth,
      totalWidthWeight,
    ),
  );
};
