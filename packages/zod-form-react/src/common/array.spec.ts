import { describe, expect, it } from "vitest";

import { getArrayFieldError } from "./array";

describe("getArrayFieldError", () => {
  it("returns an error that belongs to the array field itself", () => {
    const error = {
      code: "too_small",
      path: ["config", "actionTools"],
      message: "at least one tool is required",
    };

    expect(getArrayFieldError([error], "config.actionTools")).toBe(error);
  });

  it("excludes errors that belong to array items", () => {
    const error = {
      code: "too_small",
      path: ["config", "actionTools", 0, "indexId"],
      message: "index is required",
    };

    expect(getArrayFieldError([error], "config.actionTools")).toBeUndefined();
  });

  it("supports bracket notation and nested error arrays", () => {
    const ownError = {
      code: "custom",
      path: ["groups", 0, "actionTools"],
      message: "invalid tools",
    };
    const childError = {
      code: "too_small",
      path: ["groups", 0, "actionTools", 0, "indexId"],
      message: "index is required",
    };

    expect(
      getArrayFieldError([[childError], [ownError]], "groups[0].actionTools"),
    ).toBe(ownError);
  });

  it("keeps field-level string errors without a path", () => {
    expect(getArrayFieldError(["invalid array"], "items")).toEqual({
      message: "invalid array",
    });
  });
});
