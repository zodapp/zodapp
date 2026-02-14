/**
 * このファイルはサンプルです。zod-firebase-*では、異なるアルゴリズムが使用されています
 */

import {
  preprocess,
  postprocess,
  $remove,
  PreprocessorDef,
  PostprocessorDef,
} from "../index";
import z from "zod";
import { Timestamp } from "firebase/firestore";

type TimeStampLike = {
  toDate: () => Date;
};

/**
 * （サンプル）アプリ内表現を Firestore 書き込み向けの表現へ変換します。
 *
 * date → `Timestamp`、set/map → array/object などの変換を行い、Firestore が扱えない `undefined` は取り除きます。
 */
export const toFirestore = <TSchema extends z.ZodTypeAny>(
  obj: z.infer<TSchema>,
  schema: TSchema,
): unknown => {
  return postprocess(obj, schema, {
    set: (value: Set<unknown>) => {
      return Array.from(value);
    },
    map: (value: Map<string, unknown>) => {
      return Object.fromEntries(value);
    },
    date: (value: Date) => {
      return Timestamp.fromDate(value);
    },
    bigint: (value: bigint) => {
      return value.toString();
    },
    // firestoreではundefinedを扱えないため、適切な変換を行う。
    // Object / map / setの場合、取り除く。array / tupleの場合、nullに変換。
    undefined: (value: undefined) => {
      return value === undefined ? $remove({ array: null, tuple: null }) : value;
    },
  } as PostprocessorDef);
};

/**
 * （サンプル）Firestore の取得値をアプリ内表現へ復元します。
 *
 * `Timestamp` like → `Date`、array/object → set/map などを復元します。
 */
export const fromFirestore = <TSchema extends z.ZodTypeAny>(
  obj: unknown,
  schema: TSchema,
): z.infer<TSchema> => {
  return preprocess(obj, schema, {
    set: (value: unknown[]) => {
      return new Set(value);
    },
    map: (value: Record<string, unknown>) => {
      return new Map(Object.entries(value));
    },
    date: (value: TimeStampLike) => {
      return value.toDate();
    },
    bigint: (value: string) => {
      return BigInt(value);
    },
    // 本来のundefinedなのにnullだったところをundefinedに戻す。
    undefined: (value: undefined) => {
      return value === null ? undefined : value;
    },
  } as PreprocessorDef);
};
