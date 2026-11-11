/**
 * Gateway と Client の間のメッセージの形式（§16.1、K5、K9）。すべて JSON。
 * Item・キー・パラメーターの値は、Subscription の transport（§7.4）で変換したもの。
 */
import { z } from "zod";
import type { ErrorCode } from "./protocol-errors";

/** Client → Gateway */
export type RealtimeClientMessage =
  | { type: "subscribe"; id: number; name: string; params: unknown }
  | { type: "page"; id: number; cursor?: string; limit: number }
  | { type: "unsubscribe"; id: number }
  /** 認証の情報を、同じ接続のまま入れ替える。`payload` の形はアプリが決める */
  | { type: "auth"; payload: unknown };

export const realtimeClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    id: z.int().nonnegative(),
    name: z.string(),
    params: z.unknown(),
  }),
  z.object({
    type: z.literal("page"),
    id: z.int().nonnegative(),
    cursor: z.string().optional(),
    limit: z.int().positive(),
  }),
  z.object({ type: z.literal("unsubscribe"), id: z.int().nonnegative() }),
  /**
   * 認証の情報を、同じ接続のまま入れ替える。`payload` の形はアプリが決める
   * （Gateway の `credentialOf` で認証の情報に直す）
   */
  z.object({ type: z.literal("auth"), payload: z.unknown() }),
]);

export type RealtimeBatchMarker = {
  type: "BATCH_STARTED" | "BATCH_FINISHED";
  origin: { kind: "single" | "transaction" | "batch"; id: string };
  count?: number;
  status?: "completed" | "aborted";
};

/** Gateway → Client */
export type RealtimeServerMessage =
  /** 購読の準備ができた（配送基盤が購読を受け付けた） */
  | { type: "ready"; id: number }
  /** 1 ページ。`cursor` がなければ最後のページ */
  | {
      type: "page";
      id: number;
      items: { item: unknown; version: number }[];
      cursor?: string;
    }
  /** 変更（§11.5）。`REMOVED` では `item` を省く */
  | {
      type: "change";
      id: number;
      change: "ADDED" | "MODIFIED" | "REMOVED";
      key: unknown;
      item?: unknown;
      version: number;
      origin: { kind: "single" | "transaction" | "batch"; id: string };
    }
  /** 一括での書き込みの開始・終了（§11.5） */
  | { type: "batch"; id: number; marker: RealtimeBatchMarker }
  /**
   * エラー。`id` があればその購読は終わっている。なければ接続全体のエラー
   * （`UNAUTHENTICATED` のときは、続けて Gateway が接続を閉じる）
   */
  | { type: "error"; id?: number; code: ErrorCode; message: string };

const originSchema = z.object({
  kind: z.enum(["single", "transaction", "batch"]),
  id: z.string(),
});

export const realtimeServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ready"), id: z.int() }),
  z.object({
    type: z.literal("page"),
    id: z.int(),
    items: z.array(z.object({ item: z.unknown(), version: z.number() })),
    cursor: z.string().optional(),
  }),
  z.object({
    type: z.literal("change"),
    id: z.int(),
    change: z.enum(["ADDED", "MODIFIED", "REMOVED"]),
    key: z.unknown(),
    item: z.unknown().optional(),
    version: z.number(),
    origin: originSchema,
  }),
  z.object({
    type: z.literal("batch"),
    id: z.int(),
    marker: z.object({
      type: z.enum(["BATCH_STARTED", "BATCH_FINISHED"]),
      origin: originSchema,
      count: z.number().optional(),
      status: z.enum(["completed", "aborted"]).optional(),
    }),
  }),
  z.object({
    type: z.literal("error"),
    id: z.int().optional(),
    code: z.string(),
    message: z.string(),
  }),
]);
