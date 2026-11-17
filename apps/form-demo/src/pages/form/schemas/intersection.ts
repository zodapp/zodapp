import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconArrowsJoin } from "@tabler/icons-react";

export const formId = "intersection";
export const title = "zf.intersection";
export const description =
  'intersection（a.and(b)）は、両側を同じ path に並べる。子の object・union に uiType: "flat" を付けると、枠を付けずに 1 つの object と同じ見た目で並ぶ。同じ path のエラー（子の object・union の腕の、path を指定しない .refine() を含む）は intersection が 1 回だけ出す。腕の中に出したいときは .refine() の path で欄を指す';
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

// 選んでいない腕のキーが残ると unrecognized_keys になる discriminatedUnion（腕は strictObject）
const contactMethod = (uiType: "flat" | undefined = "flat") =>
  z
    .discriminatedUnion("type", [
      z
        .strictObject({
          type: zf
            .literal("phone")
            .register(zf.literal.registry, { hidden: true }),
          phone: text("電話番号"),
        })
        .register(zf.object.registry, { label: "電話", uiType: "flat" }),
      z
        .strictObject({
          type: zf
            .literal("mail")
            .register(zf.literal.registry, { hidden: true }),
          mail: text("メール"),
        })
        .register(zf.object.registry, { label: "メール", uiType: "flat" }),
    ])
    .register(zf.union.registry, {
      label: "連絡方法",
      selectorLabel: "連絡方法",
      uiType,
    });
const memberType = () =>
  z
    .discriminatedUnion("plan", [
      z
        .strictObject({
          plan: zf
            .literal("free")
            .register(zf.literal.registry, { hidden: true }),
        })
        .register(zf.object.registry, { label: "無料", uiType: "flat" }),
      z
        .strictObject({
          plan: zf
            .literal("paid")
            .register(zf.literal.registry, { hidden: true }),
          card: text("カード番号"),
        })
        .register(zf.object.registry, { label: "有料", uiType: "flat" }),
    ])
    .register(zf.union.registry, {
      label: "会員タイプ",
      selectorLabel: "会員タイプ",
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
    // 子の object（box）の .refine()：エラーは intersection に 1 回だけ出て、子の枠には出ない
    childRefine: zf
      .intersection(
        zf
          .object({ password: text("パスワード"), confirm: text("確認") })
          .refine((value) => value.password === value.confirm, {
            message: "パスワードと確認が一致しません（子の refine）",
          })
          .register(zf.object.registry, { label: "パスワード", uiType: "box" }),
        nameBox(),
      )
      .register(zf.intersection.registry, {
        label: "子の object の .refine()",
        uiType: "box",
      }),
    // 横並びの flat の子の .refine()：エラーは横並びの下に出る
    horizontalRefine: zf
      .intersection(
        zf
          .object({ min: text("最小"), max: text("最大") })
          .refine((value) => value.min < value.max, {
            message: "最小は最大より小さくしてください",
          })
          .register(zf.object.registry, { uiType: "flat" }),
        zf
          .object({ unit: text("単位") })
          .register(zf.object.registry, { uiType: "flat" }),
      )
      .register(zf.intersection.registry, {
        label: "横並びの .refine()",
        uiType: "horizontal-wrap",
      }),
    // 子の欄の min(1)：欄のエラーは、ふだんどおり欄の下に出る
    fieldMin: zf
      .intersection(
        zf
          .object({
            code: zf
              .string()
              .min(1, "コードを入力してください")
              .register(zf.string.registry, { label: "コード" }),
          })
          .register(zf.object.registry, { uiType: "flat" }),
        zf
          .object({ memo: text("メモ") })
          .register(zf.object.registry, { uiType: "flat" }),
      )
      .register(zf.intersection.registry, {
        label: "子の欄の min(1)",
        uiType: "box",
      }),
    // z.union の腕の、path を指定しない .refine()：intersection に出る
    unionArmRefine: zf
      .intersection(
        zf
          .object({ name: text("名前") })
          .register(zf.object.registry, { uiType: "flat" }),
        z
          .union([
            zf
              .object({ phone: text("電話番号") })
              .refine((value) => value.phone.length >= 10, {
                message: "電話番号は 10 桁以上（z.union の腕の refine）",
              })
              .register(zf.object.registry, { label: "電話", uiType: "flat" }),
            zf.object({ mail: text("メール") }).register(zf.object.registry, {
              label: "メール",
              uiType: "flat",
            }),
          ])
          .register(zf.union.registry, {
            label: "連絡先",
            selectorLabel: "連絡先",
            uiType: "flat",
          }),
      )
      .register(zf.intersection.registry, {
        label: "z.union の腕の .refine()",
        uiType: "box",
      }),
    // discriminatedUnion の腕の、path を指定しない .refine()：intersection に出る
    discriminatedArmRefine: zf
      .intersection(
        zf
          .object({ name: text("名前") })
          .register(zf.object.registry, { uiType: "flat" }),
        z
          .discriminatedUnion("type", [
            zf
              .object({
                type: zf
                  .literal("phone")
                  .register(zf.literal.registry, { hidden: true }),
                phone: text("電話番号"),
              })
              .refine((value) => value.phone.length >= 10, {
                message:
                  "電話番号は 10 桁以上（discriminatedUnion の腕の refine）",
              })
              .register(zf.object.registry, { label: "電話", uiType: "flat" }),
            zf
              .object({
                type: zf
                  .literal("mail")
                  .register(zf.literal.registry, { hidden: true }),
                mail: text("メール"),
              })
              .register(zf.object.registry, {
                label: "メール",
                uiType: "flat",
              }),
          ])
          .register(zf.union.registry, {
            label: "連絡先",
            selectorLabel: "連絡先の種類",
            uiType: "flat",
          }),
      )
      .register(zf.intersection.registry, {
        label: "discriminatedUnion の腕の .refine()",
        uiType: "box",
      }),
    // 必須の intersection が空：「必ず入力してください。」が 1 回だけ出て、「選択してください」は重ねない
    emptyRequired: zf
      .intersection(
        zf
          .object({ name: text("名前") })
          .register(zf.object.registry, { uiType: "flat" }),
        contactMethod(),
      )
      .register(zf.intersection.registry, {
        label: "必須の intersection（空）",
        uiType: "box",
      }),
    // 選んでいない腕のキーが残っている：キーを持つ union の名前で選択を促す
    leftoverKeys: zf
      .intersection(contactMethod(), memberType())
      .register(zf.intersection.registry, {
        label: "選んでいない腕のキー（intersection）",
        uiType: "box",
      }),
    // discriminatedUnion 単体：腕を選ぶ欄に出す
    leftoverKeysUnion: z
      .object({ contact: contactMethod(undefined) })
      .register(zf.object.registry, {
        label: "選んでいない腕のキー（discriminatedUnion）",
        uiType: "box",
      }),
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
  childRefine: {
    password: "a",
    confirm: "b",
    lastName: "",
    firstName: "",
  },
  horizontalRefine: { min: "5", max: "1", unit: "" },
  fieldMin: { code: "", memo: "" },
  unionArmRefine: { name: "", phone: "090" },
  discriminatedArmRefine: { name: "", type: "phone", phone: "090" },
  // 必須だが空（送信すると「必ず入力してください。」）
  emptyRequired: undefined as unknown as z.input<
    typeof schema
  >["emptyRequired"],
  // 選んでいない腕のキー（phone・card）が残った保存データ
  leftoverKeys: {
    type: "mail",
    mail: "a@example.com",
    plan: "free",
    phone: "090",
    card: "1234",
  } as z.input<typeof schema>["leftoverKeys"],
  leftoverKeysUnion: {
    contact: { type: "mail", mail: "a@example.com", phone: "090" },
  } as z.input<typeof schema>["leftoverKeysUnion"],
};

export type SchemaType = z.infer<typeof schema>;
