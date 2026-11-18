// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense } from "react";
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
import type { AnyFormApi } from "@tanstack/react-form";
import { z } from "zod";

import { zf, type ExternalKeyUnlistedOptions } from "@zodapp/zod-form";
import type { ExternalKeyResolvers } from "@zodapp/zod-form/externalKey/types";
import {
  Switch,
  FormProvider,
  FormRuntime,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import {
  NullableComponent,
  OptionalComponent,
} from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as ArrayOfEnumComponent } from "./array_multipleEnum";
import { component as ArrayOfExternalKeyComponent } from "./array_multipleExternalKey";
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
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  }
};

const componentLibrary = {
  optional: () => ({ component: OptionalComponent }),
  nullable: () => ({ component: NullableComponent }),
  object: () => ({ component: ObjectComponent }),
  array_multipleEnum: () => ({ component: ArrayOfEnumComponent }),
  array_multipleExternalKey: () => ({ component: ArrayOfExternalKeyComponent }),
};

type Option = { label: string; value: string };

/** 選択肢と失敗をテストから流せる resolver */
const makeResolvers = () => {
  const listeners = new Set<(options: Option[]) => void>();
  const errorListeners = new Set<(error: unknown) => void>();
  let latest: Option[] | undefined;
  const subscribeCount = vi.fn();
  const resolvers: ExternalKeyResolvers = [
    {
      type: "list",
      resolver: () => ({
        subscribe: (
          callback: (options: Option[]) => void,
          onError?: (error: unknown) => void,
        ) => {
          subscribeCount();
          listeners.add(callback);
          if (onError) errorListeners.add(onError);
          if (latest) callback(latest);
          return () => {
            listeners.delete(callback);
            if (onError) errorListeners.delete(onError);
          };
        },
      }),
    },
  ];
  const publish = async (options: Option[]) => {
    latest = options;
    await act(async () => {
      listeners.forEach((callback) => callback(options));
    });
  };
  const fail = async (error: unknown) => {
    await act(async () => {
      errorListeners.forEach((onError) => onError(error));
    });
  };
  /** 購読中の欄には届けず、次に購読した欄にその場で届く選択肢を用意する */
  const prepare = (options: Option[]) => {
    latest = options;
  };
  return { resolvers, publish, fail, prepare, subscribeCount };
};

const renderForm = (
  schema: z.ZodTypeAny,
  defaultValues: unknown,
  resolvers: ExternalKeyResolvers,
) => {
  const runtime = new FormRuntime();
  const validator = runtime.wrapValidator<any>(schema);
  const onSubmit = vi.fn();
  let form: AnyFormApi | undefined;
  const FormUnderTest = () => {
    const f = useZodForm({
      defaultValues: defaultValues as any,
      validators: { onChange: validator, onSubmit: validator },
      onSubmit: ({ value }) => onSubmit(value),
    });
    form = f as unknown as AnyFormApi;
    return (
      <MantineProvider>
        <ZodFormContextProvider
          componentLibrary={componentLibrary as any}
          externalKeyResolvers={resolvers}
        >
          <FormProvider form={f as any} runtime={runtime}>
            <Suspense fallback={null}>
              <Switch fieldPath="" schema={schema} />
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
  return { getForm, runtime, onSubmit, submit };
};

const memberKey = (
  options: ExternalKeyUnlistedOptions & { emptyMessage?: string } = {},
) =>
  zf.string().register(zf.externalKey.registry, {
    label: "メンバー",
    externalKeyConfig: { type: "list" },
    ...options,
  });

const members = (
  options: ExternalKeyUnlistedOptions & { emptyMessage?: string } = {},
) =>
  zf.array(memberKey(options)).register(zf.array.registry, {
    label: "メンバーたち",
    uiType: "multipleExternalKey",
  });

const everyone: Option[] = [
  { label: "利用者 A", value: "u1" },
  { label: "利用者 B", value: "u2" },
];

/** 欄に並ぶ選んだ値（Pill）の表示 */
const pills = () =>
  [...document.querySelectorAll(".mantine-Pill-label")].map(
    (element) => element.textContent,
  );

/** 選んだ値の表示が揃うまで待つ */
const expectPills = async (expected: string[]) => {
  await waitFor(() => expect(pills()).toEqual(expected));
};

const UNLISTED_ERROR = "選択肢に無い値があります。消すか、選び直してください。";

describe("複数選択の externalKey（dynamic + ラッパー）", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("選択肢が届くまでは読み込み中で送信できず、届いたら選んだ値のラベルを出す", async () => {
    const r = makeResolvers();
    const t = renderForm(
      z.object({ members: members() }),
      { members: ["u1", "u2"] },
      r.resolvers,
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-dynamic-status="loading"]'),
      ).toBeTruthy(),
    );
    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();

    await r.publish(everyone);
    await expectPills(["利用者 A", "利用者 B"]);
    expect(document.querySelector("[data-dynamic-status]")).toBeNull();
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledWith({ members: ["u1", "u2"] });
  });

  describe("取得の失敗（resolver の onError）", () => {
    it("error になり、再試行が出て送信が止まる。値は消さない", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ members: members() }),
        { members: ["u1"] },
        r.resolvers,
      );
      await r.publish(everyone);
      await waitFor(() => expect(pills()).toContain("利用者 A"));

      await r.fail(new Error("取得に失敗しました"));
      await waitFor(() =>
        expect(t.runtime.get("members")?.status).toBe("error"),
      );
      expect(
        document.querySelector('[data-dynamic-status="error"]'),
      ).toBeTruthy();
      expect(
        screen.getByText("メンバーたちを取得できませんでした"),
      ).toBeTruthy();
      await t.submit();
      expect(t.onSubmit).not.toHaveBeenCalled();
      expect(t.getForm().getFieldValue("members")).toEqual(["u1"]);
    });

    it("最初の取得が失敗しても、runtime.validate は送信を止める", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ members: members() }),
        { members: ["u1"] },
        r.resolvers,
      );
      await r.fail(new Error("取得に失敗しました"));
      await waitFor(() =>
        expect(t.runtime.get("members")?.status).toBe("error"),
      );
      // 静的な schema では通る値でも、取得できなかった欄があるので誤りになる
      const issues = t.runtime.validate(z.object({ members: members() }), {
        members: ["u1"],
      });
      expect(issues.length).toBeGreaterThan(0);
      await t.submit();
      expect(t.onSubmit).not.toHaveBeenCalled();
    });

    it("再試行を押すと、購読をやめて最初からやり直し、届けば送信できる", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ members: members() }),
        { members: ["u1"] },
        r.resolvers,
      );
      await r.fail(new Error("取得に失敗しました"));
      await screen.findByRole("button", { name: "再試行" });
      r.prepare(everyone);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "再試行" }));
      });
      await waitFor(() => expect(pills()).toContain("利用者 A"));
      expect(r.subscribeCount).toHaveBeenCalledTimes(2);
      await t.submit();
      expect(t.onSubmit).toHaveBeenCalledWith({ members: ["u1"] });
    });
  });

  describe("選択肢に無い値", () => {
    it("既定（unlisted: clear）では、選択肢に無い要素だけを消し、欄を「変えた」にしない", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ members: members() }),
        { members: ["u1", "gone"] },
        r.resolvers,
      );
      await r.publish(everyone);
      await waitFor(() =>
        expect(t.getForm().getFieldValue("members")).toEqual(["u1"]),
      );
      expect(t.getForm().state.isDirty).toBe(false);
      expect(t.getForm().getFieldMeta("members")?.isTouched).toBe(false);
      expect(screen.queryAllByText("（不正な値）")).toHaveLength(0);
    });

    it("既定（unlisted: clear）で、すべての要素が選択肢に無ければ、値を空にする", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ members: members() }),
        { members: ["gone"] },
        r.resolvers,
      );
      await r.publish(everyone);
      await waitFor(() =>
        expect(t.getForm().getFieldValue("members")).toBeUndefined(),
      );
    });

    it("unlisted: keep なら、要素を残し、「（不正な値）」とエラーを出して送信を止める。消すと送信できる", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ members: members({ unlisted: "keep" }) }),
        { members: ["u1", "gone"] },
        r.resolvers,
      );
      await r.publish(everyone);
      await expectPills(["利用者 A", "（不正な値）"]);
      // 触る前から出す
      expect(screen.getByText(UNLISTED_ERROR)).toBeTruthy();
      // ID などの生の値は見せない
      expect(screen.queryAllByText("gone")).toHaveLength(0);
      await t.submit();
      expect(t.onSubmit).not.toHaveBeenCalled();
      expect(t.getForm().getFieldValue("members")).toEqual(["u1", "gone"]);

      // 「（不正な値）」の × で消せる
      const pill = [...document.querySelectorAll(".mantine-Pill-root")].find(
        (element) => element.textContent?.includes("（不正な値）"),
      );
      const remove = pill?.querySelector(".mantine-Pill-remove");
      expect(remove).toBeTruthy();
      await act(async () => {
        fireEvent.mouseDown(remove!);
        fireEvent.click(remove!);
      });
      await waitFor(() =>
        expect(t.getForm().getFieldValue("members")).toEqual(["u1"]),
      );
      expect(screen.queryByText(UNLISTED_ERROR)).toBeNull();
      await t.submit();
      expect(t.onSubmit).toHaveBeenCalledWith({ members: ["u1"] });
    });

    it("allowUnlisted なら、選択肢に無い要素も値そのものの表示で残し、送信できる", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ members: members({ allowUnlisted: true }) }),
        { members: ["u1", "gone"] },
        r.resolvers,
      );
      await r.publish(everyone);
      await expectPills(["利用者 A", "gone"]);
      expect(screen.queryAllByText("（不正な値）")).toHaveLength(0);
      expect(screen.queryByText(UNLISTED_ERROR)).toBeNull();
      await t.submit();
      expect(t.onSubmit).toHaveBeenCalledWith({ members: ["u1", "gone"] });
    });
  });

  describe("同じ購読のまま選択肢が届き直す", () => {
    const withoutU1: Option[] = [{ label: "利用者 B", value: "u2" }];

    it("既定（unlisted: clear）では、外れた要素が消え、選択肢が戻っても戻らない", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ members: members() }),
        { members: ["u1", "u2"] },
        r.resolvers,
      );
      await r.publish(everyone);
      await waitFor(() => expect(pills()).toContain("利用者 A"));

      await r.publish(withoutU1);
      await waitFor(() =>
        expect(t.getForm().getFieldValue("members")).toEqual(["u2"]),
      );
      await r.publish(everyone);
      expect(t.getForm().getFieldValue("members")).toEqual(["u2"]);
      expect(r.subscribeCount).toHaveBeenCalledTimes(1);
    });

    it("unlisted: keep なら、外れると「（不正な値）」とエラーを出し、戻ると元の表示に戻る", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ members: members({ unlisted: "keep" }) }),
        { members: ["u1", "u2"] },
        r.resolvers,
      );
      await r.publish(everyone);
      await waitFor(() => expect(pills()).toContain("利用者 A"));

      await r.publish(withoutU1);
      await expectPills(["（不正な値）", "利用者 B"]);
      expect(screen.getByText(UNLISTED_ERROR)).toBeTruthy();
      expect(t.getForm().getFieldValue("members")).toEqual(["u1", "u2"]);

      await r.publish(everyone);
      await expectPills(["利用者 A", "利用者 B"]);
      expect(screen.queryAllByText("（不正な値）")).toHaveLength(0);
      expect(screen.queryByText(UNLISTED_ERROR)).toBeNull();
      await t.submit();
      expect(t.onSubmit).toHaveBeenCalledWith({ members: ["u1", "u2"] });
      expect(r.subscribeCount).toHaveBeenCalledTimes(1);
    });
  });

  it("選択肢が 0 件なら、欄を無効にして emptyMessage を出す", async () => {
    const r = makeResolvers();
    renderForm(
      z.object({
        members: members({ emptyMessage: "先にチームを選んでください" }),
      }),
      {},
      r.resolvers,
    );
    await r.publish([]);
    const input =
      await screen.findByPlaceholderText("先にチームを選んでください");
    expect((input as HTMLInputElement).disabled).toBe(true);
  });

  it("元の配列の min を引き継ぎ、足りなければ送信を止める", async () => {
    const r = makeResolvers();
    const schema = zf.array(memberKey()).min(2).register(zf.array.registry, {
      label: "メンバーたち",
      uiType: "multipleExternalKey",
    });
    const t = renderForm(
      z.object({ members: schema }),
      { members: ["u1"] },
      r.resolvers,
    );
    await r.publish(everyone);
    await waitFor(() => expect(pills()).toContain("利用者 A"));
    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();
  });

  it("optional の欄は、値が無くても送信できる", async () => {
    const r = makeResolvers();
    const t = renderForm(
      z.object({ members: members().optional() }),
      {},
      r.resolvers,
    );
    await r.publish(everyone);
    await waitFor(() =>
      expect(t.runtime.get("members")?.status).toBe("resolved"),
    );
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledWith({});
  });
});

describe("複数選択の enum（externalKey でない欄）の unlisted", () => {
  beforeEach(() => {
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
  });

  const colors = (unlisted?: "keep" | "clear") =>
    zf
      .array(
        zf
          .enum([
            zf.literal("red").register(zf.literal.registry, { label: "赤" }),
            zf.literal("blue").register(zf.literal.registry, { label: "青" }),
          ])
          .register(zf.enum.registry, { unlisted }),
      )
      .register(zf.array.registry, { label: "色", uiType: "multipleEnum" });

  it("既定では、選択肢に無い保存値を消す", async () => {
    const t = renderForm(
      z.object({ colors: colors() }),
      { colors: ["red", "green"] },
      [],
    );
    await waitFor(() =>
      expect(t.getForm().getFieldValue("colors")).toEqual(["red"]),
    );
    expect(t.getForm().state.isDirty).toBe(false);
  });

  it("keep なら、「（不正な値）」とエラーを出して残す", async () => {
    const t = renderForm(
      z.object({ colors: colors("keep") }),
      { colors: ["red", "green"] },
      [],
    );
    await expectPills(["赤", "（不正な値）"]);
    expect(screen.getByText(UNLISTED_ERROR)).toBeTruthy();
    expect(t.getForm().getFieldValue("colors")).toEqual(["red", "green"]);
  });
});

describe("nullable だけの複数選択を空にする", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const removePill = async (label: string) => {
    const pill = [...document.querySelectorAll(".mantine-Pill-root")].find(
      (element) => element.textContent?.includes(label),
    );
    const remove = pill?.querySelector(".mantine-Pill-remove");
    expect(remove).toBeTruthy();
    await act(async () => {
      fireEvent.mouseDown(remove!);
      fireEvent.click(remove!);
    });
  };

  it("enum の複数選択は、全部外すと null を書き、送信できる", async () => {
    const schema = z.object({
      colors: zf
        .array(
          zf.enum([
            zf.literal("red").register(zf.literal.registry, { label: "赤" }),
            zf.literal("blue").register(zf.literal.registry, { label: "青" }),
          ]),
        )
        .register(zf.array.registry, { label: "色", uiType: "multipleEnum" })
        .nullable(),
    });
    const t = renderForm(schema, { colors: ["red"] }, []);
    await expectPills(["赤"]);

    await removePill("赤");
    await waitFor(() => expect(t.getForm().getFieldValue("colors")).toBeNull());
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledWith({ colors: null });
  });

  it("externalKey の複数選択は、全部外すと null を書き、決まった schema の検証でも止まらない", async () => {
    const r = makeResolvers();
    r.prepare(everyone);
    const t = renderForm(
      z.object({ members: members().nullable() }),
      { members: ["u1"] },
      r.resolvers,
    );
    await expectPills(["利用者 A"]);

    await removePill("利用者 A");
    await waitFor(() =>
      expect(t.getForm().getFieldValue("members")).toBeNull(),
    );
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledWith({ members: null });
  });
});
