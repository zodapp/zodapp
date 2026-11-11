import { randomUUID } from "node:crypto";

/**
 * キーとして受け付けるか。空の区切り、`.` と `..`、制御文字を含むキーは受け付けない
 * （認可の判定を接頭辞で行うため、パスの正規化で別の場所を指せないようにする）
 */
export const isSafeKey = (key: string): boolean =>
  key.length > 0 &&
  key.length <= 1024 &&
  // eslint-disable-next-line no-control-regex
  !/[\u0000-\u001f\u007f\\]/.test(key) &&
  key.split("/").every((s) => s !== "" && s !== "." && s !== "..");

/** 接頭辞の下に、新しいキーを作る（末尾の `/` は無視する） */
export const newKeyUnder = (prefix: string, id: string = randomUUID()): string =>
  `${prefix.replace(/\/+$/, "")}/${id}`;
