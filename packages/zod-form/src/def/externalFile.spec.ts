import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zf, getMeta } from "./index";

describe("zf.externalFile", () => {
  it("typeName は externalFile で、z.file() の型の名前（file）と重ならない", () => {
    const schema = zf.externalFile().register(zf.externalFile.registry, {
      fileConfig: { type: "anyStorage" },
    });
    expect(getMeta(schema)?.typeName).toBe("externalFile");
    expect(z.file().type).toBe("file");
    expect(getMeta(z.file())).toBeUndefined();
  });

  it("zf.file は残さない", () => {
    expect("file" in zf).toBe(false);
  });
});
