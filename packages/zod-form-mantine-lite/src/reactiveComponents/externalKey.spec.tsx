import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { zf } from "@zodapp/zod-form";
import type { UseExternalKeyOptionsResult } from "@zodapp/zod-form-react/utils/externalKey";
import { component as ExternalKeyComponent } from "./externalKey";

// 選択肢の取得はここで差し替える（SSR では購読の useEffect が走らないため）
const mocked = vi.hoisted(() => ({
  optionsResult: undefined as unknown,
}));
vi.mock("@zodapp/zod-form-react/utils/externalKey", () => ({
  useExternalKeyOptions: () => mocked.optionsResult,
  useExternalKeyAction: () => undefined,
}));
const setOptionsResult = (result: UseExternalKeyOptionsResult) => {
  mocked.optionsResult = result;
};

const makeSchema = (allowUnlisted = false) =>
  zf.string().register(zf.externalKey.registry, {
    label: "担当者",
    externalKeyConfig: { type: "list", list: "members" },
    ...(allowUnlisted ? { allowUnlisted: true as const } : {}),
  });

const render = (
  value: unknown,
  { readOnly = false, allowUnlisted = false } = {},
) =>
  renderToStaticMarkup(
    <MantineProvider>
      <ExternalKeyComponent
        fieldPath="owner"
        schema={makeSchema(allowUnlisted) as never}
        defaultValue={value as never}
        readOnly={readOnly}
      />
    </MantineProvider>,
  );

/** 見えている入力欄（combobox）の値。hidden の input にはフォームの値がそのまま入る */
const shownValue = (html: string) =>
  /<input[^>]*role="combobox"[^>]*value="([^"]*)"/.exec(html)?.[1];

describe("フォームの externalKey の欄（lite）", () => {
  beforeEach(() => {
    setOptionsResult({
      options: [
        { label: "利用者 A", value: "u1" },
        { label: "利用者 B", value: "u2" },
      ],
      isLoading: false,
    });
  });

  it("読み取り専用で、選択肢にある値はラベルを出す", () => {
    expect(render("u1", { readOnly: true })).toContain("利用者 A");
  });

  it("読み取り専用で、選択肢に無い値は「（不正な値）」と出し、生の値は出さない", () => {
    const html = render("u9-raw", { readOnly: true });
    expect(html).toContain("（不正な値）");
    expect(html).not.toContain("u9-raw");
  });

  it("編集できる欄でも、選択肢に無い値は「（不正な値）」と出す（空欄にしない）", () => {
    expect(shownValue(render("u9-raw"))).toBe("（不正な値）");
  });

  it("allowUnlisted なら、選択肢に無い値もそのまま出す", () => {
    expect(render("u9-raw", { readOnly: true, allowUnlisted: true })).toContain(
      "u9-raw",
    );
    expect(shownValue(render("u9-raw", { allowUnlisted: true }))).toBe(
      "u9-raw",
    );
  });

  it("選択肢の取得に失敗したときは、生の値を出さず、再試行を出す", () => {
    setOptionsResult({
      options: null,
      isLoading: false,
      error: new Error("failed"),
      retry: () => {},
    });
    for (const readOnly of [true, false]) {
      const html = render("u9-raw", { readOnly });
      expect(html).toContain("再試行");
      expect(html).not.toContain("u9-raw");
    }
  });
});
