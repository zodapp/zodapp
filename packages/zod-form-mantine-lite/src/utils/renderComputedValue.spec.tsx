import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja as jaMessages } from "../messages";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { encodeMsgKey } from "@zodapp/i18n-messages";
import {
  renderComputedFieldValue,
  renderComputedValue,
} from "./renderComputedValue";

const testMessages = {
  "test.text": "Translated",
  "test.withParams": ({ name }: { name: string }) => `Hello ${name}`,
  "test.badge": "Active",
  "test.link": "Document",
};

const renderWithMessages = (node: React.ReactNode) =>
  renderToStaticMarkup(
    <MantineProvider>
      <I18nMessagesProvider locale="en" messages={[jaMessages, testMessages]}>
        {node}
      </I18nMessagesProvider>
    </MantineProvider>,
  );

describe("renderComputedFieldValue", () => {
  it("readOnlyテキストと別タブリンクアイコンを表示する", () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <I18nMessagesProvider locale="ja" messages={jaMessages}>
          {renderComputedFieldValue({
            type: "link",
            label: "2",
            href: "/flows/flow-1?versionId=version-1#block-2",
          })}
        </I18nMessagesProvider>
      </MantineProvider>,
    );

    expect(html).toContain('href="/flows/flow-1?versionId=version-1#block-2"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="2を開く"');
    expect(html).not.toContain(">2</a>");
  });
});

describe("computed の文言を辞書で訳す", () => {
  it("string の値が msgKey なら訳す（params 付きも）", () => {
    expect(
      renderWithMessages(renderComputedFieldValue(encodeMsgKey("test.text"))),
    ).toContain("Translated");
    expect(
      renderWithMessages(
        renderComputedValue(encodeMsgKey("test.withParams", { name: "Bob" })),
      ),
    ).toContain("Hello Bob");
    expect(
      renderWithMessages(
        renderComputedValue(encodeMsgKey("test.text"), "table"),
      ),
    ).toContain("Translated");
  });

  it("キーの形でない文字列・辞書に無いキーは、そのまま出す", () => {
    expect(renderWithMessages(renderComputedValue("100 円"))).toContain(
      "100 円",
    );
    expect(
      renderWithMessages(
        renderComputedValue(encodeMsgKey("test.missing", { length: 3 })),
      ),
    ).toContain("test.missing?length=3");
  });

  it("badge・link の label を訳す", () => {
    expect(
      renderWithMessages(
        renderComputedValue({
          type: "badge",
          label: encodeMsgKey("test.badge"),
        }),
      ),
    ).toContain("Active");
    const link = renderWithMessages(
      renderComputedFieldValue({
        type: "link",
        label: encodeMsgKey("test.link"),
        href: "/docs",
      }),
    );
    expect(link).toContain("Document");
    expect(link).not.toContain("test.link");
  });
});
