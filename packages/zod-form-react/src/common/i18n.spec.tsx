import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { msgKey } from "@zodapp/i18n-messages";
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { FormRuntime } from "./schemaRegistry";
import { resolveMeta, useResolvedMeta } from "./i18n";
import { en, ja } from "../messages";

describe("FormRuntime の検証", () => {
  it("zod の既定のエラーを zod.* のキーにする", () => {
    const runtime = new FormRuntime();
    const issues = runtime.validate(z.object({ name: z.string().min(3) }), {
      name: "a",
    });
    expect(issues[0]?.message).toBe(
      "zod.tooSmall.string?minimum=3&inclusive=true" /* i18n: p.inclusive === "true" ? `${p.minimum}文字以上で入力してください。` : `${p.minimum}文字より多く入力してください。` */,
    );
  });

  it("スキーマに書いた文言はそのまま", () => {
    const runtime = new FormRuntime();
    const issues = runtime.validate(
      z.object({ name: z.string().min(3, "生の文言") }),
      {
        name: "a",
      },
    );
    expect(issues[0]?.message).toBe("生の文言");
  });
});

describe("meta の文言", () => {
  const schema = z.string().register(zf.string.registry, {
    label: msgKey("zodFormReact.dynamic.loading" /* i18n: 読み込み中 */),
  });

  it("resolveMeta はキーの label を訳し、ほかはそのまま", () => {
    const msg = {
      resolve: (text: string) => (text === "a.b" ? "訳" : text),
    } as never;
    expect(resolveMeta({ label: "a.b", uiType: "x" }, msg)).toEqual({
      label: "訳",
      uiType: "x",
    });
    const meta = { label: "普通" };
    expect(resolveMeta(meta, msg)).toBe(meta);
  });

  it("useResolvedMeta は Provider の辞書で訳す（無ければ英語）", () => {
    const Show = () => <span>{useResolvedMeta(schema)?.label}</span>;
    expect(renderToStaticMarkup(<Show />)).toBe("<span>Loading</span>");
    expect(
      renderToStaticMarkup(
        <I18nMessagesProvider locale="ja" messages={ja}>
          <Show />
        </I18nMessagesProvider>,
      ),
    ).toBe("<span>読み込み中</span>");
  });

  it("ja と en はキーがそろっている", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });
});
