import { describe, expect, it } from "vitest";
import { zf } from "./index";

describe("externalKey の allowUnlisted と unlisted", () => {
  const config = { type: "mock", topic: "users" } as never;

  it("allowUnlisted だけ、unlisted だけは書ける", () => {
    expect(() => {
      zf.string().register(zf.externalKey.registry, {
        externalKeyConfig: config,
        allowUnlisted: true,
      });
      zf.string().register(zf.externalKey.registry, {
        externalKeyConfig: config,
        unlisted: "keep",
      });
      zf.string().register(zf.externalKey.registry, {
        externalKeyConfig: config,
        allowUnlisted: false,
        unlisted: "clear",
      });
    }).not.toThrow();
  });

  it("allowUnlisted: true と unlisted は、型で同時に書けない", () => {
    expect(() =>
      zf.string().register(zf.externalKey.registry, {
        externalKeyConfig: config,
        allowUnlisted: true,
        // @ts-expect-error allowUnlisted: true のときは unlisted が効かない
        unlisted: "keep",
      }),
    ).not.toThrow();
  });
});
