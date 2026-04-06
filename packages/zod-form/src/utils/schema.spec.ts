import { getMeta, zf } from "../def";
import { describe, expect, it } from "vitest";
import { cloneSchema, replaceArrayElement, replaceObjectShape } from "./schema";
import { z } from "zod";

type StringMeta = {
  label?: string;
  formatter?: (value: string) => unknown;
};

type ExternalKeyMeta = {
  label?: string;
  externalKeyConfig?: { type: string } | (() => { type: string });
};

type ObjectMeta = {
  label?: string;
  properties?: string[];
};

type ArrayMeta = {
  label?: string;
};

describe("schema helpers", () => {
  it("cloneSchema preserves string metadata", () => {
    const formatter = (value: string) => ({
      type: "badge" as const,
      label: value.toUpperCase(),
    });
    const schema = zf.string().register(zf.string.registry, {
      label: "Name",
      formatter,
    });

    const cloned = cloneSchema(schema);

    expect(cloned).not.toBe(schema);
    const meta = getMeta(cloned, "string") as StringMeta | undefined;
    expect(meta?.label).toBe("Name");
    expect(meta?.formatter).toBe(formatter);
    expect(meta?.formatter?.("ada")).toEqual({
      type: "badge",
      label: "ADA",
    });
  });

  it("cloneSchema preserves externalKey metadata", () => {
    const externalKeyConfig = {
      type: "anyResolver",
    } as const;
    const schema = zf.string().register(zf.externalKey.registry, {
      label: "User",
      externalKeyConfig,
    });

    const cloned = cloneSchema(schema);

    expect(cloned).not.toBe(schema);
    const meta = getMeta(cloned, "externalKey") as ExternalKeyMeta | undefined;
    expect(meta?.label).toBe("User");
    expect(meta?.externalKeyConfig).toBe(externalKeyConfig);
  });

  it("replaceObjectShape preserves object metadata and validation mode", () => {
    const schema = z
      .strictObject({
        name: z.string(),
      })
      .register(zf.object.registry, {
        label: "Profile",
        properties: ["name"],
      });

    const replaced = replaceObjectShape(
      schema,
      {
        secret: z.string(),
      },
      {
        properties: ["secret"],
      },
    );

    const meta = getMeta(replaced, "object") as ObjectMeta | undefined;
    expect(meta?.label).toBe("Profile");
    expect(meta?.properties).toEqual(["secret"]);
    expect(
      replaced.safeParse({
        secret: "hidden",
      }).success,
    ).toBe(true);
    expect(
      replaced.safeParse({
        secret: "hidden",
        extra: true,
      }).success,
    ).toBe(false);
  });

  it("replaceArrayElement preserves array metadata and checks", () => {
    const schema = z.array(z.string()).min(2).max(2).register(zf.array.registry, {
      label: "Members",
    });

    const replaced = replaceArrayElement(
      schema,
      z.number(),
    ) as z.ZodArray<z.ZodTypeAny>;

    const meta = getMeta(replaced, "array") as ArrayMeta | undefined;
    expect(meta?.label).toBe("Members");
    expect(replaced.safeParse([1, 2]).success).toBe(true);
    expect(replaced.safeParse([1]).success).toBe(false);
    expect(replaced.safeParse([1, 2, 3]).success).toBe(false);
  });
});
