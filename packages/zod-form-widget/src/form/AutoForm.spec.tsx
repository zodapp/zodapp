// @vitest-environment jsdom
/**
 * AutoForm の onSubmit には、parse した値（z.output）を渡す（#1）
 */
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import { z } from "zod";
import { zf, defineDynamicMeta } from "@zodapp/zod-form";
import { AutoForm } from "./AutoForm";
import { createAutoFormButtonAction } from "./autoFormActions";

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
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
};

const renderAutoForm = <T extends z.ZodTypeAny>(
  schema: T,
  defaultValues?: z.input<T>,
) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <MantineProvider>
      <AutoForm
        schema={schema}
        defaultValues={defaultValues}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </MantineProvider>,
  );
  const submit = async () =>
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
  const cancel = async () =>
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  return { onSubmit, onCancel, submit, cancel };
};

/** 同期で schema が決まる dynamic */
const dynamicOf = (schema: z.ZodTypeAny) =>
  zf
    .dynamic()
    .register(
      zf.dynamic.registry,
      defineDynamicMeta({ resolve: () => ({ key: "fixed", schema }) }),
    );

describe("AutoForm の onSubmit は parse した値を受け取る", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("trim・toLowerCase・default・coerce・transform の結果が届く", async () => {
    const schema = z.object({
      name: z.string().trim().toLowerCase(),
      tag: z.string().default("d"),
      count: z.coerce.number(),
      upper: z.string().transform((value) => value.toUpperCase()),
    });
    const { onSubmit, submit } = renderAutoForm(schema, {
      name: "  ABC  ",
      count: "3",
      upper: "x",
    } as z.input<typeof schema>);
    await submit();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "abc",
        tag: "d",
        count: 3,
        upper: "X",
      }),
    );
  });

  it("onCancel には、フォームの値（input）を渡す", async () => {
    const schema = z.object({ name: z.string().trim() });
    const { onCancel, cancel } = renderAutoForm(schema, { name: "  a  " });
    await cancel();
    await waitFor(() =>
      expect(onCancel).toHaveBeenCalledWith({ name: "  a  " }),
    );
  });

  it("dynamic の output が届き、外側の transform・refine は dynamic の output を受け取る", async () => {
    const seen = vi.fn();
    const schema = z
      .object({
        amount: dynamicOf(z.string().transform(Number)),
        list: z.array(z.object({ v: dynamicOf(z.string().trim()) })),
      })
      .refine((value) => {
        seen(value.amount);
        return true;
      })
      .transform((value) => ({
        ...value,
        doubled: (value.amount as number) * 2,
      }));
    const { onSubmit, submit } = renderAutoForm(schema, {
      amount: "21",
      list: [{ v: " a " }],
    } as z.input<typeof schema>);
    await submit();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        amount: 21,
        list: [{ v: "a" }],
        doubled: 42,
      }),
    );
    expect(seen).toHaveBeenLastCalledWith(21);
  });

  it("dynamic の中の dynamic は、内側を先に差し込む", async () => {
    const inner = dynamicOf(z.string().transform((value) => `${value}!`));
    const schema = z.object({
      outer: dynamicOf(z.object({ inner })),
    });
    const { onSubmit, submit } = renderAutoForm(schema, {
      outer: { inner: "x" },
    } as z.input<typeof schema>);
    await submit();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ outer: { inner: "x!" } }),
    );
  });
});

describe("AutoForm の検証は、送信と同じく dynamic の output を受け取る", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("変換後の値を前提にする親の refine があっても、送信できる", async () => {
    const schema = z
      .object({
        a: dynamicOf(z.string().transform(Number)),
        b: z.number(),
      })
      .refine(
        (value) => typeof value.a === "number" && value.a < value.b,
        "a < b",
      );
    const { onSubmit, submit } = renderAutoForm(schema, {
      a: "3",
      b: 5,
    } as z.input<typeof schema>);
    await submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ a: 3, b: 5 }));
    expect(screen.queryByTestId("form-submit-blocked")).toBeNull();
  });

  it("dynamic が通らないときは、親の refine を走らせずに入力の誤りとして止める", async () => {
    const refine = vi.fn(() => false);
    const schema = z
      .object({ a: dynamicOf(z.string().min(3, "too short")) })
      .refine(refine, "parent");
    const { onSubmit, submit } = renderAutoForm(schema, { a: "x" });
    await submit();
    const blocked = await screen.findByTestId("form-submit-blocked");
    expect(blocked.textContent).toContain("some fields have errors");
    expect(await screen.findByText("too short")).toBeTruthy();
    expect(screen.queryByText("parent")).toBeNull();
    expect(refine).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("読み込み中の dynamic があれば、読み込み中として止める", async () => {
    const schema = z.object({
      a: zf.dynamic().register(
        zf.dynamic.registry,
        defineDynamicMeta({
          resolve: () => ({
            key: "slow",
            load: () => new Promise<undefined>(() => {}),
          }),
        }),
      ),
    });
    const { onSubmit, submit } = renderAutoForm(schema, { a: "x" });
    await submit();
    const blocked = await screen.findByTestId("form-submit-blocked");
    expect(blocked.textContent).toContain("still loading");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("AutoForm の handleSubmit は、送らなかったときも必ず決着する", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  /** 押した後の refine の呼び出しを数え、failAt 回目だけ落とす schema と、handleSubmit を待つボタン */
  const renderWithCountingRefine = (failAt: number | undefined) => {
    const state = { armed: false, calls: 0 };
    const schema = z.object({ name: z.string() }).refine(() => {
      if (!state.armed) return true;
      state.calls += 1;
      return state.calls !== failAt;
    }, "changes every call");
    const settled = vi.fn();
    render(
      <MantineProvider>
        <AutoForm
          schema={schema}
          defaultValues={{ name: "a" }}
          actionComponents={[
            createAutoFormButtonAction<typeof schema>({
              label: "Run",
              onClick: async ({ handleSubmit }) => {
                settled(await handleSubmit());
              },
            }),
          ]}
        />
      </MantineProvider>,
    );
    const click = async () => {
      state.armed = true;
      fireEvent.click(await screen.findByRole("button", { name: "Run" }));
    };
    return { state, settled, click };
  };

  it("検証で通り、送る前の parse で落ち、評価し直すと通るときも、undefined で決着する", async () => {
    // 落とさずに 1 回送信して、送信 1 回あたりの refine の呼び出し数を数える
    const probe = renderWithCountingRefine(undefined);
    await probe.click();
    await waitFor(() => expect(probe.settled).toHaveBeenCalledTimes(1));
    expect(probe.settled.mock.calls[0]![0]).toEqual({ name: "a" });
    const callsPerSubmit = probe.state.calls;
    cleanup();

    // 最後の呼び出し（送る前の parse）だけを落とす。その後の評価し直しは通る
    const t = renderWithCountingRefine(callsPerSubmit);
    await t.click();
    await waitFor(() => expect(t.settled).toHaveBeenCalledTimes(1));
    expect(t.settled.mock.calls[0]![0]).toBeUndefined();
    expect(t.state.calls).toBe(callsPerSubmit + 1);
  });
});

describe("AutoForm は開くときに、値が無いところを schema の既定値で補う（#10）", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const schema = z.object({
    kind: z.literal("article"),
    nothing: z.undefined(),
    tag: z.string().default("d"),
    items: z.array(z.string()),
    meta: z.object({ note: z.string().optional() }),
  });

  it("defaultValues が無くても、補った値で送信できる", async () => {
    const { onSubmit, onCancel, submit, cancel } = renderAutoForm(schema);
    await cancel();
    await waitFor(() => expect(onCancel).toHaveBeenCalled());
    const opened = onCancel.mock.calls[0]![0];
    expect(opened).toEqual({
      kind: "article",
      nothing: undefined,
      tag: "d",
      items: [],
      meta: {},
    });
    expect(Object.hasOwn(opened, "nothing")).toBe(true);
    await submit();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        kind: "article",
        nothing: undefined,
        tag: "d",
        items: [],
        meta: {},
      }),
    );
  });

  it("渡された値は変えず、無いキーだけを補う（保存されていた古い値）", async () => {
    const { onSubmit, submit } = renderAutoForm(schema, {
      tag: "saved",
      items: ["a"],
    } as unknown as z.input<typeof schema>);
    await submit();
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        kind: "article",
        nothing: undefined,
        tag: "saved",
        items: ["a"],
        meta: {},
      }),
    );
  });

  it("補えない schema（optional の付かない z.lazy）でも落ちず、console.error を出す", async () => {
    type Node = { child: Node };
    const node: z.ZodType<Node> = z.lazy(() => z.object({ child: node }));
    // 描画は hidden で止める（optional の付かない再帰は、描いても終わらないため）。
    // getDefaultValue は hidden でも schema を歩くので、無限に再帰する
    renderAutoForm(
      z.object({
        name: z.string().optional(),
        node: node.register(zf.common.registry, { hidden: true }),
      }),
    );
    expect(await screen.findByRole("button", { name: "Save" })).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("[AutoForm] Could not fill the default values"),
      expect.anything(),
    );
  });
});

describe("AutoForm と非同期の検証", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("z.promise() の欄は扱えない注記を出し、送信が止まった理由を出す", async () => {
    const schema = z.object({
      name: z.string().optional(),
      p: z.promise(z.number()),
    });
    const { submit, onSubmit } = renderAutoForm(schema, {
      p: Promise.resolve(1),
    } as z.input<typeof schema>);
    expect(
      await screen.findByText("This form cannot handle this schema."),
    ).toBeTruthy();
    await submit();
    const blocked = await screen.findByTestId("form-submit-blocked");
    expect(blocked.textContent).toContain("asynchronous validation");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("async の refine でも落ちず、送信が止まった理由を出す", async () => {
    const schema = z
      .object({ name: z.string().optional() })
      .refine(async () => true);
    const { submit, onSubmit } = renderAutoForm(schema, {});
    await submit();
    const blocked = await screen.findByTestId("form-submit-blocked");
    expect(blocked.textContent).toContain("asynchronous validation");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
