import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { defineMessages, type MessagesOf } from "@zodapp/i18n-messages";
import {
  I18nMessagesProvider,
  createUseMsg,
  useLocale,
  useMsg,
} from "./index";

const pkgEn = defineMessages({
  "reactTest.title": "Title",
  "reactTest.count": ({ count }: { count: number }) => `${count} items`,
});

declare module "@zodapp/i18n-messages" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- module augmentation のため
  interface RegisteredMessages extends MessagesOf<typeof pkgEn> {}
}

const pkgJa = {
  "reactTest.title": "タイトル",
  "reactTest.count": ({ count }) => `${count} 件`,
} satisfies MessagesOf<typeof pkgEn>;

const usePkgMsg = createUseMsg(pkgEn);

const Show = () => {
  const msg = usePkgMsg();
  const locale = useLocale();
  return (
    <span>
      {locale}|{msg("reactTest.title")}|{msg("reactTest.count", { count: 2 })}
    </span>
  );
};

const render = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);

describe("I18nMessagesProvider", () => {
  it("Provider が無ければ en と既定の辞書", () => {
    expect(render(<Show />)).toBe("<span>en|Title|2 items</span>");
  });

  it("Provider の辞書と locale が使われる", () => {
    expect(
      render(
        <I18nMessagesProvider locale="ja" messages={pkgJa}>
          <Show />
        </I18nMessagesProvider>,
      ),
    ).toBe("<span>ja|タイトル|2 件</span>");
  });

  it("入れ子では内側が優先され、外側の辞書も残る", () => {
    expect(
      render(
        <I18nMessagesProvider locale="ja" messages={pkgJa}>
          <I18nMessagesProvider messages={{ "reactTest.title": "見出し" }}>
            <Show />
          </I18nMessagesProvider>
        </I18nMessagesProvider>,
      ),
    ).toBe("<span>ja|見出し|2 件</span>");
  });

  it("既定の辞書なしの useMsg は、辞書に無ければキーを返す", () => {
    const Plain = () => <span>{useMsg()("reactTest.title")}</span>;
    expect(render(<Plain />)).toBe("<span>reactTest.title</span>");
  });
});
