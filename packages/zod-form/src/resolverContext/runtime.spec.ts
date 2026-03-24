import { describe, expect, it } from "vitest";
import {
  getResolverContextSlice,
  getRequiredResolverContextSlice,
} from "./runtime";

describe("resolverContext runtime helpers", () => {
  it("returns undefined when contextId is omitted", () => {
    const resolverContext = {
      workspace: { workspaceId: "workspace-1" },
    };

    expect(getResolverContextSlice(resolverContext)).toBeUndefined();
  });

  it("returns the namespaced slice when contextId is provided", () => {
    const resolverContext = {
      workspace: { workspaceId: "workspace-1" },
    };

    expect(getResolverContextSlice(resolverContext, "workspace")).toEqual({
      workspaceId: "workspace-1",
    });
  });

  it("throws when required context is missing", () => {
    expect(() => getRequiredResolverContextSlice({}, "workspace")).toThrow(
      'resolverContext["workspace"] is required',
    );
  });
});
