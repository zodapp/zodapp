// @vitest-environment jsdom
/**
 * registry の型では止めきれない組み合わせ（#9）は、例外で描画ごと落とさず、
 * その欄の場所に「扱えません」と出し、console.error に理由を出す
 */
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { renderForm, setupDomMocks, SUBMIT_LABEL } from "../testing/renderForm";

const UNSUPPORTED = "This form cannot handle this combination of schemas.";

const arrayWith = (element: z.ZodTypeAny, uiType: string) =>
  z.array(element).register(zf.array.registry, { label: "欄", uiType });

describe("扱えない組み合わせ", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    setupDomMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const cases: [string, z.ZodTypeAny, unknown, string][] = [
    [
      "multipleEnum に object の要素",
      arrayWith(z.object({ a: z.string() }), "multipleEnum"),
      [],
      'uiType "multipleEnum"',
    ],
    [
      "multipleString に number の要素",
      arrayWith(z.number(), "multipleString"),
      [1],
      'uiType "multipleString"',
    ],
    [
      "table に string の要素",
      arrayWith(z.string(), "table"),
      ["a"],
      'uiType "table"',
    ],
    [
      "multipleExternalKey に externalKey でない要素",
      arrayWith(z.string(), "multipleExternalKey"),
      ["a"],
      'uiType "multipleExternalKey"',
    ],
  ];

  for (const [name, schema, value, reason] of cases) {
    it(`${name}：落ちずに、欄の場所に出す`, async () => {
      renderForm(z.object({ f: schema }), { f: value });
      expect(await screen.findByText(UNSUPPORTED)).toBeTruthy();
      expect(screen.getByText("欄")).toBeTruthy();
      expect(screen.getByRole("button", { name: SUBMIT_LABEL })).toBeTruthy();
      expect(
        consoleError.mock.calls.some((call: unknown[]) =>
          String(call[0]).includes(reason),
        ),
      ).toBe(true);
    });
  }

  it("rest 付きの tuple：今ある要素は描き、後ろに出す", async () => {
    const { container } = renderForm(
      z.object({ f: z.tuple([z.string()], z.number()) }),
      { f: ["a", 1] },
    );
    expect(await screen.findByText(UNSUPPORTED)).toBeTruthy();
    const inputs = container.querySelectorAll("input");
    expect(inputs).toHaveLength(2);
    expect(
      consoleError.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes("tuple with rest"),
      ),
    ).toBe(true);
  });

  it("rest の無い tuple・合っている組み合わせには出さない", async () => {
    renderForm(
      z.object({
        t: z.tuple([z.string()]),
        e: arrayWith(z.enum(["a", "b"]), "multipleEnum"),
        s: arrayWith(z.string(), "multipleString"),
      }),
      { t: ["a"], e: ["a"], s: ["x"] },
    );
    await screen.findByRole("button", { name: SUBMIT_LABEL });
    expect(screen.queryByText(UNSUPPORTED)).toBeNull();
  });
});
