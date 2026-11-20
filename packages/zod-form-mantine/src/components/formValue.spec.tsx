// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * form の中では、部品に value を渡さない（値は useField で store から読む）
 */
import React, { Suspense } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import {
  Switch,
  FormProvider,
  FormRuntime,
  ZodFormContextProvider,
  useZodForm,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { baseComponents } from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as ObjectComponent } from "./object";

const seen: ZodFormProps[] = [];
const Probe = (props: ZodFormProps) => {
  seen.push(props);
  return null;
};

describe("form の中の value", () => {
  beforeEach(() => {
    if (!window.matchMedia) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
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
  afterEach(() => {
    cleanup();
    seen.length = 0;
  });

  it("object の子にも、包みの中にも value は渡らない", async () => {
    const schema = z.object({
      a: zf.string(),
      b: zf.string().default("d").optional(),
    });
    const runtime = new FormRuntime();
    const Form = () => {
      const form = useZodForm({ defaultValues: { a: "va", b: "vb" } as any });
      return (
        <MantineProvider>
          <ZodFormContextProvider
            componentLibrary={
              {
                ...baseComponents,
                object: () => ({ component: ObjectComponent }),
                string: () => ({ component: Probe }),
              } as any
            }
          >
            <FormProvider form={form as any} runtime={runtime}>
              <Suspense fallback={null}>
                <Switch fieldPath="" schema={schema} />
              </Suspense>
            </FormProvider>
          </ZodFormContextProvider>
        </MantineProvider>
      );
    };
    render(<Form />);
    await waitFor(() =>
      expect(new Set(seen.map((p) => p.fieldPath))).toEqual(
        new Set(["a", "b"]),
      ),
    );
    expect(seen.every((p) => p.value === undefined)).toBe(true);
  });
});
