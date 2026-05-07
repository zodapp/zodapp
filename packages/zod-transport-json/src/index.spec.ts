import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createJsonTransport } from "./index";

describe("createJsonTransport datetime handling", () => {
  const schema = z.object({
    at: z.date(),
  });

  it("uses offset-aware datetime as the default Date transport schema", () => {
    const transport = createJsonTransport(schema);

    expect(transport.transportSchema.safeParse({ at: "2026-01-01T00:00:00Z" }).success).toBe(
      true,
    );
    expect(
      transport.transportSchema.safeParse({ at: "2026-01-01T00:00:00+09:00" }).success,
    ).toBe(true);
    expect(transport.transportSchema.safeParse({ at: "2026-01-01T00:00:00" }).success).toBe(
      false,
    );
  });

  it("allows local datetime strings when allowLocalDateTime is enabled", () => {
    const transport = createJsonTransport(schema, { allowLocalDateTime: true });

    expect(transport.transportSchema.safeParse({ at: "2026-01-01T00:00:00" }).success).toBe(
      true,
    );
  });

  it("decodes local datetime strings using the provided timezone", () => {
    const transport = createJsonTransport(schema, { allowLocalDateTime: true });

    expect(transport.decode({ at: "2026-01-01T00:00:00" }, { timeZone: "Asia/Tokyo" })).toEqual({
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

    expect(transport.encode({ at: new Date("2025-12-31T15:00:00.000Z") })).toEqual({
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
