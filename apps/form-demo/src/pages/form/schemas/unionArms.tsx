import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconArrowsSplit } from "@tabler/icons-react";

import { AutoForm } from "../../../components/AutoForm";
import {
  createE2eHarness,
  type HarnessWrite,
} from "../../../components/E2eHarness";

export const formId = "unionArms";
export const title = msgKey(
  "formDemo.page.unionArms.title" /* i18n: zf.union（いろいろな腕） */,
);
export const description = msgKey(
  "formDemo.page.unionArms.description" /* i18n: discriminator のない union に、文字列・数値・真偽値・選択肢・literal・オブジェクトの腕を混ぜる。選んだ腕を覚え、値はその腕の型で書く（数値の腕なら number）。どちらの腕にも通る値は、選んだ腕のまま。値が外から変わり、今の腕に通らなくなったら、通る腕に切り替える */,
);
export const icon = IconArrowsSplit;
export const category = "Advanced";

// 文字列・数値・オブジェクトの腕。読み取り専用の欄・配列でも同じ形を使うので、毎回作る
// （registry の meta は schema ごとに持つため）。
// 送信のエラーが選んだ腕の欄に出ることを見せるため、どの腕にも型は合うが条件に合わない値を作れるようにしている
const textNumberObjectArms = () =>
  [
    zf
      .string()
      .min(
        3,
        msgKey(
          "formDemo.unionArms.textNumberObjectArms.arm0.min" /* i18n: 3文字以上で入力してください */,
        ),
      )
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.unionArms.textNumberObjectArms.arm0" /* i18n: 文字列 */,
        ),
      }),
    zf
      .number()
      .multipleOf(
        5,
        msgKey(
          "formDemo.unionArms.textNumberObjectArms.arm1.multipleOf" /* i18n: 5の倍数で入力してください */,
        ),
      )
      .register(zf.number.registry, {
        label: msgKey(
          "formDemo.unionArms.textNumberObjectArms.arm1" /* i18n: 数値 */,
        ),
      }),
    zf
      .object({
        text: zf
          .string()
          .min(
            3,
            msgKey(
              "formDemo.unionArms.textNumberObjectArms.arm2.text.min" /* i18n: 本文は3文字以上で入力してください */,
            ),
          )
          .register(zf.string.registry, {
            label: msgKey(
              "formDemo.unionArms.textNumberObjectArms.arm2.text" /* i18n: 本文 */,
            ),
          }),
      })
      .register(zf.object.registry, {
        label: msgKey(
          "formDemo.unionArms.textNumberObjectArms.arm2" /* i18n: オブジェクト */,
        ),
      }),
  ] as const;

const sizeLiterals = [
  zf.literal("S").register(zf.literal.registry, { label: "S" }),
  zf.literal("M").register(zf.literal.registry, { label: "M" }),
  zf.literal("L").register(zf.literal.registry, { label: "L" }),
] as const;

// 真偽値・literal・文字列の腕
const answerArms = () =>
  [
    zf.boolean().register(zf.boolean.registry, {
      label: msgKey(
        "formDemo.unionArms.answerArms.arm0" /* i18n: はい・いいえ */,
      ),
    }),
    zf.literal("unknown").register(zf.literal.registry, {
      label: msgKey(
        "formDemo.unionArms.answerArms.unknown" /* i18n: わからない */,
      ),
    }),
    zf
      .string()
      .min(
        1,
        msgKey(
          "formDemo.unionArms.answerArms.arm2.min" /* i18n: 1文字以上で入力してください */,
        ),
      )
      .register(zf.string.registry, {
        label: msgKey(
          "formDemo.unionArms.answerArms.arm2" /* i18n: その他（自由に書く） */,
        ),
      }),
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
      label: msgKey(
        "formDemo.unionArms.value" /* i18n: 値（文字列・数値・オブジェクト） */,
      ),
      selectorLabel: msgKey(
        "formDemo.unionArms.value.selectorLabel" /* i18n: 値の種類 */,
      ),
    }),
    // 2. 数字だけの文字列。文字列の腕で開き、打ち込んでも文字列のまま
    code: zf
      .union(
        textOrNumberArms(
          msgKey("formDemo.unionArms.arms.asText" /* i18n: 文字列として書く */),
          msgKey("formDemo.unionArms.arms.asNumber" /* i18n: 数値として書く */),
        ),
      )
      .register(zf.union.registry, {
        label: msgKey(
          "formDemo.unionArms.code" /* i18n: 番号（文字列か数値） */,
        ),
        selectorLabel: msgKey(
          "formDemo.unionArms.code.selectorLabel" /* i18n: 番号の書き方 */,
        ),
      }),
    // 3. どちらの腕にも通る値。"M" は先の腕（選ぶ）で開く。「自由に書く」を選べば、M と書いてもそのまま
    size: zf
      .union([
        zf.enum(sizeLiterals).register(zf.enum.registry, {
          label: msgKey("formDemo.unionArms.size.arm0" /* i18n: 選ぶ */),
        }),
        zf.string().register(zf.string.registry, {
          label: msgKey("formDemo.unionArms.size.arm1" /* i18n: 自由に書く */),
        }),
      ])
      .register(zf.union.registry, {
        label: msgKey(
          "formDemo.unionArms.size" /* i18n: サイズ（選ぶか、自由に書く） */,
        ),
        selectorLabel: msgKey(
          "formDemo.unionArms.size.selectorLabel" /* i18n: サイズの決め方 */,
        ),
      }),
    // 4. 真偽値・literal の腕
    answer: zf.union(answerArms()).register(zf.union.registry, {
      label: msgKey(
        "formDemo.unionArms.answer" /* i18n: 回答（真偽値・literal・文字列） */,
      ),
      selectorLabel: msgKey(
        "formDemo.unionArms.answer.selectorLabel" /* i18n: 回答のしかた */,
      ),
    }),
    // 5. optional・nullable・必須の union
    memo: zf
      .union(
        textOrNumberArms(
          msgKey("formDemo.unionArms.arms.text" /* i18n: 文字 */),
          msgKey("formDemo.unionArms.arms.number" /* i18n: 数 */),
        ),
      )
      .register(zf.union.registry, {
        label: msgKey(
          "formDemo.unionArms.memo" /* i18n: メモ（optional。空のままでよい） */,
        ),
        selectorLabel: msgKey(
          "formDemo.unionArms.memo.selectorLabel" /* i18n: メモの種類 */,
        ),
      })
      .optional(),
    note: zf
      .union(
        textOrNumberArms(
          msgKey("formDemo.unionArms.arms.text" /* i18n: 文字 */),
          msgKey("formDemo.unionArms.arms.number" /* i18n: 数 */),
        ),
      )
      .register(zf.union.registry, {
        label: msgKey(
          "formDemo.unionArms.note" /* i18n: 備考（nullable。空のままでよい） */,
        ),
        selectorLabel: msgKey(
          "formDemo.unionArms.note.selectorLabel" /* i18n: 備考の種類 */,
        ),
      })
      .nullable(),
    required: zf
      .union(
        textOrNumberArms(
          msgKey("formDemo.unionArms.arms.text" /* i18n: 文字 */),
          msgKey("formDemo.unionArms.arms.number" /* i18n: 数 */),
        ),
      )
      .register(zf.union.registry, {
        label: msgKey(
          "formDemo.unionArms.required" /* i18n: 必須の値（空のまま送信するとエラー） */,
        ),
        selectorLabel: msgKey(
          "formDemo.unionArms.required.selectorLabel" /* i18n: 必須の値の種類 */,
        ),
      }),
    // 6. 配列の中の union。要素ごとに腕を選ぶ
    items: zf
      .array(
        zf.union(textNumberObjectArms()).register(zf.union.registry, {
          selectorLabel: msgKey(
            "formDemo.unionArms.items.item.selectorLabel" /* i18n: 項目の種類 */,
          ),
        }),
      )
      .register(zf.array.registry, {
        label: msgKey(
          "formDemo.unionArms.items" /* i18n: 項目（配列の中の union） */,
        ),
      }),
    // 7. 読み取り専用。腕の名前と値を出す
    readOnlyView: zf
      .object({
        text: zf.union(textNumberObjectArms()).register(zf.union.registry, {
          label: msgKey(
            "formDemo.unionArms.readOnlyView.text" /* i18n: 文字列の腕 */,
          ),
          selectorLabel: msgKey(
            "formDemo.unionArms.readOnlyView.text.selectorLabel" /* i18n: 種類（文字列） */,
          ),
        }),
        number: zf.union(textNumberObjectArms()).register(zf.union.registry, {
          label: msgKey(
            "formDemo.unionArms.readOnlyView.number" /* i18n: 数値の腕 */,
          ),
          selectorLabel: msgKey(
            "formDemo.unionArms.readOnlyView.number.selectorLabel" /* i18n: 種類（数値） */,
          ),
        }),
        object: zf.union(textNumberObjectArms()).register(zf.union.registry, {
          label: msgKey(
            "formDemo.unionArms.readOnlyView.object" /* i18n: オブジェクトの腕 */,
          ),
          selectorLabel: msgKey(
            "formDemo.unionArms.readOnlyView.object.selectorLabel" /* i18n: 種類（オブジェクト） */,
          ),
        }),
        boolean: zf.union(answerArms()).register(zf.union.registry, {
          label: msgKey(
            "formDemo.unionArms.readOnlyView.boolean" /* i18n: 真偽値の腕 */,
          ),
          selectorLabel: msgKey(
            "formDemo.unionArms.readOnlyView.boolean.selectorLabel" /* i18n: 種類（真偽値） */,
          ),
        }),
        literal: zf.union(answerArms()).register(zf.union.registry, {
          label: msgKey(
            "formDemo.unionArms.readOnlyView.literal" /* i18n: literal の腕 */,
          ),
          selectorLabel: msgKey(
            "formDemo.unionArms.readOnlyView.literal.selectorLabel" /* i18n: 種類（literal） */,
          ),
        }),
      })
      .register(zf.object.registry, {
        label: msgKey(
          "formDemo.unionArms.readOnlyView" /* i18n: 読み取り専用の欄 */,
        ),
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
              .min(
                1,
                msgKey(
                  "formDemo.unionArms.draft.text.text.min" /* i18n: 本文を入力してください */,
                ),
              )
              .register(zf.string.registry, {
                label: msgKey(
                  "formDemo.unionArms.draft.text.text" /* i18n: 下書きの本文 */,
                ),
              }),
          })
          .register(zf.object.registry, {
            label: msgKey("formDemo.unionArms.draft.text" /* i18n: 文章 */),
          }),
        zf
          .object({
            type: zf
              .literal("amount")
              .register(zf.literal.registry, { hidden: true }),
            amount: zf.number().register(zf.number.registry, {
              label: msgKey(
                "formDemo.unionArms.draft.amount.amount" /* i18n: 下書きの金額 */,
              ),
            }),
          })
          .register(zf.object.registry, {
            label: msgKey("formDemo.unionArms.draft.amount" /* i18n: 金額 */),
          }),
      ])
      .register(zf.union.registry, {
        label: msgKey(
          "formDemo.unionArms.draft" /* i18n: 下書き（途中まで入力して保存した値。type から腕を推定する） */,
        ),
        selectorLabel: msgKey(
          "formDemo.unionArms.draft.selectorLabel" /* i18n: 下書きの種類 */,
        ),
      }),
    // 推定もできない保存値は、腕を空欄で開き、値は書き換えない
    unknownSaved: zf
      .union(
        textOrNumberArms(
          msgKey("formDemo.unionArms.arms.string" /* i18n: 文字列 */),
          msgKey("formDemo.unionArms.arms.numeric" /* i18n: 数値 */),
        ),
      )
      .register(zf.union.registry, {
        label: msgKey(
          "formDemo.unionArms.unknownSaved" /* i18n: どの腕にも当てはまらない保存値（腕は空欄で開く） */,
        ),
        selectorLabel: msgKey(
          "formDemo.unionArms.unknownSaved.selectorLabel" /* i18n: 保存値の種類 */,
        ),
      }),
  })
  .register(zf.object.registry, {});

export const defaultValues = {
  value: "Hello",
  code: "42",
  size: "M",
  answer: true,
  memo: undefined,
  note: null,
  required: undefined,
  items: ["apple", 5, { text: "A note" }],
  readOnlyView: {
    text: "A read-only string",
    number: 15,
    object: { text: "A read-only body" },
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
      {
        label: msgKey(
          "formDemo.unionArms.harness.writeNumber" /* i18n: 外から書き込む（値を数値の 10 にする） */,
        ),
        run: writeValue(10),
      },
      {
        label: msgKey(
          "formDemo.unionArms.harness.writeObject" /* i18n: 外から書き込む（値をオブジェクトにする） */,
        ),
        run: writeValue({ text: "Body written from outside" }),
      },
      {
        label: msgKey(
          "formDemo.unionArms.harness.writeString" /* i18n: 外から書き込む（値を文字列にする） */,
        ),
        run: writeValue("String written from outside"),
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
