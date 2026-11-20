// @vitest-environment jsdom
/**
 * ReactiveAutoForm は表示する値を values で受け取り、来たときに既定値で補う
 */
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { ReactiveAutoForm } from "./ReactiveAutoForm";

const setupDomMocks = () => {
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
  if (!globalThis.ResizeObserver) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
  }
};

const label = (name: string) =>
  zf.string().register(zf.string.registry, { label: name });

const schema = z.object({
  a: label("A").default("x"),
  b: label("B"),
  c: label("C").optional(),
});

type Values = Partial<z.input<typeof schema>>;

const Harness = ({
  values,
  onConfirm,
}: {
  values: Values;
  onConfirm?: (fieldPath: string, value: unknown) => void;
}) => (
  <MantineProvider>
    <ReactiveAutoForm schema={schema} values={values} onConfirm={onConfirm} />
  </MantineProvider>
);

const inputOf = async (name: string) =>
  (await screen.findByLabelText(new RegExp(`^${name}`))) as HTMLInputElement;

describe("ReactiveAutoForm の values", () => {
  beforeEach(() => {
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("値が undefined の .default() の欄に、既定値を出す", async () => {
    render(<Harness values={{ b: "b" }} />);
    expect((await inputOf("A")).value).toBe("x");
    expect((await inputOf("B")).value).toBe("b");
    expect((await inputOf("C")).value).toBe("");
  });

  it("外の values が変わると、補い直して追従する", async () => {
    const { rerender } = render(<Harness values={{ a: "y", b: "b" }} />);
    expect((await inputOf("A")).value).toBe("y");
    rerender(<Harness values={{ b: "b2" }} />);
    await waitFor(async () => expect((await inputOf("A")).value).toBe("x"));
    expect((await inputOf("B")).value).toBe("b2");
  });

  it("確定するのは触った欄だけで、触っていない default の欄は onConfirm に出ない", async () => {
    const onConfirm = vi.fn();
    render(<Harness values={{ b: "b" }} onConfirm={onConfirm} />);
    const b = await inputOf("B");
    fireEvent.change(b, { target: { value: "b2" } });
    await act(async () => {
      fireEvent.keyDown(b, { key: "Enter", ctrlKey: true });
    });
    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(onConfirm.mock.calls.map(([path]) => path)).toEqual(["b"]);
    expect((await inputOf("A")).value).toBe("x");
  });

  it("補えない schema（optional の付かない z.lazy の再帰）でも描ける", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    type Node = { name: string; child: Node };
    const node: z.ZodType<Node> = z.lazy(() =>
      z.object({ name: label("Name"), child: node }),
    );
    const recursive = z.object({ root: label("Root"), tree: node });
    render(
      <MantineProvider>
        <ReactiveAutoForm schema={recursive} values={{ root: "r" }} />
      </MantineProvider>,
    );
    expect((await inputOf("Root")).value).toBe("r");
  });

  it("preprocess は 1 回だけかける（冪等でない preprocess でも値が変わらない）", async () => {
    const withPreprocess = z.object({
      n: z.preprocess(
        (v) => (typeof v === "number" ? v * 1000 : v),
        zf.number().register(zf.number.registry, { label: "N" }),
      ),
    });
    render(
      <MantineProvider>
        <ReactiveAutoForm schema={withPreprocess} values={{ n: 2 }} />
      </MantineProvider>,
    );
    expect((await inputOf("N")).value).toBe("2000");
  });
});
