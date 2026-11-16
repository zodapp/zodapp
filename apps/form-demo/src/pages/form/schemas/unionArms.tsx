import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconArrowsSplit } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";
import {
  createE2eHarness,
  type HarnessWrite,
} from "../../../components/E2eHarness";

export const formId = "unionArms";
export const title = "zf.union（いろいろな腕）";
export const description =
  "discriminator のない union に、文字列・数値・真偽値・選択肢・literal・オブジェクトの腕を混ぜる。選んだ腕を覚え、値はその腕の型で書く（数値の腕なら number）。どちらの腕にも通る値は、選んだ腕のまま。値が外から変わり、今の腕に通らなくなったら、通る腕に切り替える";
export const icon = IconArrowsSplit;
export const category = "Advanced";

// 文字列・数値・オブジェクトの腕。読み取り専用の欄・配列でも同じ形を使うので、毎回作る
// （registry の meta は schema ごとに持つため）。
// 送信のエラーが選んだ腕の欄に出ることを見せるため、どの腕にも型は合うが条件に合わない値を作れるようにしている
const textNumberObjectArms = () =>
  [
    zf
      .string()
      .min(3, "3文字以上で入力してください")
      .register(zf.string.registry, { label: "文字列" }),
    zf
      .number()
      .multipleOf(5, "5の倍数で入力してください")
      .register(zf.number.registry, { label: "数値" }),
    zf
      .object({
        text: zf
          .string()
          .min(3, "本文は3文字以上で入力してください")
          .register(zf.string.registry, { label: "本文" }),
      })
      .register(zf.object.registry, { label: "オブジェクト" }),
  ] as const;

const sizeLiterals = [
  zf.literal("S").register(zf.literal.registry, { label: "S" }),
  zf.literal("M").register(zf.literal.registry, { label: "M" }),
  zf.literal("L").register(zf.literal.registry, { label: "L" }),
] as const;

// 真偽値・literal・文字列の腕
const answerArms = () =>
  [
    zf.boolean().register(zf.boolean.registry, { label: "はい・いいえ" }),
    zf
      .literal("unknown")
      .register(zf.literal.registry, { label: "わからない" }),
    zf
      .string()
      .min(1, "1文字以上で入力してください")
      .register(zf.string.registry, { label: "その他（自由に書く）" }),
  ] as const;

const textOrNumberArms = (textLabel: string, numberLabel: string) =>
  [
    zf.string().register(zf.string.registry, { label: textLabel }),
    zf.number().register(zf.number.registry, { label: numberLabel }),
  ] as const;

export const schema = z
  .object({
    // 1. 文字列・数値・オブジェクト。送信のエラーは選んだ腕の欄に出る
    value: zf.union(textNumberObjectArms()).register(zf.union.registry, {
      label: "値（文字列・数値・オブジェクト）",
      selectorLabel: "値の種類",
    }),
    // 2. 数字だけの文字列。文字列の腕で開き、打ち込んでも文字列のまま
    code: zf
      .union(textOrNumberArms("文字列として書く", "数値として書く"))
      .register(zf.union.registry, {
        label: "番号（文字列か数値）",
        selectorLabel: "番号の書き方",
      }),
    // 3. どちらの腕にも通る値。"M" は先の腕（選ぶ）で開く。「自由に書く」を選べば、M と書いてもそのまま
    size: zf
      .union([
        zf.enum(sizeLiterals).register(zf.enum.registry, { label: "選ぶ" }),
        zf.string().register(zf.string.registry, { label: "自由に書く" }),
      ])
      .register(zf.union.registry, {
        label: "サイズ（選ぶか、自由に書く）",
        selectorLabel: "サイズの決め方",
      }),
    // 4. 真偽値・literal の腕
    answer: zf.union(answerArms()).register(zf.union.registry, {
      label: "回答（真偽値・literal・文字列）",
      selectorLabel: "回答のしかた",
    }),
    // 5. optional・nullable・必須の union
    memo: zf
      .union(textOrNumberArms("文字", "数"))
      .register(zf.union.registry, {
        label: "メモ（optional。空のままでよい）",
        selectorLabel: "メモの種類",
      })
      .optional(),
    note: zf
      .union(textOrNumberArms("文字", "数"))
      .register(zf.union.registry, {
        label: "備考（nullable。空のままでよい）",
        selectorLabel: "備考の種類",
      })
      .nullable(),
    required: zf
      .union(textOrNumberArms("文字", "数"))
      .register(zf.union.registry, {
        label: "必須の値（空のまま送信するとエラー）",
        selectorLabel: "必須の値の種類",
      }),
    // 6. 配列の中の union。要素ごとに腕を選ぶ
    items: zf
      .array(
        zf.union(textNumberObjectArms()).register(zf.union.registry, {
          selectorLabel: "項目の種類",
        }),
      )
      .register(zf.array.registry, { label: "項目（配列の中の union）" }),
    // 7. 読み取り専用。腕の名前と値を出す
    readOnlyView: zf
      .object({
        text: zf.union(textNumberObjectArms()).register(zf.union.registry, {
          label: "文字列の腕",
          selectorLabel: "種類（文字列）",
        }),
        number: zf.union(textNumberObjectArms()).register(zf.union.registry, {
          label: "数値の腕",
          selectorLabel: "種類（数値）",
        }),
        object: zf.union(textNumberObjectArms()).register(zf.union.registry, {
          label: "オブジェクトの腕",
          selectorLabel: "種類（オブジェクト）",
        }),
        boolean: zf.union(answerArms()).register(zf.union.registry, {
          label: "真偽値の腕",
          selectorLabel: "種類（真偽値）",
        }),
        literal: zf.union(answerArms()).register(zf.union.registry, {
          label: "literal の腕",
          selectorLabel: "種類（literal）",
        }),
      })
      .register(zf.object.registry, {
        label: "読み取り専用の欄",
        readOnly: true,
      }),
    // 10. 初期値がどの腕にも通らない。literal の欄（type）で腕を推定する
    draft: zf
      .union([
        zf
          .object({
            type: zf
              .literal("text")
              .register(zf.literal.registry, { hidden: true }),
            text: zf
              .string()
              .min(1, "本文を入力してください")
              .register(zf.string.registry, { label: "下書きの本文" }),
          })
          .register(zf.object.registry, { label: "文章" }),
        zf
          .object({
            type: zf
              .literal("amount")
              .register(zf.literal.registry, { hidden: true }),
            amount: zf
              .number()
              .register(zf.number.registry, { label: "下書きの金額" }),
          })
          .register(zf.object.registry, { label: "金額" }),
      ])
      .register(zf.union.registry, {
        label: "下書き（途中まで入力して保存した値。type から腕を推定する）",
        selectorLabel: "下書きの種類",
      }),
    // 推定もできない保存値は、腕を空欄で開き、値は書き換えない
    unknownSaved: zf
      .union(textOrNumberArms("文字列", "数値"))
      .register(zf.union.registry, {
        label: "どの腕にも当てはまらない保存値（腕は空欄で開く）",
        selectorLabel: "保存値の種類",
      }),
  })
  .register(zf.object.registry, {});

export const defaultValues = {
  value: "こんにちは",
  code: "42",
  size: "M",
  answer: true,
  memo: undefined,
  note: null,
  required: undefined,
  items: ["りんご", 5, { text: "メモです" }],
  readOnlyView: {
    text: "読み取り専用の文字列",
    number: 15,
    object: { text: "読み取り専用の本文" },
    boolean: true,
    literal: "unknown",
  },
  // amount が無いので、どの腕にも通らない。type: "amount" から金額の腕を出す
  draft: { type: "amount" },
  // 文字列にも数値にも通らない
  unknownSaved: true,
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;

const writeValue =
  (next: unknown): HarnessWrite["run"] =>
  (form) =>
    form.setFieldValue("value", next);

// 見るための部品（値・エラー・送信・ログ）。値を外から書き換えるボタンも出す
const harness = [
  createE2eHarness<typeof schema>({
    formId,
    writes: [
      { label: "外から書き込む（値を数値の 10 にする）", run: writeValue(10) },
      {
        label: "外から書き込む（値をオブジェクトにする）",
        run: writeValue({ text: "外から書いた本文" }),
      },
      {
        label: "外から書き込む（値を文字列にする）",
        run: writeValue("外から書いた文字列"),
      },
    ],
  }),
];

export const Component = () => (
  <AutoForm
    schema={schema}
    defaultValues={defaultValues}
    actionComponents={harness}
  />
);
