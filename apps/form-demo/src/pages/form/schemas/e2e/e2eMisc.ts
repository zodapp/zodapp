import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconTestPipe } from "@tabler/icons-react";

export const formId = "e2e-misc";
export const title = "e2e：そのほかの型の書き方";
export const description =
  "object の形の enum は、キーを選択肢の名前にし、選ぶと値を書く。zf.date に z.coerce.date() を渡せる。外部キーの土台に z.email() を使える（形に合わない値はエラー）。値を複数持つ literal を multipleEnum の要素にできる";
export const icon = IconTestPipe;
export const category = "e2e";

export const schema = z
  .object({
    // object の形の enum：キーを選択肢の名前にする
    size: z
      .enum({ Small: "s", Large: "l" })
      .register(zf.enum.registry, { label: "サイズ（object の形の enum）" }),
    // zf.date に z.coerce.date()
    dueDate: z.coerce
      .date()
      .register(zf.date.registry, { label: "期限（z.coerce.date()）" }),
    // 外部キーの土台に z.email()
    contactEmail: z.email().register(zf.externalKey.registry, {
      label: "連絡先メール（externalKey + z.email()）",
      externalKeyConfig: { type: "mock", topic: "userEmails" },
      allowUnlisted: true,
    }),
    // 値を複数持つ literal を multipleEnum の要素に
    colors: z
      .array(z.literal(["red", "green", "blue"]))
      .register(zf.array.registry, {
        label: "色（literal の複数の値 × multipleEnum）",
        uiType: "multipleEnum",
      }),
  })
  .register(zf.object.registry, {});

export const defaultValues = {
  size: "s",
  dueDate: new Date("2026-04-01T00:00:00Z"),
  contactEmail: "yamada@example.com",
  colors: ["red"],
} as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;
