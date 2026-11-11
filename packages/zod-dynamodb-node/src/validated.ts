/**
 * 検証済みの値の印（パッケージの中だけで使う。index からは出さない）。
 *
 * `executeOp` は、認可の前に入力を検証する。その結果を書き込みの部品（Accessor）にも渡し、
 * もう一度 `parse` しないようにする。こうすると、`authorize` が見た値と書く値が同じになる
 * （`default(() => randomUUID())` のように毎回違う値を作る Schema でも食い違わない）。
 * Accessor を直接呼ぶアプリの値は、この印がないので、いままでどおり検証される。
 */
export class Validated {
  constructor(readonly value: unknown) {}
}

/** 検証済みの印がある値はそのまま、なければ `parse` した値を返す */
export const validatedOr = (
  value: unknown,
  parse: (raw: unknown) => unknown,
): unknown => (value instanceof Validated ? value.value : parse(value));
