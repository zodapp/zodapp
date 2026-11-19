import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja as jaMessages } from "../messages";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { renderComputedFieldValue } from "./renderComputedValue";

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
