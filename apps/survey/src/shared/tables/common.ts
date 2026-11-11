import { z } from "zod";
import { zf } from "@zodapp/zod-form";

/** 作成日・更新日（onCreate / onWrite で付ける。フォームでは読み取り専用） */
export const timestamps = z.object({
  createdAt: zf
    .date()
    .register(zf.date.registry, { label: "作成日", readOnly: true, width: 100 }),
  updatedAt: zf
    .date()
    .register(zf.date.registry, { label: "更新日", readOnly: true, width: 100 }),
});

export const stampCreate = ({ now }: { now: Date }) => ({ createdAt: now });
export const stampWrite = ({ now }: { now: Date }) => ({ updatedAt: now });

/** ブラウザでもサーバーでも使える ID の生成 */
export const newId = () => globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 20);

type PatchShape<S extends z.ZodRawShape> = {
  [K in keyof S]: z.ZodOptional<S[K] extends z.ZodDefault<infer I> ? I : S[K]>;
};

/**
 * 部分更新の params。zod 4 の `.partial()` は `.default()` を残すため、
 * `{ title }` だけを送っても status などが既定値で上書きされてしまう。
 * 既定値を外してから optional にする。
 */
export const patchOf = <S extends z.ZodRawShape>(
  schema: z.ZodObject<S>,
): z.ZodObject<PatchShape<S>> =>
  z.object(
    Object.fromEntries(
      Object.entries(schema.shape).map(([key, field]) => [
        key,
        ((field instanceof z.ZodDefault ? field.unwrap() : field) as z.ZodType).optional(),
      ]),
    ),
  ) as unknown as z.ZodObject<PatchShape<S>>;
