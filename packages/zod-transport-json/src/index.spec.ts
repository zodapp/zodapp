import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createJsonTransport } from "./index";

describe("createJsonTransport datetime handling", () => {
  const schema = z.object({
    at: z.date(),
  });

  it("uses offset-aware datetime as the default Date transport schema", () => {
    const transport = createJsonTransport(schema);

    expect(
      transport.transportSchema.safeParse({ at: "2026-01-01T00:00:00Z" })
        .success,
    ).toBe(true);
    expect(
      transport.transportSchema.safeParse({ at: "2026-01-01T00:00:00+09:00" })
        .success,
    ).toBe(true);
    expect(
      transport.transportSchema.safeParse({ at: "2026-01-01T00:00:00" })
        .success,
    ).toBe(false);
  });

  it("allows local datetime strings when allowLocalDateTime is enabled", () => {
    const transport = createJsonTransport(schema, { allowLocalDateTime: true });

    expect(
      transport.transportSchema.safeParse({ at: "2026-01-01T00:00:00" })
        .success,
    ).toBe(true);
  });

  it("decodes local datetime strings using the provided timezone", () => {
    const transport = createJsonTransport(schema, { allowLocalDateTime: true });

    expect(
      transport.decode(
        { at: "2026-01-01T00:00:00" },
        { timeZone: "Asia/Tokyo" },
      ),
    ).toEqual({
      at: new Date("2025-12-31T15:00:00.000Z"),
    });
  });

  it("rejects local datetime strings when timezone context is missing", () => {
    const transport = createJsonTransport(schema, { allowLocalDateTime: true });

    expect(() => transport.decode({ at: "2026-01-01T00:00:00" })).toThrow(
      "timeZone is required to decode local datetime strings",
    );
  });

  it("encodes Date values in UTC by default", () => {
    const transport = createJsonTransport(schema);

    expect(
      transport.encode({ at: new Date("2025-12-31T15:00:00.000Z") }),
    ).toEqual({
      at: "2025-12-31T15:00:00.000Z",
    });
  });

  it("encodes Date values using the provided timezone", () => {
    const transport = createJsonTransport(schema);

    expect(
      transport.encode(
        { at: new Date("2025-12-31T15:00:00.000Z") },
        { timeZone: "Asia/Tokyo" },
      ),
    ).toEqual({
      at: "2026-01-01T00:00:00.000+09:00",
    });
  });
});

describe("createJsonTransport intersection", () => {
  it("round-trips Date fields on both sides of an intersection", () => {
    const schema = z
      .object({ createdAt: z.date() })
      .and(z.object({ id: z.string(), updatedAt: z.date() }));
    const transport = createJsonTransport(schema);
    const value = {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      id: "1",
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };

    const encoded = transport.encode(value);
    expect(encoded).toEqual({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "1",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(transport.decode(JSON.parse(JSON.stringify(encoded)))).toEqual(
      value,
    );
  });

  it("round-trips an intersection whose left side is a discriminated union", () => {
    const schema = z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("a"), at: z.date() }),
        z.object({ kind: z.literal("b"), count: z.number() }),
      ])
      .and(z.object({ id: z.string(), createdAt: z.date() }));
    const transport = createJsonTransport(schema);
    const value = {
      kind: "a" as const,
      at: new Date("2026-01-01T00:00:00.000Z"),
      id: "1",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    };

    const encoded = transport.encode(value);
    expect(encoded).toEqual({
      kind: "a",
      at: "2026-01-01T00:00:00.000Z",
      id: "1",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    expect(transport.decode(JSON.parse(JSON.stringify(encoded)))).toEqual(
      value,
    );
  });
});
