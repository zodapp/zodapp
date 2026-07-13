import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { renderComputedFieldValue } from "./renderComputedValue";

describe("renderComputedFieldValue", () => {
  it("readOnlyテキストと別タブリンクアイコンを表示する", () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        {renderComputedFieldValue({
          type: "link",
          label: "2",
          href: "/flows/flow-1?versionId=version-1#block-2",
        })}
      </MantineProvider>,
    );

    expect(html).toContain(
      'href="/flows/flow-1?versionId=version-1#block-2"',
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="2を開く"');
    expect(html).not.toContain(">2</a>");
  });
});
