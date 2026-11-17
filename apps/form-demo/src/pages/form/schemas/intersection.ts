import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconArrowsJoin } from "@tabler/icons-react";

export const formId = "intersection";
export const title = "zf.intersection";
export const description =
  'intersection（a.and(b)）は、両側を同じ path に並べる。子の object・union に uiType: "flat" を付けると、枠を付けずに 1 つの object と同じ見た目で並ぶ。同じ path のエラーは intersection が 1 回だけ出す';
export const icon = IconArrowsJoin;
export const category = "Basic";

const text = (label: string) =>
  zf.string().register(zf.string.registry, { label });

// 名前と連絡先（使い回す object。それぞれ box の枠を持つ）
const nameBox = () =>
  zf
    .object({ lastName: text("姓"), firstName: text("名") })
    .register(zf.object.registry, { label: "名前", uiType: "box" });
const contactBox = () =>
  zf
    .object({ email: text("メール"), phone: text("電話") })
    .register(zf.object.registry, { label: "連絡先", uiType: "box" });

// 枠を付けない（flat）object
const nameFlat = () =>
  zf
    .object({ lastName: text("姓"), firstName: text("名") })
    .register(zf.object.registry, { uiType: "flat" });
const contactFlat = () =>
  zf
    .object({ email: text("メール"), phone: text("電話") })
    .register(zf.object.registry, { uiType: "flat" });

// 共通の欄と、種類ごとの欄（discriminatedUnion。腕も union も flat）
const delivery = () =>
  z
    .discriminatedUnion("method", [
      zf
        .object({
          method: zf
            .literal("post")
            .register(zf.literal.registry, { hidden: true }),
          address: text("住所"),
        })
        .register(zf.object.registry, { label: "郵送", uiType: "flat" }),
      zf
        .object({
          method: zf
            .literal("mail")
            .register(zf.literal.registry, { hidden: true }),
          mailTo: text("送り先のメール"),
        })
        .register(zf.object.registry, { label: "メール", uiType: "flat" }),
    ])
    .register(zf.union.registry, {
      label: "届け方",
      selectorLabel: "届け方",
      uiType: "flat",
    });

export const schema = z
  .object({
    // 子はそれぞれの枠（box）のまま並ぶ
    boxed: zf
      .intersection(nameBox(), contactBox())
      .register(zf.intersection.registry, { label: "子の枠のまま" }),
    // 子は flat：1 つの object と同じ見た目（縦並び）
    flat: zf
      .intersection(nameFlat(), contactFlat())
      .register(zf.intersection.registry, {
        label: "flat（縦並び）",
        uiType: "box",
      }),
    // 子は flat、intersection は横並び：子の欄が同じ行に並ぶ
    horizontal: zf
      .intersection(nameFlat(), contactFlat())
      .register(zf.intersection.registry, {
        label: "flat（横並び）",
        uiType: "horizontal-wrap",
      }),
    // object と discriminatedUnion：共通の欄のあとに、届け方を選ぶ欄と、その欄が並ぶ
    order: zf
      .intersection(
        zf
          .object({ item: text("品名") })
          .register(zf.object.registry, { uiType: "flat" }),
        delivery(),
      )
      .register(zf.intersection.registry, {
        label: "注文（object と union）",
        uiType: "box",
      }),
    // intersection 全体の .refine()：エラーは intersection の枠に 1 回だけ出る
    period: zf
      .intersection(
        zf
          .object({ from: text("開始") })
          .register(zf.object.registry, { uiType: "flat" }),
        zf
          .object({ to: text("終了") })
          .register(zf.object.registry, { uiType: "flat" }),
      )
      .refine((value) => value.from !== value.to, {
        message: "開始と終了は別の値にしてください",
      })
      .register(zf.intersection.registry, {
        label: "期間（.refine()）",
        uiType: "box",
      }),
    // intersection の外の flat の object：自分のエラーがあるときだけ、エラーの box を出す
    account: zf
      .object({ password: text("パスワード"), confirm: text("確認") })
      .refine((value) => value.password === value.confirm, {
        message: "パスワードと確認が一致しません",
      })
      .register(zf.object.registry, { uiType: "flat" }),
    // optional な intersection：＋で開き、削除で undefined に戻る
    extra: zf
      .intersection(nameFlat(), contactFlat())
      .register(zf.intersection.registry, { label: "追加の連絡先（optional）" })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  boxed: { lastName: "山本", firstName: "花子", email: "", phone: "" },
  flat: { lastName: "", firstName: "", email: "", phone: "" },
  horizontal: { lastName: "", firstName: "", email: "", phone: "" },
  order: { item: "本", method: "post", address: "" },
  period: { from: "4月", to: "4月" },
  account: { password: "a", confirm: "b" },
};

export type SchemaType = z.infer<typeof schema>;
