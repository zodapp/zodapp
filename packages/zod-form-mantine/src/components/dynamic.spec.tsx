// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense, useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import type { AnyFormApi } from "@tanstack/react-form";
import { z } from "zod";

import { zf, defineDynamicMeta, type ResolvedSchema } from "@zodapp/zod-form";
import {
  Switch,
  FormProvider,
  FormRuntime,
  ZodFormContextProvider,
  useArray,
  useDefaultValuesWithFills,
  useZodField,
  useZodForm,
  wrapComponent,
  type ZodFormInternalProps,
} from "@zodapp/zod-form-react/common";
import { OptionalComponent } from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as DynamicComponent } from "./dynamic";
import { component as ObjectComponent } from "./object";

const setupDomMocks = () => {
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
  if (!globalThis.ResizeObserver) {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
  }
};

// 値を表示するだけの葉
const ValueView = wrapComponent(function ValueView({
  field,
  fieldPath,
  schema,
}: ZodFormInternalProps<any>) {
  return (
    <span data-testid={`value-${fieldPath}`}>
      {schema.type}:{String(field.value ?? "")}
    </span>
  );
});

let arrayOps: { remove: (index: number) => void } | undefined;
const ArrayView = (props: ZodFormInternalProps<any>) => {
  const field = useZodField(props.fieldPath);
  const { items, remove } = useArray(field, undefined);
  arrayOps = { remove };
  const element = (props.schema as z.ZodArray<z.ZodTypeAny>).element;
  return (
    <div>
      {items.map((item) => (
        <div key={item.key}>
          <Switch
            fieldPath={`${props.fieldPath}[${item.index}]`}
            schema={element}
          />
        </div>
      ))}
    </div>
  );
};

// 読み込みを止めておける部品（React.lazy と同じく、読み込むまで suspend する）
let releaseLazyNumber: (() => void) | undefined;
const LazyNumberView = React.lazy(
  () =>
    new Promise<{ default: typeof ValueView }>((resolve) => {
      releaseLazyNumber = () => resolve({ default: ValueView });
    }),
);

const componentLibrary = {
  optional: () => ({ component: OptionalComponent }),
  number: () => ({ component: LazyNumberView }),
  object: () => ({ component: ObjectComponent }),
  string: () => ({ component: ValueView }),
  enum: () => ({ component: ValueView }),
  array: () => ({ component: ArrayView }),
  dynamic: () => ({ component: DynamicComponent }),
};

// ---------------------------------------------------------------- 都道府県・市区町村

const CITIES: Record<string, string[]> = {
  tokyo: ["shinjuku", "shibuya", "fuchu"],
  osaka: ["kita", "naka"],
  hiroshima: ["naka", "fuchu"], // 同じ value（fuchu / naka）を持つ
  kyoto: ["sakyo", "naka"],
};

type Waiting = {
  pref: string;
  resolve: (list: string[]) => void;
  reject: (error: unknown) => void;
};

/** 都道府県ごとの取得を、テストから好きな順で解決できるようにする */
const makeControlledFetcher = () => {
  const waiting: Waiting[] = [];
  const fetcher = (pref: string) =>
    new Promise<string[]>((resolve, reject) =>
      waiting.push({ pref, resolve, reject }),
    );
  const take = (pref: string) => {
    const index = waiting.findIndex((w) => w.pref === pref);
    if (index < 0) throw new Error(`no pending fetch for ${pref}`);
    return waiting.splice(index, 1)[0]!;
  };
  const flush = async (pref: string) => {
    const w = take(pref);
    await act(async () => w.resolve(CITIES[pref]!));
  };
  const fail = async (pref: string) => {
    const w = take(pref);
    await act(async () => w.reject(new Error("network")));
  };
  const flushAll = async () => {
    while (waiting.length) await flush(waiting[0]!.pref);
  };
  return { fetcher, flush, fail, flushAll, waiting };
};

let fetchCities: (pref: string) => Promise<string[]>;

/** 選択肢を購読して enum を返す dynamic（externalKey と同じ組み立て） */
const citySourceSchema = (pref: string) =>
  z.string().register(
    zf.dynamic.registry,
    defineDynamicMeta({
      dependsOnValue: false,
      resolve: () => {
        const key = `city:${pref}`;
        return {
          key,
          subscribe: (emit, fail) => {
            let active = true;
            fetchCities(pref).then(
              (list) => {
                if (active) {
                  emit({ key, schema: z.enum(list as [string, ...string[]]) });
                }
              },
              (error) => {
                if (active) fail(error);
              },
            );
            return () => {
              active = false;
            };
          },
        };
      },
    }),
  );

/** 市区町村：親の都道府県で選択肢の dynamic を返す外側の dynamic。none なら自由入力 */
const makeCitySchema = () =>
  z.string().register(
    zf.dynamic.registry,
    defineDynamicMeta<unknown, { pref?: string }>({
      dependsOnValue: false,
      dependsOnParent: true,
      resolve: ({ parent }) => {
        const pref = parent?.pref ?? "";
        if (pref === "none") return { key: "free", schema: z.string() };
        return { key: `pref:${pref}`, schema: citySourceSchema(pref) };
      },
    }),
  );

const makeRowSchema = () =>
  z
    .object({ pref: z.string(), city: makeCitySchema() })
    .register(zf.object.registry, { properties: ["pref", "city"] });

const renderForm = (
  staticSchema: z.ZodTypeAny,
  defaultValues: unknown,
  options: { withFills?: boolean } = {},
) => {
  const runtime = new FormRuntime();
  const validator = runtime.wrapValidator<any>(staticSchema);
  const onSubmit = vi.fn();
  let form: AnyFormApi | undefined;
  const FormUnderTest = () => {
    // AutoForm と同じく、dynamic が補った既定値を defaultValues にも入れる
    const withFills = useDefaultValuesWithFills(runtime, defaultValues);
    const f = useZodForm({
      defaultValues: (options.withFills ? withFills : defaultValues) as any,
      validators: { onChange: validator, onSubmit: validator },
      onSubmit: ({ value }) => onSubmit(value),
    });
    form = f as unknown as AnyFormApi;
    useState(() => null);
    return (
      <MantineProvider>
        <ZodFormContextProvider componentLibrary={componentLibrary as any}>
          <FormProvider form={f as any} runtime={runtime}>
            <Suspense fallback={null}>
              <Switch fieldPath="" schema={staticSchema} />
            </Suspense>
          </FormProvider>
        </ZodFormContextProvider>
      </MantineProvider>
    );
  };
  render(<FormUnderTest />);
  const getForm = () => form!;
  const submit = async () => {
    await act(async () => {
      await getForm().handleSubmit();
    });
  };
  /** 利用者の編集として値を書く */
  const edit = async (path: string, value: unknown) => {
    await act(async () => {
      runtime.runAsUserEdit(() =>
        getForm().setFieldValue(path, value as never),
      );
    });
  };
  return { getForm, runtime, onSubmit, submit, edit };
};

const statusOf = () =>
  Array.from(document.querySelectorAll("[data-dynamic-status]")).map((el) =>
    el.getAttribute("data-dynamic-status"),
  );

// ---------------------------------------------------------------- テスト

describe("dynamic", () => {
  let ctl: ReturnType<typeof makeControlledFetcher>;
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
    ctl = makeControlledFetcher();
    fetchCities = ctl.fetcher;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("開いただけなら値に触らず、合っていれば送信できる", async () => {
    const t = renderForm(makeRowSchema(), { pref: "tokyo", city: "shinjuku" });
    await ctl.flush("tokyo");
    expect(await screen.findByTestId("value-city")).toHaveProperty(
      "textContent",
      "enum:shinjuku",
    );
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("開いただけなら合わない保存値も残し、送信は止める", async () => {
    const t = renderForm(makeRowSchema(), { pref: "tokyo", city: "oldtown" });
    await ctl.flush("tokyo");
    await screen.findByTestId("value-city");
    expect(t.getForm().getFieldValue("city")).toBe("oldtown");
    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();
  });

  it("開いた直後、選択肢が届く前は読み込み中で、送信できない", async () => {
    const t = renderForm(makeRowSchema(), { pref: "tokyo", city: "shinjuku" });
    await waitFor(() => expect(statusOf()).toContain("loading"));
    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();
  });

  // 選択肢から外れた値を消すかどうかは enum の部品が unlisted で決める。dynamic は残す
  // （このテストの enum の部品は値を出すだけなので、値は残る）
  it("親を変えると、取得中は読み込み中で送信できず、届いても選択肢から外れた値は dynamic では消さない", async () => {
    const t = renderForm(makeRowSchema(), { pref: "tokyo", city: "shinjuku" });
    await ctl.flush("tokyo");
    await screen.findByTestId("value-city");
    await t.edit("pref", "osaka");
    expect(screen.queryByTestId("value-city")).toBeNull();
    expect(statusOf()).toContain("pending");
    expect(t.getForm().getFieldValue("city")).toBe("shinjuku");
    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();

    await ctl.flush("osaka");
    await screen.findByTestId("value-city");
    expect(t.getForm().getFieldValue("city")).toBe("shinjuku");
    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();
    await t.edit("city", "kita");
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledWith({ pref: "osaka", city: "kita" });
  });

  it("同じ value が新しい選択肢にあれば残す", async () => {
    const t = renderForm(makeRowSchema(), { pref: "tokyo", city: "fuchu" });
    await ctl.flush("tokyo");
    await screen.findByTestId("value-city");
    await t.edit("pref", "hiroshima");
    await ctl.flush("hiroshima");
    await screen.findByTestId("value-city");
    expect(t.getForm().getFieldValue("city")).toBe("fuchu");
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("続けて変えたとき、古い取得が後から届いても無視する", async () => {
    const t = renderForm(makeRowSchema(), { pref: "tokyo", city: "shinjuku" });
    await ctl.flush("tokyo");
    await screen.findByTestId("value-city");
    await t.edit("pref", "osaka");
    await t.edit("pref", "kyoto");
    await ctl.flush("kyoto");
    await ctl.flush("osaka"); // 遅れて届く
    await screen.findByTestId("value-city");
    expect(t.getForm().getFieldValue("city")).toBe("shinjuku");
    await t.edit("city", "sakyo");
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledWith({ pref: "kyoto", city: "sakyo" });
  });

  it("変えて、届く前に戻すと値は残る", async () => {
    const t = renderForm(makeRowSchema(), { pref: "tokyo", city: "shinjuku" });
    await ctl.flush("tokyo");
    await screen.findByTestId("value-city");
    await t.edit("pref", "osaka");
    await t.edit("pref", "tokyo");
    await ctl.flush("tokyo");
    await screen.findByTestId("value-city");
    expect(t.getForm().getFieldValue("city")).toBe("shinjuku");
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("取得に失敗したら error になって送信できず、再試行で取り直せる", async () => {
    const t = renderForm(makeRowSchema(), { pref: "tokyo", city: "shinjuku" });
    await ctl.flush("tokyo");
    await screen.findByTestId("value-city");
    await t.edit("pref", "osaka");
    await ctl.fail("osaka");
    expect(statusOf()).toContain("error");
    expect(t.runtime.get("city")?.status).toBe("error");
    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      screen.getByRole("button", { name: "再試行" }).click();
    });
    await ctl.flush("osaka");
    await screen.findByTestId("value-city");
    expect(t.runtime.get("city")?.status).toBe("resolved");
  });

  it("取得中に自由入力へ切り替えると、内側の登録が消えて送信できる", async () => {
    const t = renderForm(makeRowSchema(), { pref: "tokyo", city: "shinjuku" });
    await ctl.flush("tokyo");
    await screen.findByTestId("value-city");
    await t.edit("pref", "osaka");
    expect(t.runtime.get("city")?.status).toBe("pending");
    await t.edit("pref", "none");
    await screen.findByTestId("value-city");
    expect(t.runtime.get("city")).toMatchObject({ status: "resolved" });
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledWith({ pref: "none", city: "shinjuku" });
  });

  it("同期の resolve は、最初から読み込み中を出さない", () => {
    renderForm(makeRowSchema(), { pref: "none", city: "x" });
    expect(screen.getByTestId("value-city")).toHaveProperty(
      "textContent",
      "string:x",
    );
  });

  it("同じ key のまま選択肢だけが変わる（購読の更新）なら、値を消さずにエラーにする", async () => {
    let emitRef: ((resolved: ResolvedSchema) => void) | undefined;
    const x = z.string().register(
      zf.dynamic.registry,
      defineDynamicMeta({
        dependsOnValue: false,
        resolve: () => ({
          key: "k",
          subscribe: (emit) => {
            emitRef = emit;
            emit({ key: "k", schema: z.enum(["a", "b"]) });
            return () => {};
          },
        }),
      }),
    );
    const root = z
      .object({ x })
      .register(zf.object.registry, { properties: ["x"] });
    const t = renderForm(root, { x: "a" });
    await screen.findByTestId("value-x");
    await act(async () => {
      emitRef!({ key: "k", schema: z.enum(["b"]) });
    });
    expect(t.getForm().getFieldValue("x")).toBe("a");
    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();
  });

  it("外からの値の入れ替え（reset）では、保存値を消さない", async () => {
    const t = renderForm(makeRowSchema(), { pref: "tokyo", city: "shinjuku" });
    await ctl.flush("tokyo");
    await screen.findByTestId("value-city");
    await act(async () => {
      t.runtime.runAsUserEdit(() =>
        t.getForm().reset({ pref: "osaka", city: "oldtown" } as never),
      );
    });
    await ctl.flushAll();
    await screen.findByTestId("value-city");
    expect(t.getForm().getFieldValue("city")).toBe("oldtown");
  });

  it("アプリのコードの書き込みは既定で外からとみなし、値を消さない", async () => {
    const t = renderForm(makeRowSchema(), { pref: "tokyo", city: "shinjuku" });
    await ctl.flush("tokyo");
    await screen.findByTestId("value-city");
    await act(async () => {
      t.getForm().setFieldValue("pref", "osaka" as never);
    });
    await ctl.flush("osaka");
    await screen.findByTestId("value-city");
    expect(t.getForm().getFieldValue("city")).toBe("shinjuku");
  });

  it("利用者の編集で prune しても、削った欄を「触った」「変えた」にしない", async () => {
    const detail = z.unknown().register(
      zf.dynamic.registry,
      defineDynamicMeta<unknown, { kind?: string }>({
        dependsOnValue: false,
        dependsOnParent: true,
        resolve: ({ parent }) => ({
          key: parent?.kind ?? "",
          schema:
            parent?.kind === "short"
              ? z.object({ x: z.string() })
              : z.object({ x: z.string(), y: z.string() }),
        }),
      }),
    );
    const root = z
      .object({ kind: z.string(), detail })
      .register(zf.object.registry, { properties: ["kind", "detail"] });
    const t = renderForm(root, { kind: "long", detail: { x: "1", y: "2" } });
    await screen.findByTestId("value-detail.y");
    await t.edit("kind", "short");
    await waitFor(() =>
      expect(t.getForm().getFieldValue("detail")).toEqual({ x: "1" }),
    );
    expect(t.getForm().getFieldMeta("detail")?.isTouched).toBe(false);
    expect(t.getForm().getFieldMeta("detail")?.isDirty).toBe(false);
  });

  describe("最初に決まったときに既定値を補う", () => {
    const makeRoot = (optional = false) => {
      const base = z.unknown().register(
        zf.dynamic.registry,
        defineDynamicMeta({
          dependsOnValue: false,
          resolve: () => ({
            key: "fixed",
            schema: z.object({
              x: z.string().default("a"),
              items: z.array(
                z.object({ name: z.string(), qty: z.number().default(1) }),
              ),
            }),
          }),
        }),
      );
      return z
        .object({ detail: optional ? base.optional() : base })
        .register(zf.object.registry, { properties: ["detail"] });
    };

    it("値が無ければ、決まった schema の既定値を入れる", async () => {
      const t = renderForm(makeRoot(), {});
      await waitFor(() =>
        expect(t.getForm().getFieldValue("detail")).toEqual({
          x: "a",
          items: [],
        }),
      );
    });

    it("保存済みの値は変えず、配列の要素の中も含めて無いところだけを補う。「触った」「変えた」にしない", async () => {
      const t = renderForm(makeRoot(), {
        detail: { x: "keep", items: [{ name: "n" }], extra: 1 },
      });
      await waitFor(() =>
        expect(t.getForm().getFieldValue("detail")).toEqual({
          x: "keep",
          items: [{ name: "n", qty: 1 }],
          extra: 1,
        }),
      );
      expect(t.getForm().getFieldMeta("detail")?.isTouched).toBe(false);
      expect(t.getForm().getFieldMeta("detail")?.isDirty).toBe(false);
    });

    it("AutoForm と同じく defaultValues にも補いを入れると、開いただけでは isDefaultValue のままで、reset でも補いが残る", async () => {
      const t = renderForm(
        makeRoot(),
        { detail: { x: "keep", items: [{ name: "n" }] } },
        { withFills: true },
      );
      const filled = { x: "keep", items: [{ name: "n", qty: 1 }] };
      await waitFor(() =>
        expect(t.getForm().getFieldValue("detail")).toEqual(filled),
      );
      await waitFor(() => expect(t.getForm().state.isDefaultValue).toBe(true));

      await act(async () => {
        t.getForm().setFieldValue("detail.x" as never, "changed" as never);
      });
      expect(t.getForm().state.isDefaultValue).toBe(false);

      await act(async () => {
        t.getForm().reset();
      });
      expect(t.getForm().getFieldValue("detail")).toEqual(filled);
      expect(t.getForm().state.isDefaultValue).toBe(true);
    });

    it("optional で値が無ければ補わない", async () => {
      const t = renderForm(makeRoot(true), {});
      await screen.findAllByTestId(/value-/).catch(() => undefined);
      await act(async () => {});
      expect(t.getForm().getFieldValue("detail")).toBeUndefined();
    });
  });

  it("runAsUserEdit は Promise を返す関数を受け付けない", () => {
    const runtime = new FormRuntime();
    expect(() => runtime.runAsUserEdit(async () => {})).toThrow();
  });

  describe("{ key, load }", () => {
    /** 市区町村：key は都道府県。load は同じ key のあいだ呼び直されない */
    const makeLoadRow = (load: (pref: string) => Promise<string[]>) =>
      z
        .object({
          pref: z.string(),
          memo: z.string().optional(),
          city: z.string().register(
            zf.dynamic.registry,
            defineDynamicMeta<unknown, { pref?: string }>({
              dependsOnValue: false,
              dependsOnParent: true,
              resolve: ({ parent }) => {
                const pref = parent?.pref ?? "";
                return {
                  key: pref,
                  load: async () => ({
                    schema: z.enum((await load(pref)) as [string, ...string[]]),
                  }),
                };
              },
            }),
          ),
        })
        .register(zf.object.registry, { properties: ["pref", "memo", "city"] });

    it("兄弟の欄を変えても取り直さず、key が変わったときだけ取り直す", async () => {
      const load = vi.fn((pref: string) => ctl.fetcher(pref));
      const t = renderForm(makeLoadRow(load), {
        pref: "tokyo",
        memo: "",
        city: "shinjuku",
      });
      await ctl.flush("tokyo");
      await screen.findByTestId("value-city");
      const calls = load.mock.calls.length;

      await t.edit("memo", "あいう");
      expect(load.mock.calls.length).toBe(calls);
      expect(statusOf()).not.toContain("pending");

      await t.edit("pref", "osaka");
      expect(load.mock.calls.length).toBeGreaterThan(calls);
      expect(statusOf()).toContain("pending");
      await ctl.flush("osaka");
      await waitFor(() => expect(statusOf()).not.toContain("pending"));
    });

    it("失敗のあとの再試行は、key が同じでも load を呼び直す", async () => {
      const load = vi.fn((pref: string) => ctl.fetcher(pref));
      const t = renderForm(makeLoadRow(load), {
        pref: "tokyo",
        memo: "",
        city: "shinjuku",
      });
      await ctl.fail("tokyo");
      expect(statusOf()).toContain("error");
      const calls = load.mock.calls.length;
      await act(async () => {
        screen.getByRole("button", { name: "再試行" }).click();
      });
      expect(load.mock.calls.length).toBeGreaterThan(calls);
      await ctl.flush("tokyo");
      await screen.findByTestId("value-city");
      expect(t.runtime.get("city")?.status).toBe("resolved");
    });

    it("load が返した key を schema の同一性に使う（取得の key が変わっても、同じ key なら prune しない）", async () => {
      const row = z
        .object({
          pref: z.string(),
          city: z.string().register(
            zf.dynamic.registry,
            defineDynamicMeta<unknown, { pref?: string }>({
              dependsOnValue: false,
              dependsOnParent: true,
              resolve: ({ parent }) => {
                const pref = parent?.pref ?? "";
                return {
                  key: pref,
                  load: async () => ({
                    // 取得は都道府県ごとだが、schema は同じものとして扱う
                    key: "shared",
                    schema: z.enum(
                      (await ctl.fetcher(pref)) as [string, ...string[]],
                    ),
                  }),
                };
              },
            }),
          ),
        })
        .register(zf.object.registry, { properties: ["pref", "city"] });
      const t = renderForm(row, { pref: "tokyo", city: "shinjuku" });
      await ctl.flush("tokyo");
      await screen.findByTestId("value-city");
      await t.edit("pref", "osaka");
      await ctl.flush("osaka");
      await screen.findByTestId("value-city");
      // key が同じなので値には触らず、検証エラーとして残す
      expect(t.getForm().getFieldValue("city")).toBe("shinjuku");
      await t.submit();
      expect(t.onSubmit).not.toHaveBeenCalled();
    });

    it("resolve が Promise を直接返したら error にする", async () => {
      const x = z.string().register(
        zf.dynamic.registry,
        defineDynamicMeta({
          resolve: (async () => ({ key: "k", schema: z.string() })) as never,
        }),
      );
      const root = z
        .object({ x })
        .register(zf.object.registry, { properties: ["x"] });
      renderForm(root, { x: "a" });
      await waitFor(() => expect(statusOf()).toContain("error"));
    });
  });

  describe("配列", () => {
    const listSchema = () =>
      z
        .object({ rows: z.array(makeRowSchema()) })
        .register(zf.object.registry, { properties: ["rows"] });

    it("部品の操作で要素を消しても、残った行の値はそのままで、登録も付け替わる", async () => {
      const t = renderForm(listSchema(), {
        rows: [
          { pref: "tokyo", city: "shinjuku" },
          { pref: "osaka", city: "oldtown" }, // 保存済みの合わない値
        ],
      });
      await ctl.flush("tokyo");
      await ctl.flush("osaka");
      await screen.findByTestId("value-rows[1].city");
      await act(async () => {
        arrayOps!.remove(0);
      });
      await ctl.flushAll();
      await screen.findByTestId("value-rows[0].city");
      expect(t.getForm().getFieldValue("rows")).toEqual([
        { pref: "osaka", city: "oldtown" },
      ]);
      expect(t.runtime.get("rows[1].city")).toBeUndefined();
    });

    it("フォームの API で要素を消しても、保存値は消えない", async () => {
      const t = renderForm(listSchema(), {
        rows: [
          { pref: "tokyo", city: "shinjuku" },
          { pref: "osaka", city: "oldtown" },
        ],
      });
      await ctl.flush("tokyo");
      await ctl.flush("osaka");
      await screen.findByTestId("value-rows[1].city");
      await act(async () => {
        await t.getForm().removeFieldValue("rows" as never, 0);
      });
      await ctl.flushAll();
      await screen.findByTestId("value-rows[0].city");
      expect(t.getForm().getFieldValue("rows")).toEqual([
        { pref: "osaka", city: "oldtown" },
      ]);
      expect(t.runtime.get("rows[1].city")).toBeUndefined();
    });
  });

  it("決まった schema の部品を読み込むあいだは、この欄だけを読み込み中にし、ほかの欄は出したままにする", async () => {
    const x = z.unknown().register(
      zf.dynamic.registry,
      defineDynamicMeta({
        dependsOnValue: false,
        resolve: () => ({ key: "number", schema: z.number() }),
      }),
    );
    const root = z
      .object({ name: z.string(), x })
      .register(zf.object.registry, { properties: ["name", "x"] });
    renderForm(root, { name: "a", x: 1 });
    await waitFor(() => expect(releaseLazyNumber).toBeDefined());
    expect(screen.getByTestId("value-name")).toHaveProperty(
      "textContent",
      "string:a",
    );
    expect(screen.getByText("読み込み中")).toBeTruthy();
    await act(async () => releaseLazyNumber!());
    expect((await screen.findByTestId("value-x")).textContent).toBe("number:1");
    expect(screen.queryByText("読み込み中")).toBeNull();
  });
});
