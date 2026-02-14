/**
 * URL のクエリ（`URLSearchParams`）へエンコードできる値の木構造ノード。
 *
 * - `string`: URLSearchParams に格納される最小単位（最終的に文字列になる）
 * - `undefined`: optional フィールドなど「パラメータとして存在しない」扱い
 * - `ParamsTreeItem[]`: 配列/タプル表現
 * - `Record<string, ParamsTreeItem>`: オブジェクト表現
 */
export type ParamsTreeItem =
  | string
  | undefined
  | ParamsTreeItem[]
  | {
      [key: string]: ParamsTreeItem;
    };

/**
 * `URLSearchParams` を表現するためのオブジェクト形式の木構造。
 *
 * `foo.bar=baz` のような「`.` 区切りのパス」をネストしたオブジェクトとして保持します。
 */
export type ParamsTree = {
  [key: string]: ParamsTreeItem;
};
