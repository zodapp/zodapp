// @vitest-environment jsdom
import React, { Suspense } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { zfReact } from "@zodapp/zod-form-react";
import {
  Switch,
  TableRowProvider,
  ZodFormContextProvider,
} from "@zodapp/zod-form-react/common";
import { tableComponentLibrary as componentLibrary } from "@zodapp/zod-form-mantine-lite";

const renderCell = (
  schema: z.ZodTypeAny,
  fieldPath: string,
  row: Record<string, unknown>,
) =>
  render(
    <MantineProvider>
      <ZodFormContextProvider componentLibrary={componentLibrary}>
        <TableRowProvider row={row}>
          <Suspense fallback={null}>
            <Switch
              fieldPath={fieldPath}
              schema={schema}
              value={row[fieldPath]}
            />
          </Suspense>
        </TableRowProvider>
      </ZodFormContextProvider>
    </MantineProvider>,
  );

describe("表の dynamic と computed", () => {
  beforeEach(() => {
    if (!window.matchMedia) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }
  });
  afterEach(() => cleanup());

  it("dynamic はセルの値と行の親で resolve し、結果の schema を表用の部品で描画する", async () => {
    const office = z.string().register(
      zf.dynamic.registry,
      defineDynamicMeta<unknown, { kind?: string }>({
        dependsOnParent: true,
        resolve: ({ parent }) => ({
          key: parent?.kind ?? "",
          schema: zf.string().register(zf.string.registry, {
            uiType: "select",
            suggestions: [{ label: `${parent?.kind}:本社`, value: "hq" }],
          }),
        }),
      }),
    );
    renderCell(office, "office", { kind: "社内", office: "hq" });
    expect(await screen.findByText("社内:本社")).toBeTruthy();
  });

  it("computed は dependsOnParent: true なら行の値を parent として受け取る", async () => {
    const fullName = zfReact.computed().register(zfReact.computed.registry, {
      dependsOnParent: true,
      compute: ({ parent }) => `${parent.last} ${parent.first}`,
    });
    renderCell(fullName, "fullName", { first: "太郎", last: "山田" });
    expect(await screen.findByText("山田 太郎")).toBeTruthy();
  });
});
