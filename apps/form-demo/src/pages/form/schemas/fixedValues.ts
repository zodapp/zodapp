import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconPin } from "@tabler/icons-react";

export const formId = "fixedValues";
export const title = "固定値（hidden: false）";
export const description =
  "値が 1 つに決まる型（値が 1 つの literal・z.null() など）は、既定では欄を出さず、値だけを入れる。meta に hidden: false と書くと、readOnly と同じ見た目で値を出す（必須の印は付けない）。どちらも、送信する値には固定値が入る。z.null() は中身が無いので、hidden: false でも出さない";
export const icon = IconPin;
export const category = "Standard";

/** show が true なら meta に hidden: false を足す */
const shown = (show: boolean) => (show ? { hidden: false } : {});

/** 左右で同じ形。show で、固定値に hidden: false を付けるかを決める */
const article = (show: boolean) =>
  z
    .object({
      // 値が 1 つの literal（文字列）
      kind: z
        .literal("article")
        .register(zf.literal.registry, { label: "種別", ...shown(show) }),
      // 値が 1 つの literal（数値）
      version: z
        .literal(2)
        .register(zf.literal.registry, { label: "版", ...shown(show) }),
      title: zf.string().register(zf.string.registry, { label: "タイトル" }),
      // z.null()：中身が無いので、hidden: false でも出さない
      deletedAt: z
        .null()
        .register(zf.common.registry, { label: "削除日時", ...shown(show) }),
      // discriminatedUnion の腕の中の discriminator
      contact: z
        .discriminatedUnion("type", [
          z
            .object({
              type: z.literal("email").register(zf.literal.registry, {
                label: "連絡の種類",
                ...shown(show),
              }),
              email: zf
                .string()
                .register(zf.string.registry, { label: "メール" }),
            })
            .register(zf.object.registry, { label: "メール" }),
          z
            .object({
              type: z.literal("phone").register(zf.literal.registry, {
                label: "連絡の種類",
                ...shown(show),
              }),
              phone: zf
                .string()
                .register(zf.string.registry, { label: "電話番号" }),
            })
            .register(zf.object.registry, { label: "電話" }),
        ])
        .register(zf.union.registry, {
          label: "連絡先",
          selectorLabel: "連絡先の選び方",
        }),
    })
    .register(zf.object.registry, {
      label: show
        ? "hidden: false（固定値を出す）"
        : "既定（固定値を出さない）",
      uiType: "box",
    });

export const schema = z
  .object({
    standard: article(false),
    shown: article(true),
  })
  // 上下に並べて見比べる（horizontal は下揃えで、高さの違う枠どうしだと見比べにくい）
  .register(zf.object.registry, {});

const initial = {
  kind: "article",
  version: 2,
  title: "お知らせ",
  deletedAt: null,
  contact: { type: "email", email: "info@example.com" },
} as const;

export const defaultValues: z.input<typeof schema> = {
  standard: initial,
  shown: initial,
};

export type SchemaType = z.infer<typeof schema>;
