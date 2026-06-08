import { describe, expect, it } from "vitest";
import z from "zod";

import { preprocess } from ".";

describe("preprocess", () => {
  it("union branch 内の ZodError を branch 不一致として扱い次の branch を試す", () => {
    const objectResponse = z.object({
      type: z.literal("object"),
    });
    const structuredResponse = z.object({
      type: z.literal("structured"),
      fields: z.array(z.object({ kind: z.string() })),
    });

    const schema = z.union([
      z.object({
        agentType: z.literal("ragBot"),
        config: z.object({
          responseSchema: objectResponse.optional(),
        }),
      }),
      z.object({
        agentType: z.literal("flexBot"),
        config: z.object({
          responseSchema: structuredResponse,
        }),
      }),
    ]);
    const payload = {
      agentType: "flexBot",
      config: {
        responseSchema: {
          type: "structured",
          fields: [{ kind: "assistantText" }],
        },
      },
    };

    expect(preprocess(payload, schema)).toEqual(payload);
  });
});
