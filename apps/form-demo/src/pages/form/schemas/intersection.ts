import { msgKey } from "@zodapp/i18n-messages";
import { z } from "zod";
import type { HarnessWrite } from "../../../components/E2eHarness";
import { zf } from "@zodapp/zod-form";
import { IconArrowsJoin } from "@tabler/icons-react";

export const formId = "intersection";
export const title = "zf.intersection";
export const description = msgKey(
  "formDemo.page.intersection.description" /* i18n: intersection（a.and(b)）は、両側を同じ path に並べる。子の object・union に uiType: "flat" を付けると、枠を付けずに 1 つの object と同じ見た目で並ぶ。同じ path のエラー（子の object・union の腕の、path を指定しない .refine() を含む）は intersection が 1 回だけ出す。腕の中に出したいときは .refine() の path で欄を指す */,
);
export const icon = IconArrowsJoin;
export const category = "Basic";

const text = (label: string) =>
  zf.string().register(zf.string.registry, { label });

// 名前と連絡先（使い回す object。それぞれ box の枠を持つ）
const nameBox = () =>
  zf
    .object({
      lastName: text(
        msgKey("formDemo.intersection.nameBox.lastName" /* i18n: 姓 */),
      ),
      firstName: text(
        msgKey("formDemo.intersection.nameBox.firstName" /* i18n: 名 */),
      ),
    })
    .register(zf.object.registry, {
      label: msgKey("formDemo.intersection.nameBox" /* i18n: 名前 */),
      uiType: "box",
    });
const contactBox = () =>
  zf
    .object({
      email: text(
        msgKey("formDemo.intersection.contactBox.email" /* i18n: メール */),
      ),
      phone: text(
        msgKey("formDemo.intersection.contactBox.phone" /* i18n: 電話 */),
      ),
    })
    .register(zf.object.registry, {
      label: msgKey("formDemo.intersection.contactBox" /* i18n: 連絡先 */),
      uiType: "box",
    });

// 枠を付けない（flat）object
const nameFlat = () =>
  zf
    .object({
      lastName: text(
        msgKey("formDemo.intersection.nameFlat.lastName" /* i18n: 姓 */),
      ),
      firstName: text(
        msgKey("formDemo.intersection.nameFlat.firstName" /* i18n: 名 */),
      ),
    })
    .register(zf.object.registry, { uiType: "flat" });
const contactFlat = () =>
  zf
    .object({
      email: text(
        msgKey("formDemo.intersection.contactFlat.email" /* i18n: メール */),
      ),
      phone: text(
        msgKey("formDemo.intersection.contactFlat.phone" /* i18n: 電話 */),
      ),
    })
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
          address: text(
            msgKey(
              "formDemo.intersection.delivery.post.address" /* i18n: 住所 */,
            ),
          ),
        })
        .register(zf.object.registry, {
          label: msgKey("formDemo.intersection.delivery.post" /* i18n: 郵送 */),
          uiType: "flat",
        }),
      zf
        .object({
          method: zf
            .literal("mail")
            .register(zf.literal.registry, { hidden: true }),
          mailTo: text(
            msgKey(
              "formDemo.intersection.delivery.mail.mailTo" /* i18n: 送り先のメール */,
            ),
          ),
        })
        .register(zf.object.registry, {
          label: msgKey(
            "formDemo.intersection.delivery.mail" /* i18n: メール */,
          ),
          uiType: "flat",
        }),
    ])
    .register(zf.union.registry, {
      label: msgKey("formDemo.intersection.delivery" /* i18n: 届け方 */),
      selectorLabel: msgKey(
        "formDemo.intersection.delivery.selectorLabel" /* i18n: 届け方 */,
      ),
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
          phone: text(
            msgKey(
              "formDemo.intersection.contactMethod.phone.phone" /* i18n: 電話番号 */,
            ),
          ),
        })
        .register(zf.object.registry, {
          label: msgKey(
            "formDemo.intersection.contactMethod.phone" /* i18n: 電話 */,
          ),
          uiType: "flat",
        }),
      z
        .strictObject({
          type: zf
            .literal("mail")
            .register(zf.literal.registry, { hidden: true }),
          mail: text(
            msgKey(
              "formDemo.intersection.contactMethod.mail.mail" /* i18n: メール */,
            ),
          ),
        })
        .register(zf.object.registry, {
          label: msgKey(
            "formDemo.intersection.contactMethod.mail" /* i18n: メール */,
          ),
          uiType: "flat",
        }),
    ])
    .register(zf.union.registry, {
      label: msgKey("formDemo.intersection.contactMethod" /* i18n: 連絡方法 */),
      selectorLabel: msgKey(
        "formDemo.intersection.contactMethod.selectorLabel" /* i18n: 連絡方法 */,
      ),
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
        .register(zf.object.registry, {
          label: msgKey(
            "formDemo.intersection.memberType.free" /* i18n: 無料 */,
          ),
          uiType: "flat",
        }),
      z
        .strictObject({
          plan: zf
            .literal("paid")
            .register(zf.literal.registry, { hidden: true }),
          card: text(
            msgKey(
              "formDemo.intersection.memberType.paid.card" /* i18n: カード番号 */,
            ),
          ),
        })
        .register(zf.object.registry, {
          label: msgKey(
            "formDemo.intersection.memberType.paid" /* i18n: 有料 */,
          ),
          uiType: "flat",
        }),
    ])
    .register(zf.union.registry, {
      label: msgKey("formDemo.intersection.memberType" /* i18n: 会員タイプ */),
      selectorLabel: msgKey(
        "formDemo.intersection.memberType.selectorLabel" /* i18n: 会員タイプ */,
      ),
      uiType: "flat",
    });

export const schema = z
  .object({
    // 子はそれぞれの枠（box）のまま並ぶ
    boxed: zf
      .intersection(nameBox(), contactBox())
      .register(zf.intersection.registry, {
        label: msgKey("formDemo.intersection.boxed" /* i18n: 子の枠のまま */),
      }),
    // 子は flat：1 つの object と同じ見た目（縦並び）
    flat: zf
      .intersection(nameFlat(), contactFlat())
      .register(zf.intersection.registry, {
        label: msgKey("formDemo.intersection.flat" /* i18n: flat（縦並び） */),
        uiType: "box",
      }),
    // 子は flat、intersection は横並び：子の欄が同じ行に並ぶ
    horizontal: zf
      .intersection(nameFlat(), contactFlat())
      .register(zf.intersection.registry, {
        label: msgKey(
          "formDemo.intersection.horizontal" /* i18n: flat（横並び） */,
        ),
        uiType: "horizontal-wrap",
      }),
    // object と discriminatedUnion：共通の欄のあとに、届け方を選ぶ欄と、その欄が並ぶ
    order: zf
      .intersection(
        zf
          .object({
            item: text(
              msgKey("formDemo.intersection.order.arm0.item" /* i18n: 品名 */),
            ),
          })
          .register(zf.object.registry, { uiType: "flat" }),
        delivery(),
      )
      .register(zf.intersection.registry, {
        label: msgKey(
          "formDemo.intersection.order" /* i18n: 注文（object と union） */,
        ),
        uiType: "box",
      }),
    // intersection 全体の .refine()：エラーは intersection の枠に 1 回だけ出る
    period: zf
      .intersection(
        zf
          .object({
            from: text(
              msgKey("formDemo.intersection.period.arm0.from" /* i18n: 開始 */),
            ),
          })
          .register(zf.object.registry, { uiType: "flat" }),
        zf
          .object({
            to: text(
              msgKey("formDemo.intersection.period.arm1.to" /* i18n: 終了 */),
            ),
          })
          .register(zf.object.registry, { uiType: "flat" }),
      )
      .refine((value) => value.from !== value.to, {
        message: msgKey(
          "formDemo.intersection.period.refine" /* i18n: 開始と終了は別の値にしてください */,
        ),
      })
      .register(zf.intersection.registry, {
        label: msgKey(
          "formDemo.intersection.period" /* i18n: 期間（.refine()） */,
        ),
        uiType: "box",
      }),
    // intersection の外の flat の object：自分のエラーがあるときだけ、エラーの box を出す
    account: zf
      .object({
        password: text(
          msgKey(
            "formDemo.intersection.account.password" /* i18n: パスワード */,
          ),
        ),
        confirm: text(
          msgKey("formDemo.intersection.account.confirm" /* i18n: 確認 */),
        ),
      })
      .refine((value) => value.password === value.confirm, {
        message: msgKey(
          "formDemo.intersection.account.refine" /* i18n: パスワードと確認が一致しません */,
        ),
      })
      .register(zf.object.registry, { uiType: "flat" }),
    // 子の object（box）の .refine()：エラーは intersection に 1 回だけ出て、子の枠には出ない
    childRefine: zf
      .intersection(
        zf
          .object({
            password: text(
              msgKey(
                "formDemo.intersection.childRefine.arm0.password" /* i18n: パスワード */,
              ),
            ),
            confirm: text(
              msgKey(
                "formDemo.intersection.childRefine.arm0.confirm" /* i18n: 確認 */,
              ),
            ),
          })
          .refine((value) => value.password === value.confirm, {
            message: msgKey(
              "formDemo.intersection.childRefine.arm0.refine" /* i18n: パスワードと確認が一致しません（子の refine） */,
            ),
          })
          .register(zf.object.registry, {
            label: msgKey(
              "formDemo.intersection.childRefine.arm0" /* i18n: パスワード */,
            ),
            uiType: "box",
          }),
        nameBox(),
      )
      .register(zf.intersection.registry, {
        label: msgKey(
          "formDemo.intersection.childRefine" /* i18n: 子の object の .refine() */,
        ),
        uiType: "box",
      }),
    // 横並びの flat の子の .refine()：エラーは横並びの下に出る
    horizontalRefine: zf
      .intersection(
        zf
          .object({
            min: text(
              msgKey(
                "formDemo.intersection.horizontalRefine.arm0.min" /* i18n: 最小 */,
              ),
            ),
            max: text(
              msgKey(
                "formDemo.intersection.horizontalRefine.arm0.max" /* i18n: 最大 */,
              ),
            ),
          })
          .refine((value) => value.min < value.max, {
            message: msgKey(
              "formDemo.intersection.horizontalRefine.arm0.refine" /* i18n: 最小は最大より小さくしてください */,
            ),
          })
          .register(zf.object.registry, { uiType: "flat" }),
        zf
          .object({
            unit: text(
              msgKey(
                "formDemo.intersection.horizontalRefine.arm1.unit" /* i18n: 単位 */,
              ),
            ),
          })
          .register(zf.object.registry, { uiType: "flat" }),
      )
      .register(zf.intersection.registry, {
        label: msgKey(
          "formDemo.intersection.horizontalRefine" /* i18n: 横並びの .refine() */,
        ),
        uiType: "horizontal-wrap",
      }),
    // 子の欄の min(1)：欄のエラーは、ふだんどおり欄の下に出る
    fieldMin: zf
      .intersection(
        zf
          .object({
            code: zf
              .string()
              .min(
                1,
                msgKey(
                  "formDemo.intersection.fieldMin.arm0.code.min" /* i18n: コードを入力してください */,
                ),
              )
              .register(zf.string.registry, {
                label: msgKey(
                  "formDemo.intersection.fieldMin.arm0.code" /* i18n: コード */,
                ),
              }),
          })
          .register(zf.object.registry, { uiType: "flat" }),
        zf
          .object({
            memo: text(
              msgKey(
                "formDemo.intersection.fieldMin.arm1.memo" /* i18n: メモ */,
              ),
            ),
          })
          .register(zf.object.registry, { uiType: "flat" }),
      )
      .register(zf.intersection.registry, {
        label: msgKey(
          "formDemo.intersection.fieldMin" /* i18n: 子の欄の min(1) */,
        ),
        uiType: "box",
      }),
    // z.union の腕の、path を指定しない .refine()：intersection に出る
    unionArmRefine: zf
      .intersection(
        zf
          .object({
            name: text(
              msgKey(
                "formDemo.intersection.unionArmRefine.arm0.name" /* i18n: 名前 */,
              ),
            ),
          })
          .register(zf.object.registry, { uiType: "flat" }),
        z
          .union([
            zf
              .object({
                phone: text(
                  msgKey(
                    "formDemo.intersection.unionArmRefine.arm1.arm0.phone" /* i18n: 電話番号 */,
                  ),
                ),
              })
              .refine((value) => value.phone.length >= 10, {
                message: msgKey(
                  "formDemo.intersection.unionArmRefine.arm1.arm0.refine" /* i18n: 電話番号は 10 桁以上（z.union の腕の refine） */,
                ),
              })
              .register(zf.object.registry, {
                label: msgKey(
                  "formDemo.intersection.unionArmRefine.arm1.arm0" /* i18n: 電話 */,
                ),
                uiType: "flat",
              }),
            zf
              .object({
                mail: text(
                  msgKey(
                    "formDemo.intersection.unionArmRefine.arm1.arm1.mail" /* i18n: メール */,
                  ),
                ),
              })
              .register(zf.object.registry, {
                label: msgKey(
                  "formDemo.intersection.unionArmRefine.arm1.arm1" /* i18n: メール */,
                ),
                uiType: "flat",
              }),
          ])
          .register(zf.union.registry, {
            label: msgKey(
              "formDemo.intersection.unionArmRefine.arm1" /* i18n: 連絡先 */,
            ),
            selectorLabel: msgKey(
              "formDemo.intersection.unionArmRefine.arm1.selectorLabel" /* i18n: 連絡先 */,
            ),
            uiType: "flat",
          }),
      )
      .register(zf.intersection.registry, {
        label: msgKey(
          "formDemo.intersection.unionArmRefine" /* i18n: z.union の腕の .refine() */,
        ),
        uiType: "box",
      }),
    // discriminatedUnion の腕の、path を指定しない .refine()：intersection に出る
    discriminatedArmRefine: zf
      .intersection(
        zf
          .object({
            name: text(
              msgKey(
                "formDemo.intersection.discriminatedArmRefine.arm0.name" /* i18n: 名前 */,
              ),
            ),
          })
          .register(zf.object.registry, { uiType: "flat" }),
        z
          .discriminatedUnion("type", [
            zf
              .object({
                type: zf
                  .literal("phone")
                  .register(zf.literal.registry, { hidden: true }),
                phone: text(
                  msgKey(
                    "formDemo.intersection.discriminatedArmRefine.phone.phone.phone" /* i18n: 電話番号 */,
                  ),
                ),
              })
              .refine((value) => value.phone.length >= 10, {
                message: msgKey(
                  "formDemo.intersection.discriminatedArmRefine.phone.phone.refine" /* i18n: 電話番号は 10 桁以上（discriminatedUnion の腕の refine） */,
                ),
              })
              .register(zf.object.registry, {
                label: msgKey(
                  "formDemo.intersection.discriminatedArmRefine.phone.phone" /* i18n: 電話 */,
                ),
                uiType: "flat",
              }),
            zf
              .object({
                type: zf
                  .literal("mail")
                  .register(zf.literal.registry, { hidden: true }),
                mail: text(
                  msgKey(
                    "formDemo.intersection.discriminatedArmRefine.phone.mail.mail" /* i18n: メール */,
                  ),
                ),
              })
              .register(zf.object.registry, {
                label: msgKey(
                  "formDemo.intersection.discriminatedArmRefine.phone.mail" /* i18n: メール */,
                ),
                uiType: "flat",
              }),
          ])
          .register(zf.union.registry, {
            label: msgKey(
              "formDemo.intersection.discriminatedArmRefine.phone" /* i18n: 連絡先 */,
            ),
            selectorLabel: msgKey(
              "formDemo.intersection.discriminatedArmRefine.phone.selectorLabel" /* i18n: 連絡先の種類 */,
            ),
            uiType: "flat",
          }),
      )
      .register(zf.intersection.registry, {
        label: msgKey(
          "formDemo.intersection.discriminatedArmRefine" /* i18n: discriminatedUnion の腕の .refine() */,
        ),
        uiType: "box",
      }),
    // 必須の intersection が空：「必ず入力してください。」が 1 回だけ出て、「選択してください」は重ねない。
    // AutoForm は開くときに {} で補うので、空になるのは値を外から消したとき（「外から書き込む」のボタン）
    emptyRequired: zf
      .intersection(
        zf
          .object({
            name: text(
              msgKey(
                "formDemo.intersection.emptyRequired.arm0.name" /* i18n: 名前 */,
              ),
            ),
          })
          .register(zf.object.registry, { uiType: "flat" }),
        contactMethod(),
      )
      .register(zf.intersection.registry, {
        label: msgKey(
          "formDemo.intersection.emptyRequired" /* i18n: 必須の intersection（空） */,
        ),
        uiType: "box",
      }),
    // 選んでいない腕のキーが残っている：キーを持つ union の名前で選択を促す
    leftoverKeys: zf
      .intersection(contactMethod(), memberType())
      .register(zf.intersection.registry, {
        label: msgKey(
          "formDemo.intersection.leftoverKeys" /* i18n: 選んでいない腕のキー（intersection） */,
        ),
        uiType: "box",
      }),
    // discriminatedUnion 単体：腕を選ぶ欄に出す
    leftoverKeysUnion: z
      .object({ contact: contactMethod(undefined) })
      .register(zf.object.registry, {
        label: msgKey(
          "formDemo.intersection.leftoverKeysUnion" /* i18n: 選んでいない腕のキー（discriminatedUnion） */,
        ),
        uiType: "box",
      }),
    // optional な intersection：＋で開き、削除で undefined に戻る
    extra: zf
      .intersection(nameFlat(), contactFlat())
      .register(zf.intersection.registry, {
        label: msgKey(
          "formDemo.intersection.extra" /* i18n: 追加の連絡先（optional） */,
        ),
      })
      .optional(),
  })
  .register(zf.object.registry, {});

export const defaultValues: z.input<typeof schema> = {
  boxed: { lastName: "Brown", firstName: "Emily", email: "", phone: "" },
  flat: { lastName: "", firstName: "", email: "", phone: "" },
  horizontal: { lastName: "", firstName: "", email: "", phone: "" },
  order: { item: "Book", method: "post", address: "" },
  period: { from: "April", to: "April" },
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
  // 値を入れない（AutoForm が開くときに {} で補う。空にするのは「外から書き込む」のボタン）
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

/** 値を外から書き込むボタン（必須の intersection を空にする） */
export const harnessWrites: readonly HarnessWrite[] = [
  {
    label: msgKey(
      "formDemo.intersection.harness.emptyRequired" /* i18n: 外から書き込む（必須の intersection を空にする） */,
    ),
    run: (form) => form.setFieldValue("emptyRequired", undefined),
  },
];
