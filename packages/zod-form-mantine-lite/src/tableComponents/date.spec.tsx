import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { component as DateComponent } from "./date";

const render = (schema: z.ZodTypeAny, value: unknown) =>
  renderToStaticMarkup(
    <MantineProvider>
      <DateComponent
        fieldPath="due"
        schema={schema as never}
        defaultValue={value as never}
      />
    </MantineProvider>,
  );

describe("表の日付のセル", () => {
  it("z.iso.date の値を、- ではなく日付で出す", () => {
    const schema = z.iso.date().register(zf.date.registry, { label: "期限" });
    const html = render(schema, "2026-04-10");
    expect(html).toContain("2026-04-10");
    expect(html).not.toContain(">-<");
  });

  it("z.iso.datetime の値を、unit の形で出す", () => {
    const schema = z.iso
      .datetime({ local: true })
      .register(zf.date.registry, { label: "日時", unit: "minute" });
    const html = render(schema, "2026-04-10T09:30:00");
    expect(html).toContain("2026-04-10 09:30");
  });

  it("Date はこれまでどおり日時で出す", () => {
    const schema = z.date().register(zf.date.registry, { label: "日時" });
    const html = render(schema, new Date(2026, 3, 10, 9, 30, 15));
    expect(html).toContain("2026/04/10 09:30:15");
  });

  it("値が無いときは - を出す", () => {
    const schema = z.iso.date().register(zf.date.registry, { label: "期限" });
    expect(render(schema, undefined)).toContain(">-<");
  });
});
