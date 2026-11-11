import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { InvalidCursorError, InvalidTokenError } from "./errors";

type CursorBody = {
  /** クエリ名（エンティティ名と組にする） */
  q: string;
  /** キー条件のハッシュ */
  h: string;
  /** 開始キー（物理キー） */
  k: Record<string, AttributeValue>;
};

const stableStringify = (value: unknown): string => {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map(
        (k) =>
          `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

export const hashValue = (value: unknown): string =>
  createHash("sha256").update(stableStringify(value)).digest("base64url");

/**
 * `{ クエリ名, キー条件のハッシュ, 開始キー }` をHMACで署名した不透明なトークンにする（§7.6）。
 */
export const signCursor = (
  secret: string,
  query: string,
  binding: unknown,
  startKey: Record<string, AttributeValue>,
): string => {
  const body: CursorBody = { q: query, h: hashValue(binding), k: startKey };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
};

/** 署名と、クエリ・キー条件の一致を検証してから開始キーを返す */
export const verifyCursor = (
  secret: string,
  query: string,
  binding: unknown,
  cursor: string,
): Record<string, AttributeValue> => {
  const [payload, mac] = cursor.split(".");
  if (!payload || !mac) throw new InvalidCursorError();
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(mac, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new InvalidCursorError();
  }
  let body: CursorBody;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    throw new InvalidCursorError();
  }
  if (body.q !== query || body.h !== hashValue(binding)) {
    throw new InvalidCursorError(
      "cursor belongs to another query or parameters",
    );
  }
  return body.k;
};

type ItemTokenBody = {
  /** エンティティ名 */
  e: string;
  /** 物理キーのハッシュ */
  h: string;
  /** 読んだときの version */
  v: number;
};

/**
 * 編集中の他者の更新を検出するトークン（`ifUnchanged`。§6.4）。
 * `{ エンティティ名, キーのハッシュ, version }` をカーソルと同じくHMACで署名する。
 */
export const signItemToken = (
  secret: string,
  entity: string,
  primary: Record<string, unknown>,
  version: number,
): string => {
  const body: ItemTokenBody = { e: entity, h: hashValue(primary), v: version };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
};

/** 署名と、エンティティ・キーの一致を検証してから version を返す */
export const verifyItemToken = (
  secret: string,
  entity: string,
  primary: Record<string, unknown>,
  token: string,
): number => {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) throw new InvalidTokenError();
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(mac, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new InvalidTokenError();
  }
  let body: ItemTokenBody;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    throw new InvalidTokenError();
  }
  if (body.e !== entity || body.h !== hashValue(primary)) {
    throw new InvalidTokenError("token belongs to another item");
  }
  return body.v;
};
