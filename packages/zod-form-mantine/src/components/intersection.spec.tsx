// @vitest-environment jsdom
import React, { Suspense } from "react";
import {
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

import { zf } from "@zodapp/zod-form";
import {
  Switch,
  FormProvider,
  ZodFormContextProvider,
  useZodForm,
} from "@zodapp/zod-form-react/common";
import { baseComponents } from "@zodapp/zod-form-mantine-lite/baseComponents";
import { component as ObjectComponent } from "./object";
import { component as StringComponent } from "./string";
import { component as LiteralComponent } from "./literal";
import { component as UnionComponent } from "./union";
import { component as IntersectionComponent } from "./intersection";

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
  ...baseComponents,
  object: () => ({ component: ObjectComponent }),
  string: () => ({ component: StringComponent }),
  literal: () => ({ component: LiteralComponent }),
  union: () => ({ component: UnionComponent }),
  intersection: () => ({ component: IntersectionComponent }),
};

const renderForm = (schema: z.ZodTypeAny, defaultValues: unknown) => {
  const formRef: { current: AnyFormApi | undefined } = { current: undefined };
  const validator = schema as unknown as z.ZodType<
    Record<string, unknown>,
    Record<string, unknown>
  >;
  const FormUnderTest = () => {
    const form = useZodForm({
      defaultValues: defaultValues as Record<string, unknown>,
      validators: {
        onChange: validator,
        onBlur: validator,
        onSubmit: validator,
      },
    });
    formRef.current = form as unknown as AnyFormApi;
    return (
      <MantineProvider>
        <ZodFormContextProvider componentLibrary={componentLibrary}>
          <FormProvider form={form}>
            <Suspense fallback={null}>
              <Switch fieldPath="" schema={schema} />
              <button onClick={() => void form.handleSubmit()}>送信</button>
            </Suspense>
          </FormProvider>
        </ZodFormContextProvider>
      </MantineProvider>
    );
  };
  render(<FormUnderTest />);
  return formRef;
};

const valueOf = (formRef: { current: AnyFormApi | undefined }, key: string) =>
  (formRef.current!.state.values as Record<string, unknown>)[key];

const text = (label: string) =>
  zf.string().register(zf.string.registry, { label });

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "送信" }));

describe("zf.intersection", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupDomMocks();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("両側の欄を同じ path に並べ、入力した値が同じ object に入る", async () => {
    const schema = z.object({
      person: zf
        .intersection(
          zf.object({ name: text("名前") }),
          zf.object({ email: text("メール") }),
        )
        .register(zf.intersection.registry, { label: "人" }),
    });
    const formRef = renderForm(schema, { person: { name: "", email: "" } });
    fireEvent.change(await screen.findByLabelText(/^名前/), {
      target: { value: "太郎" },
    });
    fireEvent.change(screen.getByLabelText(/^メール/), {
      target: { value: "a@example.com" },
    });
    await waitFor(() =>
      expect(valueOf(formRef, "person")).toEqual({
        name: "太郎",
        email: "a@example.com",
      }),
    );
    expect(screen.getByText("人")).toBeTruthy();
  });

  it("intersection 全体の .refine() のエラーを、1 回だけ出す", async () => {
    const schema = z.object({
      pair: zf
        .intersection(
          zf.object({ from: text("開始") }),
          zf.object({ to: text("終了") }),
        )
        .refine((value) => value.from !== value.to, {
          message: "開始と終了を変えてください",
        })
        .register(zf.intersection.registry, { label: "期間" }),
    });
    renderForm(schema, { pair: { from: "a", to: "a" } });
    await screen.findByLabelText(/^開始/);
    submit();
    await waitFor(() =>
      expect(screen.getAllByText("開始と終了を変えてください")).toHaveLength(1),
    );
  });

  it("子の object の .refine() のエラーも、intersection が 1 回だけ出す（子は出さない）", async () => {
    const schema = z.object({
      pair: zf.intersection(
        zf
          .object({ from: text("開始") })
          .refine((value) => value.from !== "x", { message: "x は使えません" })
          .register(zf.object.registry, { label: "左", uiType: "box" }),
        zf
          .object({ to: text("終了") })
          .register(zf.object.registry, { label: "右", uiType: "box" }),
      ),
    });
    renderForm(schema, { pair: { from: "x", to: "y" } });
    await screen.findByLabelText(/^開始/);
    submit();
    await waitFor(() =>
      expect(screen.getAllByText("x は使えません")).toHaveLength(1),
    );
    // 子は box のまま（それぞれの枠と legend を出す）
    expect(document.querySelectorAll("fieldset")).toHaveLength(2);
  });

  it("flat の子は、ラベルも枠も出さず、欄だけを並べる", async () => {
    const schema = z.object({
      person: zf
        .intersection(
          zf
            .object({ name: text("名前") })
            .register(zf.object.registry, { label: "左", uiType: "flat" }),
          zf
            .object({ email: text("メール") })
            .register(zf.object.registry, { label: "右", uiType: "flat" }),
        )
        .register(zf.intersection.registry, { label: "人", uiType: "box" }),
    });
    renderForm(schema, { person: { name: "", email: "" } });
    await screen.findByLabelText(/^名前/);
    expect(screen.queryByText("左")).toBeNull();
    expect(screen.queryByText("右")).toBeNull();
    // 枠は intersection の box だけ
    expect(document.querySelectorAll("fieldset")).toHaveLength(1);
  });

  it("intersection の外の flat の object は、自分のエラーがあるときだけエラーの Alert を出す", async () => {
    const schema = z.object({
      detail: zf
        .object({ code: text("コード") })
        .refine((value) => value.code !== "x", { message: "x は使えません" })
        .register(zf.object.registry, { uiType: "flat" }),
    });
    renderForm(schema, { detail: { code: "x" } });
    await screen.findByLabelText(/^コード/);
    expect(screen.queryByRole("alert")).toBeNull();
    submit();
    await waitFor(() =>
      expect(screen.getAllByText("x は使えません")).toHaveLength(1),
    );
    expect(screen.getByRole("alert").textContent).toContain("x は使えません");
    expect(document.querySelectorAll("fieldset")).toHaveLength(0);
  });

  it("object と discriminatedUnion の intersection で、腕を切り替えても共通の欄の値が残る", async () => {
    const schema = z.object({
      contact: zf.intersection(
        zf
          .object({ name: text("名前") })
          .register(zf.object.registry, { uiType: "flat" }),
        z
          .discriminatedUnion("type", [
            zf
              .object({
                type: zf
                  .literal("phone")
                  .register(zf.literal.registry, { hidden: true }),
                phone: text("電話番号"),
              })
              .register(zf.object.registry, { label: "電話", uiType: "flat" }),
            zf
              .object({
                type: zf
                  .literal("mail")
                  .register(zf.literal.registry, { hidden: true }),
                mail: text("アドレス"),
              })
              .register(zf.object.registry, {
                label: "メール",
                uiType: "flat",
              }),
          ])
          .register(zf.union.registry, {
            label: "連絡先",
            selectorLabel: "種類",
            uiType: "flat",
          }),
      ),
    });
    const formRef = renderForm(schema, {
      contact: { name: "太郎", type: "phone", phone: "090" },
    });
    expect(await screen.findByLabelText(/^電話番号/)).toBeTruthy();
    // union の flat は Fieldset（legend）を出さない
    expect(screen.queryByText("連絡先")).toBeNull();
    const select = document.querySelector(
      "input.mantine-Select-input",
    ) as HTMLInputElement;
    fireEvent.click(select);
    fireEvent.keyDown(select, { key: "ArrowDown" });
    fireEvent.click(
      await screen.findByRole("option", { name: "メール", hidden: true }),
    );
    expect(await screen.findByLabelText(/^アドレス/)).toBeTruthy();
    await waitFor(() =>
      expect(valueOf(formRef, "contact")).toMatchObject({
        name: "太郎",
        type: "mail",
      }),
    );
  });

  it("optional な intersection は＋で値を作り、削除で undefined に戻す", async () => {
    const schema = z.object({
      extra: zf
        .intersection(
          zf.object({ a: text("A") }),
          zf.object({ b: zf.string().default("初期") }),
        )
        .register(zf.intersection.registry, { label: "追加" })
        .optional(),
    });
    const formRef = renderForm(schema, {});
    fireEvent.click(await screen.findByRole("button", { name: "追加" }));
    await waitFor(() =>
      expect(valueOf(formRef, "extra")).toEqual({ b: "初期" }),
    );
    expect(await screen.findByLabelText(/^A/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    await waitFor(() => expect(valueOf(formRef, "extra")).toBeUndefined());
  });

  it("両側の object が同じキーを持つと、開発中に警告する", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const schema = z.object({
      both: zf.intersection(
        zf.object({ name: text("名前") }),
        zf.object({ name: text("名前（右）") }),
      ),
    });
    renderForm(schema, { both: { name: "" } });
    await screen.findByLabelText(/^名前（右）/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("name"));
  });

  describe("同じ欄のエラーの出し分け（errorTokens・hideError）", () => {
    /** 表示されているエラーの文言と、それを囲む fieldset の legend */
    const shownErrors = () =>
      [
        ...document.querySelectorAll(
          ".mantine-InputWrapper-error, .mantine-Select-error, [role=alert]",
        ),
      ].map(
        (element) =>
          `${element.textContent}@${element.closest("fieldset")?.querySelector("legend")?.textContent ?? "-"}`,
      );
    const wait = () => new Promise((resolve) => setTimeout(resolve, 300));

    const phoneArm = (refine: boolean) => {
      const arm = zf.object({
        type: zf
          .literal("phone")
          .register(zf.literal.registry, { hidden: true }),
        phone: text("電話番号"),
      });
      return (
        refine
          ? arm.refine((v) => v.phone.length >= 10, { message: "10 桁以上" })
          : arm
      ).register(zf.object.registry, { label: "電話", uiType: "box" });
    };
    const mailArm = () =>
      z
        .strictObject({
          type: zf
            .literal("mail")
            .register(zf.literal.registry, { hidden: true }),
          mail: text("アドレス"),
        })
        .register(zf.object.registry, { label: "メール", uiType: "box" });

    it("z.union の腕の、path を指定しない refine も、intersection に 1 回だけ出す", async () => {
      const contact = z
        .union([
          zf
            .object({ phone: text("電話番号") })
            .refine((v) => v.phone.length >= 10, { message: "10 桁以上" })
            .register(zf.object.registry, { label: "電話", uiType: "box" }),
          zf
            .object({ mail: text("アドレス") })
            .register(zf.object.registry, { label: "メール", uiType: "box" }),
        ])
        .register(zf.union.registry, {
          label: "連絡先",
          selectorLabel: "種類",
        });
      const schema = z.object({
        contact: zf
          .intersection(zf.object({ name: text("名前") }), contact)
          .register(zf.intersection.registry, { label: "全体", uiType: "box" }),
      });
      renderForm(schema, { contact: { name: "a", phone: "0901234567" } });
      fireEvent.change(await screen.findByLabelText(/^電話番号/), {
        target: { value: "090" },
      });
      submit();
      await wait();
      expect(shownErrors().filter((e) => e.startsWith("10 桁以上"))).toEqual([
        "10 桁以上@全体",
      ]);
    });

    it("discriminatedUnion の腕の、path を指定しない refine は、intersection に 1 回だけ出す", async () => {
      const schema = z.object({
        contact: zf
          .intersection(
            zf.object({ name: text("名前") }),
            z
              .discriminatedUnion("type", [phoneArm(true), mailArm()])
              .register(zf.union.registry, {
                label: "連絡先",
                selectorLabel: "種類",
              }),
          )
          .register(zf.intersection.registry, { label: "全体", uiType: "box" }),
      });
      renderForm(schema, {
        contact: { name: "a", type: "phone", phone: "090" },
      });
      await screen.findByLabelText(/^電話番号/);
      submit();
      await wait();
      expect(shownErrors().filter((e) => e.startsWith("10 桁以上"))).toEqual([
        "10 桁以上@全体",
      ]);
    });

    for (const kind of ["discriminatedUnion", "union"] as const) {
      it(`値が空のとき、${kind} は「選択してください」を intersection のエラーに重ねない`, async () => {
        const union =
          kind === "discriminatedUnion"
            ? z.discriminatedUnion("type", [phoneArm(false), mailArm()])
            : z.union([phoneArm(false), mailArm()]);
        const schema = z.object({
          contact: zf
            .intersection(
              zf.object({ name: text("名前") }),
              union.register(zf.union.registry, {
                label: "連絡先",
                selectorLabel: "種類",
              }),
            )
            .register(zf.intersection.registry, {
              label: "全体",
              uiType: "box",
            }),
        });
        renderForm(schema, {});
        await screen.findByText("種類");
        submit();
        await wait();
        const shown = shownErrors();
        expect(shown.some((e) => e.startsWith("選択してください"))).toBe(false);
        expect(shown.filter((e) => e.endsWith("@全体"))).toHaveLength(1);
      });
    }

    it("値はあるがどの腕にも合わないときは、hideError でも「選択してください」を出す", async () => {
      const schema = z.object({
        contact: zf
          .intersection(
            zf.object({ name: text("名前") }),
            z
              .union([
                zf
                  .object({ phone: zf.string().min(10) })
                  .register(zf.object.registry, { label: "電話" }),
                zf
                  .object({ mail: z.email() })
                  .register(zf.object.registry, { label: "メール" }),
              ])
              .register(zf.union.registry, {
                label: "連絡先",
                selectorLabel: "種類",
              }),
          )
          .register(zf.intersection.registry, { label: "全体", uiType: "box" }),
      });
      renderForm(schema, { contact: { name: "a" } });
      await screen.findByText("種類");
      submit();
      await wait();
      expect(
        shownErrors().filter((e) => e.startsWith("選択してください")),
      ).toHaveLength(1);
    });

    it("入れ子の union の refine は、内側の union の腕が出す", async () => {
      const inner = z
        .union([zf.string().register(zf.string.registry, { label: "文字" })])
        .refine((v) => v !== "x", { message: "x は使えません" })
        .register(zf.union.registry, {
          label: "内",
          selectorLabel: "内の種類",
        });
      const outer = z.union([inner]).register(zf.union.registry, {
        label: "外",
        selectorLabel: "外の種類",
      });
      renderForm(z.object({ value: outer }), { value: "a" });
      fireEvent.change(await screen.findByRole("textbox"), {
        target: { value: "x" },
      });
      submit();
      await wait();
      expect(
        shownErrors().filter((e) => e.startsWith("x は使えません")),
      ).toHaveLength(1);
    });

    const memberUnion = () =>
      z
        .discriminatedUnion("plan", [
          z
            .strictObject({
              plan: zf
                .literal("free")
                .register(zf.literal.registry, { hidden: true }),
            })
            .register(zf.object.registry, { label: "無料" }),
          z
            .strictObject({
              plan: zf
                .literal("paid")
                .register(zf.literal.registry, { hidden: true }),
              card: text("カード"),
            })
            .register(zf.object.registry, { label: "有料" }),
        ])
        .register(zf.union.registry, {
          label: "会員",
          selectorLabel: "会員タイプ",
        });
    const contactUnion = () =>
      z
        .discriminatedUnion("type", [
          z
            .strictObject({
              type: zf
                .literal("phone")
                .register(zf.literal.registry, { hidden: true }),
              phone: text("電話番号"),
            })
            .register(zf.object.registry, { label: "電話" }),
          mailArm(),
        ])
        .register(zf.union.registry, {
          label: "連絡",
          selectorLabel: "連絡方法",
        });

    it("intersection の unrecognized_keys は、キーを腕に持つ union の名前で選択を促す", async () => {
      const schema = z.object({
        both: zf
          .intersection(contactUnion(), memberUnion())
          .register(zf.intersection.registry, { label: "全体", uiType: "box" }),
      });
      renderForm(schema, {
        both: {
          type: "mail",
          mail: "a",
          plan: "free",
          phone: "090",
          card: "1",
        },
      });
      await screen.findByLabelText(/^アドレス/);
      submit();
      await wait();
      expect(shownErrors()).toContain(
        "連絡方法と会員タイプを選択してください@全体",
      );
    });

    it("discriminatedUnion 単体の unrecognized_keys は、腕を選ぶ欄に出す（腕には出さない）", async () => {
      renderForm(z.object({ contact: contactUnion() }), {
        contact: { type: "mail", mail: "a", phone: "090" },
      });
      await screen.findByLabelText(/^アドレス/);
      submit();
      await wait();
      expect(shownErrors().map((e) => e.split("@")[0])).toEqual([
        "連絡方法を選択してください",
      ]);
    });

    it("どの腕にも無いキーは、issue のメッセージをそのまま出す", async () => {
      renderForm(z.object({ contact: contactUnion() }), {
        contact: { type: "mail", mail: "a", fax: "1" },
      });
      await screen.findByLabelText(/^アドレス/);
      submit();
      await wait();
      const shown = shownErrors().map((e) => e.split("@")[0]);
      expect(shown).toHaveLength(1);
      expect(shown[0]).toContain("fax");
    });
  });
});
