/**
 * form を使わない部品は、表示する値を value で受け取る。同じ path の包みは value に手を付けない
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { MantineProvider } from "@mantine/core";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import {
  Switch,
  ZodFormContextProvider,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { baseComponents } from "../baseComponents";
import * as objectModule from "./object";

/** string の欄に届いた props を記録する部品 */
const seen: ZodFormProps[] = [];
const Probe = (props: ZodFormProps) => {
  seen.push(props);
  return null;
};

const library = {
  ...baseComponents,
  object: () => objectModule,
  string: () => ({ component: Probe }),
};

const renderValue = (schema: z.ZodTypeAny, value: unknown, fieldPath = "x") =>
  renderToStaticMarkup(
    <MantineProvider>
      <ZodFormContextProvider componentLibrary={library as never}>
        <Switch fieldPath={fieldPath} schema={schema} value={value} />
      </ZodFormContextProvider>
    </MantineProvider>,
  );

describe("form を使わない部品の value", () => {
  afterEach(() => {
    seen.length = 0;
  });

  it.each([
    ["optional", zf.string().optional()],
    ["nullable", zf.string().nullable()],
    ["default", zf.string().default("d")],
    ["optional の外に nullable", zf.string().optional().nullable()],
  ])("%s の包みを通っても、value がそのまま届く", (_, schema) => {
    renderValue(schema, "v");
    expect(seen.at(-1)?.value).toBe("v");
    seen.length = 0;
    // 包みは埋めない（既定値は ReactiveAutoForm が、値が来たときに補う）
    renderValue(schema, undefined);
    expect(seen.at(-1)?.value).toBeUndefined();
  });

  it("preprocess の欄では、value をそろえてから渡す（form が無くても描ける）", () => {
    const schema = z.preprocess(
      (v) => (typeof v === "number" ? String(v) : v),
      zf.string(),
    );
    renderValue(schema, 12);
    expect(seen.at(-1)?.value).toBe("12");
  });

  it("object は子に value の一部を渡す", () => {
    const schema = z.object({ a: zf.string() });
    renderValue(schema, { a: "va" }, "");
    expect(seen.at(-1)?.fieldPath).toBe("a");
    expect(seen.at(-1)?.value).toBe("va");
  });
});
