// @vitest-environment jsdom
import { I18nMessagesProvider } from "@zodapp/i18n-messages-react";
import { ja as jaMessages } from "../messages";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MantineProvider } from "@mantine/core";
import type { AnyFormApi } from "@tanstack/react-form";
import { z } from "zod";

import {
  zf,
  defineDynamicMeta,
  type ExternalKeyUnlistedOptions,
} from "@zodapp/zod-form";
import type { ExternalKeyResolvers } from "@zodapp/zod-form/externalKey/types";
import {
  Switch,
  FormProvider,
  FormRuntime,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import { OptionalComponent } from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as DynamicComponent } from "./dynamic";
import { component as EnumComponent } from "./enum";
import { component as ExternalKeyComponent } from "./externalKey";
import { component as ObjectComponent } from "./object";
import { component as StringComponent } from "./string";
import { component as StringSelectComponent } from "./string_select";

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
  object: () => ({ component: ObjectComponent }),
  string: () => ({ component: StringComponent }),
  string_select: () => ({ component: StringSelectComponent }),
  enum: () => ({ component: EnumComponent }),
  externalKey: () => ({ component: ExternalKeyComponent }),
  dynamic: () => ({ component: DynamicComponent }),
};

type Option = { label: string; value: string };

/** 選択肢をテストから流せる resolver */
const makeResolvers = () => {
  const listeners = new Map<string, Set<(options: Option[]) => void>>();
  const errorListeners = new Map<string, Set<(error: unknown) => void>>();
  const latest = new Map<string, Option[]>();
  const subscribeCount = vi.fn();
  const resolvers: ExternalKeyResolvers = [
    {
      type: "list",
      resolver: (config: { type: string; list: string }) => ({
        subscribe: (
          callback: (options: Option[]) => void,
          onError?: (error: unknown) => void,
        ) => {
          subscribeCount(config.list);
          const set = listeners.get(config.list) ?? new Set();
          set.add(callback);
          listeners.set(config.list, set);
          const errors = errorListeners.get(config.list) ?? new Set();
          if (onError) errors.add(onError);
          errorListeners.set(config.list, errors);
          const options = latest.get(config.list);
          if (options) callback(options);
          return () => {
            set.delete(callback);
            if (onError) errors.delete(onError);
          };
        },
      }),
    },
    {
      // 関数で絞り込む resolver（config の違いが関数だけになる例）
      type: "picked",
      resolver: (config: {
        type: string;
        list: string;
        pick: (option: Option) => boolean;
      }) => ({
        subscribe: (callback: (options: Option[]) => void) => {
          subscribeCount(config.list);
          const filtered = (options: Option[]) =>
            callback(options.filter(config.pick));
          const set = listeners.get(config.list) ?? new Set();
          set.add(filtered);
          listeners.set(config.list, set);
          const options = latest.get(config.list);
          if (options) filtered(options);
          return () => set.delete(filtered);
        },
      }),
    },
  ];
  const publish = async (list: string, options: Option[]) => {
    latest.set(list, options);
    await act(async () => {
      listeners.get(list)?.forEach((callback) => callback(options));
    });
  };
  /** 購読中の欄に、取得の失敗を届ける */
  const fail = async (list: string, error: unknown) => {
    await act(async () => {
      errorListeners.get(list)?.forEach((onError) => onError(error));
    });
  };
  /** 購読中の欄には届けず、次に購読した欄にその場で届く選択肢を用意する */
  const prepare = (list: string, options: Option[]) => {
    latest.set(list, options);
  };
  return { resolvers, publish, prepare, fail, subscribeCount };
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
        <I18nMessagesProvider locale="ja" messages={jaMessages}>
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
        </I18nMessagesProvider>
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
  const edit = async (path: string, value: unknown) => {
    await act(async () => {
      runtime.runAsUserEdit(() =>
        getForm().setFieldValue(path, value as never),
      );
    });
  };
  return { getForm, runtime, onSubmit, submit, edit };
};

const owner = (options: ExternalKeyUnlistedOptions = {}) =>
  zf.string().register(zf.externalKey.registry, {
    label: "担当者",
    externalKeyConfig: { type: "list", list: "members" },
    ...options,
  });

describe("externalKey（dynamic + ラッパー）", () => {
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
      z.object({ owner: owner() }),
      { owner: "u1" },
      r.resolvers,
    );
    await waitFor(() =>
      expect(
        document.querySelector('[data-dynamic-status="loading"]'),
      ).toBeTruthy(),
    );
    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();

    await r.publish("members", [
      { label: "山田", value: "u1" },
      { label: "佐藤", value: "u2" },
    ]);
    expect(await screen.findByDisplayValue("山田")).toBeTruthy();
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledWith({ owner: "u1" });
  });

  it("外側の .refine() のエラーが、externalKey の欄に出て送信が止まる", async () => {
    const r = makeResolvers();
    const t = renderForm(
      z.object({
        owner: owner().refine((v) => v !== "u2", "佐藤さんは選べません"),
      }),
      { owner: "u2" },
      r.resolvers,
    );
    await r.publish("members", [
      { label: "山田", value: "u1" },
      { label: "佐藤", value: "u2" },
    ]);
    await waitFor(() =>
      expect(t.runtime.get("owner")?.status).toBe("resolved"),
    );
    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();
  });

  it("既定（unlisted: clear）では、選択肢に無い保存値を消す", async () => {
    const r = makeResolvers();
    const t = renderForm(
      z.object({ owner: owner() }),
      { owner: "gone" },
      r.resolvers,
    );
    await r.publish("members", [{ label: "山田", value: "u1" }]);
    await waitFor(() =>
      expect(t.getForm().getFieldValue("owner")).toBeUndefined(),
    );
  });

  it("unlisted: keep なら、選択肢に無い保存値を残し、「（不正な値）」と出して送信を止める", async () => {
    const r = makeResolvers();
    const t = renderForm(
      z.object({ owner: owner({ unlisted: "keep" }) }),
      { owner: "gone" },
      r.resolvers,
    );
    await r.publish("members", [{ label: "山田", value: "u1" }]);
    await waitFor(() =>
      expect(t.runtime.get("owner")?.status).toBe("resolved"),
    );
    await screen.findByDisplayValue("（不正な値）");
    expect(
      screen.getByText("選択肢に無い値です。選び直してください。"),
    ).toBeTruthy();
    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();
    expect(t.getForm().getFieldValue("owner")).toBe("gone");
  });

  it("allowUnlisted なら、選択肢に無い値も通す", async () => {
    const r = makeResolvers();
    const t = renderForm(
      z.object({ owner: owner({ allowUnlisted: true }) }),
      { owner: "gone" },
      r.resolvers,
    );
    await r.publish("members", [{ label: "山田", value: "u1" }]);
    await waitFor(() =>
      expect(t.runtime.get("owner")?.status).toBe("resolved"),
    );
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledWith({ owner: "gone" });
  });

  const emptyOwner = () =>
    zf.string().register(zf.externalKey.registry, {
      label: "担当者",
      externalKeyConfig: { type: "list", list: "members" },
      emptyMessage: "先にチームを選んでください",
    });

  it("必須の欄で選択肢が0件なら、欄を無効にし、emptyMessage を欄のエラーにする（送信すると出る）", async () => {
    const r = makeResolvers();
    const t = renderForm(z.object({ owner: emptyOwner() }), {}, r.resolvers);
    await r.publish("members", []);
    const input =
      await screen.findByPlaceholderText("先にチームを選んでください");
    expect((input as HTMLInputElement).disabled).toBe(true);
    // 触る前・送信する前は、ほかの必須の欄と同じく出さない
    expect(screen.queryByText("先にチームを選んでください")).toBeNull();

    await t.submit();
    expect(t.onSubmit).not.toHaveBeenCalled();
    // フォームのエラーは、必須のエラーではなく emptyMessage
    const errors = t.getForm().getAllErrors().fields.owner?.errors ?? [];
    expect(
      errors.map((error: any) => error?.message ?? String(error)),
    ).toContain("先にチームを選んでください");
    expect(await screen.findByText("先にチームを選んでください")).toBeTruthy();
    expect(screen.queryByText(/Invalid input|必ず入力してください/)).toBeNull();
  });

  it("optional の欄で選択肢が0件なら、無効にして emptyMessage を出すだけで、エラーにしない", async () => {
    const r = makeResolvers();
    const t = renderForm(
      z.object({ owner: emptyOwner().optional() }),
      {},
      r.resolvers,
    );
    await r.publish("members", []);
    const input =
      await screen.findByPlaceholderText("先にチームを選んでください");
    expect((input as HTMLInputElement).disabled).toBe(true);
    await t.submit();
    expect(t.onSubmit).toHaveBeenCalledWith({});
    expect(screen.queryByText("先にチームを選んでください")).toBeNull();
  });

  it("選択肢だけが更新されても購読を張り直さない。unlisted: keep なら値を消さない", async () => {
    const r = makeResolvers();
    const t = renderForm(
      z.object({ owner: owner({ unlisted: "keep" }) }),
      { owner: "u1" },
      r.resolvers,
    );
    await r.publish("members", [{ label: "山田", value: "u1" }]);
    await screen.findByDisplayValue("山田");
    await r.publish("members", [{ label: "佐藤", value: "u2" }]);
    expect(t.getForm().getFieldValue("owner")).toBe("u1");
    expect(r.subscribeCount).toHaveBeenCalledTimes(1);
  });

  describe("clear で消しても、欄を「触った」「変えた」にしない", () => {
    // このテストでは日本語のエラーマップを入れないので、値が無いときは zod の既定の文言になる
    const REQUIRED = /Invalid input|必ず入力してください/;

    it("開いたときに選択肢に無い保存値を消しても、isDirty は false のまま、必須のエラーも出さない", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ owner: owner() }),
        { owner: "gone" },
        r.resolvers,
      );
      await r.publish("members", [{ label: "利用者 A", value: "u1" }]);
      await waitFor(() =>
        expect(t.getForm().getFieldValue("owner")).toBeUndefined(),
      );
      expect(t.getForm().state.isDirty).toBe(false);
      expect(t.getForm().getFieldMeta("owner")?.isTouched).toBe(false);
      expect(screen.queryByText(REQUIRED)).toBeNull();

      // 送信すると、ほかの必須の欄と同じくエラーが出る
      await t.submit();
      expect(t.onSubmit).not.toHaveBeenCalled();
      expect(await screen.findByText(REQUIRED)).toBeTruthy();
    });

    it("同じ購読のまま選択肢から外れて消えても、触る前は必須のエラーを出さない", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ owner: owner() }),
        { owner: "u1" },
        r.resolvers,
      );
      await r.publish("members", [{ label: "利用者 A", value: "u1" }]);
      await screen.findByDisplayValue("利用者 A");
      await r.publish("members", [{ label: "利用者 B", value: "u2" }]);
      await waitFor(() =>
        expect(t.getForm().getFieldValue("owner")).toBeUndefined(),
      );
      expect(t.getForm().state.isDirty).toBe(false);
      expect(screen.queryByText(REQUIRED)).toBeNull();
    });

    it("利用者が上の欄を変えて下の欄が消えたときは、上の欄の編集で isDirty が true になる", async () => {
      const r = makeResolvers();
      const member = z.string().register(
        zf.dynamic.registry,
        defineDynamicMeta<unknown, { team?: string }>({
          dependsOnValue: false,
          dependsOnParent: true,
          resolve: ({ parent }) => ({
            key: parent?.team ?? "",
            schema: zf.string().register(zf.externalKey.registry, {
              label: "メンバー",
              externalKeyConfig: { type: "list", list: parent?.team ?? "" },
            }),
          }),
        }),
      );
      const t = renderForm(
        z.object({ team: z.string(), member }),
        { team: "a", member: "x" },
        r.resolvers,
      );
      await r.publish("a", [{ label: "X", value: "x" }]);
      await screen.findByDisplayValue("X");
      expect(t.getForm().state.isDirty).toBe(false);

      await t.edit("team", "b");
      await r.publish("b", [{ label: "Y", value: "y" }]);
      await waitFor(() =>
        expect(t.getForm().getFieldValue("member")).toBeUndefined(),
      );
      expect(t.getForm().state.isDirty).toBe(true);
      expect(t.getForm().getFieldMeta("member")?.isTouched).toBe(false);
    });
  });

  describe("取得の失敗（resolver の onError）", () => {
    const everyone: Option[] = [
      { label: "利用者 A", value: "u1" },
      { label: "利用者 B", value: "u2" },
    ];

    it("onError で error になり、再試行が出て送信が止まる。値は消さない", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ owner: owner() }),
        { owner: "u1" },
        r.resolvers,
      );
      await r.publish("members", everyone);
      await screen.findByDisplayValue("利用者 A");

      await r.fail("members", new Error("取得に失敗しました"));
      await waitFor(() => expect(t.runtime.get("owner")?.status).toBe("error"));
      expect(
        document.querySelector('[data-dynamic-status="error"]'),
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: "再試行" })).toBeTruthy();
      await t.submit();
      expect(t.onSubmit).not.toHaveBeenCalled();
      expect(t.getForm().getFieldValue("owner")).toBe("u1");
    });

    it("同じ購読のまま選択肢が届けば、再試行を押さなくても戻る", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ owner: owner() }),
        { owner: "u1" },
        r.resolvers,
      );
      await r.fail("members", new Error("取得に失敗しました"));
      await waitFor(() => expect(t.runtime.get("owner")?.status).toBe("error"));
      await r.publish("members", everyone);
      await screen.findByDisplayValue("利用者 A");
      expect(t.runtime.get("owner")?.status).toBe("resolved");
      await t.submit();
      expect(t.onSubmit).toHaveBeenCalledWith({ owner: "u1" });
      expect(r.subscribeCount).toHaveBeenCalledTimes(1);
    });

    it("再試行を押すと、購読をやめて最初からやり直す", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ owner: owner() }),
        { owner: "u1" },
        r.resolvers,
      );
      await r.fail("members", new Error("取得に失敗しました"));
      await screen.findByRole("button", { name: "再試行" });
      // 失敗のあいだに選択肢を用意しておくと、やり直した購読にその場で届く
      r.prepare("members", everyone);
      await act(async () => {
        screen.getByRole("button", { name: "再試行" }).click();
      });
      await screen.findByDisplayValue("利用者 A");
      expect(r.subscribeCount).toHaveBeenCalledTimes(2);
      expect(t.getForm().getFieldValue("owner")).toBe("u1");
    });
  });

  describe("同じ購読のまま選択肢が届き直す", () => {
    const everyone: Option[] = [
      { label: "山田", value: "u1" },
      { label: "佐藤", value: "u2" },
    ];
    const withoutU1: Option[] = [{ label: "佐藤", value: "u2" }];

    it("既定（unlisted: clear）では、値が選択肢から外れると消え、選択肢が戻っても値は戻らない", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ owner: owner() }),
        { owner: "u1" },
        r.resolvers,
      );
      await r.publish("members", everyone);
      await screen.findByDisplayValue("山田");

      await r.publish("members", withoutU1);
      await waitFor(() =>
        expect(t.getForm().getFieldValue("owner")).toBeUndefined(),
      );

      await r.publish("members", everyone);
      expect(t.getForm().getFieldValue("owner")).toBeUndefined();
      expect(screen.queryByDisplayValue("山田")).toBeNull();
      expect(r.subscribeCount).toHaveBeenCalledTimes(1);
    });

    it("unlisted: keep なら、外れると「（不正な値）」とエラーを出し、選択肢が戻ると元の表示に戻ってエラーも消える", async () => {
      const r = makeResolvers();
      const t = renderForm(
        z.object({ owner: owner({ unlisted: "keep" }) }),
        { owner: "u1" },
        r.resolvers,
      );
      await r.publish("members", everyone);
      await screen.findByDisplayValue("山田");

      await r.publish("members", withoutU1);
      await screen.findByDisplayValue("（不正な値）");
      expect(
        screen.getByText("選択肢に無い値です。選び直してください。"),
      ).toBeTruthy();
      expect(t.getForm().getFieldValue("owner")).toBe("u1");

      await r.publish("members", everyone);
      await screen.findByDisplayValue("山田");
      await waitFor(() =>
        expect(
          screen.queryByText("選択肢に無い値です。選び直してください。"),
        ).toBeNull(),
      );
      expect(t.getForm().getFieldValue("owner")).toBe("u1");
      await t.submit();
      expect(t.onSubmit).toHaveBeenCalledWith({ owner: "u1" });
      expect(r.subscribeCount).toHaveBeenCalledTimes(1);
    });
  });

  it("dynamic で包んで親の値で config を変えると、利用者の編集なら新しい選択肢に無い値を消す", async () => {
    const r = makeResolvers();
    const member = z.string().register(
      zf.dynamic.registry,
      defineDynamicMeta<unknown, { team?: string }>({
        dependsOnValue: false,
        dependsOnParent: true,
        resolve: ({ parent }) => ({
          key: parent?.team ?? "",
          schema: zf.string().register(zf.externalKey.registry, {
            label: "メンバー",
            externalKeyConfig: { type: "list", list: parent?.team ?? "" },
          }),
        }),
      }),
    );
    const schema = z.object({ team: z.string(), member });
    const t = renderForm(schema, { team: "a", member: "x" }, r.resolvers);
    await r.publish("a", [{ label: "X", value: "x" }]);
    await screen.findByDisplayValue("X");

    await t.edit("team", "b");
    expect(t.getForm().getFieldValue("member")).toBe("x");
    await r.publish("b", [{ label: "Y", value: "y" }]);
    await waitFor(() =>
      expect(t.getForm().getFieldValue("member")).toBeUndefined(),
    );
  });

  describe("config の key", () => {
    const options: Option[] = [
      { label: "X", value: "x" },
      { label: "Y", value: "y" },
    ];
    // 親の値で絞り込みの関数だけを差し替える
    const memberSchema = (withKey: boolean) =>
      z.string().register(
        zf.dynamic.registry,
        defineDynamicMeta<unknown, { team?: string }>({
          dependsOnValue: false,
          dependsOnParent: true,
          resolve: ({ parent }) => {
            const team = parent?.team ?? "";
            return {
              key: team,
              schema: zf.string().register(zf.externalKey.registry, {
                label: "メンバー",
                externalKeyConfig: {
                  type: "picked",
                  list: "all",
                  pick: (option: Option) => option.value === team,
                  ...(withKey ? { key: team } : {}),
                },
              }),
            };
          },
        }),
      );

    it("関数だけが違う config は、key を書けば別の config として取り直し、選択肢に無い値を消す", async () => {
      const r = makeResolvers();
      await r.publish("all", options);
      const schema = z.object({ team: z.string(), member: memberSchema(true) });
      const t = renderForm(schema, { team: "x", member: "x" }, r.resolvers);
      await screen.findByDisplayValue("X");

      await t.edit("team", "y");
      await waitFor(() =>
        expect(t.getForm().getFieldValue("member")).toBeUndefined(),
      );
      expect(r.subscribeCount).toHaveBeenCalledTimes(2);
    });

    it("key を書かないと、関数だけが違う config は同じ config とみなして取り直さない", async () => {
      const r = makeResolvers();
      await r.publish("all", options);
      const schema = z.object({
        team: z.string(),
        member: memberSchema(false),
      });
      const t = renderForm(schema, { team: "x", member: "x" }, r.resolvers);
      await screen.findByDisplayValue("X");

      await t.edit("team", "y");
      await waitFor(() =>
        expect(t.runtime.get("member")?.status).toBe("resolved"),
      );
      expect(t.getForm().getFieldValue("member")).toBe("x");
      expect(r.subscribeCount).toHaveBeenCalledTimes(1);
    });
  });
});
