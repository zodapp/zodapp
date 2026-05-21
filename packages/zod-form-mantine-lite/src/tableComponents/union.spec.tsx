import React from "react";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { component as UnionComponent } from "./union";

type DynamicElementProps = {
  schema: z.ZodTypeAny;
  defaultValue?: unknown;
};

function getDynamicProps(node: React.ReactNode): DynamicElementProps {
  expect(React.isValidElement(node)).toBe(true);
  return (node as React.ReactElement<DynamicElementProps>).props;
}

describe("table union component", () => {
  it("delegates string values to the string option", () => {
    const schema = z.union([z.string(), z.number()]);
    const props = getDynamicProps(
      UnionComponent({ fieldPath: "value", schema, defaultValue: "abc" }),
    );

    expect(props.schema).toBe(schema.options[0]);
    expect(props.defaultValue).toBe("abc");
  });

  it("delegates number values to the number option", () => {
    const schema = z.union([z.string(), z.number()]);
    const props = getDynamicProps(
      UnionComponent({ fieldPath: "value", schema, defaultValue: 123 }),
    );

    expect(props.schema).toBe(schema.options[1]);
    expect(props.defaultValue).toBe(123);
  });

  it("skips never arms when choosing the runtime option", () => {
    const schema = z.union([z.never(), z.string()]);
    const props = getDynamicProps(
      UnionComponent({ fieldPath: "value", schema, defaultValue: "abc" }),
    );

    expect(props.schema).toBe(schema.options[1]);
  });

  it("delegates matching values to object arms and lets Switch resolve display support", () => {
    const schema = z.union([
      z.object({ child: z.string() }),
      z.string(),
    ]);
    const props = getDynamicProps(UnionComponent({
      fieldPath: "value",
      schema,
      defaultValue: { child: "abc" },
    }));

    expect(props.schema).toBe(schema.options[0]);
    expect(props.defaultValue).toEqual({ child: "abc" });
  });

  it("renders an empty value when no option matches", () => {
    const schema = z.union([z.string(), z.number()]);
    const node = UnionComponent({
      fieldPath: "value",
      schema,
      defaultValue: null,
    });

    expect(React.isValidElement(node)).toBe(true);
    expect(
      "schema" in ((node as React.ReactElement<Record<string, unknown>>).props),
    ).toBe(false);
  });
});
