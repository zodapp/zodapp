import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja as jaMessages } from "../messages";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { component as EnumComponent } from "./enum";

const schema = zf
  .enum([
    zf.literal("a").register(zf.literal.registry, { label: "選択肢 A" }),
    z.literal("b"),
  ])
  .register(zf.enum.registry, { label: "種類" });

const render = (value: unknown, readOnly = false) =>
  renderToStaticMarkup(
    <MantineProvider>
      <I18nMessagesProvider locale="ja" messages={jaMessages}>
        <EnumComponent
          fieldPath="kind"
          schema={schema as never}
          defaultValue={value as never}
          readOnly={readOnly}
        />
      </I18nMessagesProvider>
    </MantineProvider>,
  );

/** 見えている入力欄（combobox）の値。hidden の input にはフォームの値がそのまま入る */
const shownValue = (html: string) =>
  /<input[^>]*role="combobox"[^>]*value="([^"]*)"/.exec(html)?.[1];

describe("フォームの enum の欄（lite）", () => {
  it("読み取り専用で、選択肢にある値はラベルを出す", () => {
    expect(render("a", true)).toContain("選択肢 A");
  });

  it("読み取り専用で、選択肢に無い値は「（不正な値）」と出し、生の値は出さない", () => {
    const html = render("x-raw", true);
    expect(html).toContain("（不正な値）");
    expect(html).not.toContain("x-raw");
  });

  it("編集できる欄でも、選択肢に無い値は「（不正な値）」と出す（空欄にしない）", () => {
    expect(shownValue(render("x-raw"))).toBe("（不正な値）");
  });

  it("編集できる欄で、選択肢にある値はラベルを出す", () => {
    expect(shownValue(render("a"))).toBe("選択肢 A");
  });
});
