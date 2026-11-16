import { describe, expect, it } from "vitest";
import { z } from "zod";

import { FormRuntime } from "./schemaRegistry";

describe("FormRuntime.validate", () => {
  it("keeps the per-arm errors of an invalid_union issue", () => {
    const runtime = new FormRuntime();
    const schema = z.object({ value: z.union([z.string(), z.number()]) });

    const issues = runtime.validate(schema, { value: undefined });

    expect(issues).toHaveLength(1);
    const issue = issues[0] as {
      code?: string;
      path: PropertyKey[];
      errors?: { code: string; path: PropertyKey[] }[][];
    };
    expect(issue.code).toBe("invalid_union");
    expect(issue.path).toEqual(["value"]);
    // 腕ごとの issue。path は union からの相対
    expect(issue.errors).toHaveLength(2);
    expect(issue.errors?.[1]?.[0]).toMatchObject({
      code: "invalid_type",
      path: [],
    });
  });

  it("prefixes the path of issues from a registered schema", () => {
    const runtime = new FormRuntime();
    runtime.set("nested", 0, {
      status: "resolved",
      schema: z.object({ name: z.string().min(3, "short") }),
    });

    const issues = runtime.validate(z.object({ nested: z.unknown() }), {
      nested: { name: "ab" },
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "too_small",
        message: "short",
        path: ["nested", "name"],
      }),
    ]);
  });
});
