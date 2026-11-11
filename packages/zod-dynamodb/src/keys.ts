import { SEPARATOR, utf8Length, type FieldEncoder } from "./encoding";
import { CorruptedDataError, ValidationError } from "./errors";

/** キーを構成するフィールドの並びと、それぞれのエンコード方式 */
export type KeyPart = {
  readonly fields: readonly string[];
  readonly encoders: readonly FieldEncoder[];
};

/** Partition Keyの長さの上限（バイト） */
export const MAX_PARTITION_KEY_BYTES = 2048;
/** Sort Keyの長さの上限（バイト） */
export const MAX_SORT_KEY_BYTES = 1024;

/**
 * 物理キーを組み立てる（§5.5）。`<entity>#<f1>#<f2>…`、フィールドがなければ `<entity>`。
 * フィールドが一つでも `undefined` なら `undefined` を返す（sparse index）。
 */
export const composeKey = (
  entity: string,
  part: KeyPart,
  values: Record<string, unknown>,
): string | undefined => {
  let key = entity;
  for (let i = 0; i < part.fields.length; i++) {
    const value = values[part.fields[i]!];
    if (value === undefined) return undefined;
    key += SEPARATOR + part.encoders[i]!.encode(value);
  }
  return key;
};

/** 長さの上限を超えるキーを拒否する */
export const checkKeyLength = (
  key: string,
  maxBytes: number,
  label: string,
): string => {
  if (utf8Length(key) > maxBytes) {
    throw new ValidationError(
      `${label} exceeds ${maxBytes} bytes after encoding`,
    );
  }
  return key;
};

/**
 * 物理キーから論理キーを逆算する。エンティティ名の接頭辞を照合し、
 * 壊れたデータや別のエンティティのItemはエラーにする。
 */
export const decomposeKey = (
  entity: string,
  part: KeyPart,
  key: string,
): Record<string, unknown> => {
  const segments = key.split(SEPARATOR);
  if (segments[0] !== entity) {
    throw new CorruptedDataError(
      `key "${key}" does not belong to entity "${entity}"`,
    );
  }
  if (segments.length !== part.fields.length + 1) {
    throw new CorruptedDataError(
      `key "${key}" does not have ${part.fields.length} fields`,
    );
  }
  const values: Record<string, unknown> = {};
  part.fields.forEach((field, i) => {
    values[field] = part.encoders[i]!.decode(segments[i + 1]!);
  });
  return values;
};
