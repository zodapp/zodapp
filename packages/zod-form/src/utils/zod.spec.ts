import { describe, expect, it } from "vitest";
import { z } from "zod";

import { extractCheck } from "./zod";

describe("extractCheck", () => {
  it("returns the check", () => {
    const schema = z.number().min(5);
    const check = extractCheck(schema.def.checks, "greater_than");

    expect(check).toEqual({ check: "greater_than", value: 5, inclusive: true });
  });
});
