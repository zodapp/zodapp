import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createJsonTransport } from "./index";

describe("createJsonTransport", () => {
  it("decodes JSON wire values into domain values", () => {
    const schema = z.object({
      createdAt: z.date(),
      amount: z.bigint(),
      tags: z.set(z.string()),
      metadata: z.map(z.string(), z.object({ dueAt: z.date().optional() })),
      nested: z.object({
        history: z.array(z.object({ at: z.date(), value: z.bigint() })),
      }),
    });
    const transport = createJsonTransport(schema);

    const decoded = transport.decode({
      createdAt: "2026-05-06T00:00:00.000Z",
      amount: "9007199254740993",
      tags: ["support", "orpc"],
      metadata: {
        primary: { dueAt: "2026-05-07T00:00:00.000Z" },
      },
      nested: {
        history: [{ at: "2026-05-08T00:00:00.000Z", value: "42" }],
      },
    });

    expect(decoded.createdAt).toBeInstanceOf(Date);
    expect(decoded.amount).toBe(9007199254740993n);
    expect(decoded.tags).toEqual(new Set(["support", "orpc"]));
    expect(decoded.metadata).toBeInstanceOf(Map);
    expect(decoded.metadata.get("primary")?.dueAt).toBeInstanceOf(Date);
    expect(decoded.nested.history[0]?.at).toBeInstanceOf(Date);
    expect(decoded.nested.history[0]?.value).toBe(42n);
  });

  it("encodes domain values into JSON wire values", () => {
    const schema = z.object({
      updatedAt: z.date(),
      amount: z.bigint(),
      tags: z.set(z.string()),
      metadata: z.map(z.string(), z.object({ dueAt: z.date().optional() })),
    });
    const transport = createJsonTransport(schema);

    const encoded = transport.encode({
      updatedAt: new Date("2026-05-06T00:00:00.000Z"),
      amount: 123n,
      tags: new Set(["a", "b"]),
      metadata: new Map([
        ["primary", { dueAt: new Date("2026-05-07T00:00:00.000Z") }],
      ]),
    });

    expect(encoded).toEqual({
      updatedAt: "2026-05-06T00:00:00.000Z",
      amount: "123",
      tags: ["a", "b"],
      metadata: {
        primary: { dueAt: "2026-05-07T00:00:00.000Z" },
      },
    });
  });

  it("uses transport schema validation before decoding", () => {
    const transport = createJsonTransport(z.object({ createdAt: z.date() }));

    expect(() =>
      transport.transportSchema.parse({ createdAt: new Date() }),
    ).toThrow();
    expect(() => transport.decode({ createdAt: "not-a-date" })).toThrow();
  });

  it("does not materialize absent optional fields while decoding", () => {
    const transport = createJsonTransport(
      z.object({
        title: z.string(),
        deletedAt: z.date().optional(),
        nested: z.object({ dueAt: z.date().optional() }).optional(),
      }),
    );

    expect(transport.decode({ title: "sample", nested: {} })).toEqual({
      title: "sample",
      nested: {},
    });
  });

  it("rejects Map schemas with non-string-compatible keys", () => {
    expect(() => createJsonTransport(z.map(z.number(), z.string()))).toThrow(
      /string-compatible Map keys/,
    );
  });
});
