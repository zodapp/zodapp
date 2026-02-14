import { describe, it, expect, beforeEach, vi } from "vitest";
import z from "zod";

import { Timestamp } from "firebase/firestore";
import { toFirestore, fromFirestore } from "./firestore";

describe("firestore transformers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("toFirestore", () => {
    it("Timestamp.fromDate / toDateが正しく動作する", () => {
      const sampleDate = new Date("2024-01-01T00:00:00.000Z");
      const fromDateSpy = vi.spyOn(Timestamp, "fromDate");
      const result = Timestamp.fromDate(sampleDate);
      expect(result).toBeInstanceOf(Timestamp);
      expect(result.toDate()).toStrictEqual(sampleDate);
      expect(fromDateSpy).toHaveBeenCalledWith(sampleDate);
    });

    it("Firestore互換の値へpostprocessできる", () => {
      const schema = z.object({
        setField: z.set(z.string()),
        mapField: z.map(z.string(), z.number()),
        dateField: z.date(),
        bigIntField: z.bigint(),
        optionalField: z.string().optional(),
      });

      const sampleDate = new Date("2024-01-01T00:00:00.000Z");
      const sampleMap = new Map<string, number>([
        ["first", 1],
        ["second", 2],
      ]);

      const fromDateSpy = vi.spyOn(Timestamp, "fromDate");

      const result = toFirestore(
        {
          setField: new Set(["alpha", "beta"]),
          mapField: sampleMap,
          dateField: sampleDate,
          bigIntField: BigInt("9007199254740991"),
          optionalField: undefined,
        },
        schema,
      ) as Record<string, unknown>;

      expect(result.setField).toEqual(["alpha", "beta"]);
      expect(result.mapField).toEqual({
        first: 1,
        second: 2,
      });

      expect(fromDateSpy).toHaveBeenCalledWith(sampleDate);
      expect(result.dateField).toStrictEqual(
        fromDateSpy.mock.results[0]?.value,
      );

      expect(result.bigIntField).toBe("9007199254740991");
      expect("optionalField" in result).toBe(false);
    });
  });

  describe("fromFirestore", () => {
    it("Firestoreの値をschemaの形へpreprocessできる", () => {
      const schema = z.object({
        setField: z.set(z.string()),
        mapField: z.map(z.string(), z.number()),
        dateField: z.date(),
        bigIntField: z.bigint(),
      });

      const sampleDate = new Date("2024-01-01T00:00:00.000Z");
      const firestorePayload = {
        setField: ["alpha", "beta"],
        mapField: {
          first: 1,
          second: 2,
        },
        dateField: Timestamp.fromDate(sampleDate),
        bigIntField: "9007199254740991",
      } as const;

      const result = fromFirestore(firestorePayload, schema);

      expect(result.setField).toBeInstanceOf(Set);
      expect(Array.from(result.setField)).toEqual(["alpha", "beta"]);

      expect(result.mapField).toBeInstanceOf(Map);
      expect(result.mapField.get("first")).toBe(1);
      expect(result.mapField.get("second")).toBe(2);
      expect(result.mapField.size).toBe(2);

      expect(result.dateField).toBeInstanceOf(Date);
      expect(result.dateField.getTime()).toBe(sampleDate.getTime());

      expect(result.bigIntField).toBe(BigInt("9007199254740991"));
    });
  });
});
