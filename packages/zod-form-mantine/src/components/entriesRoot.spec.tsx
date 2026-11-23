// @vitest-environment jsdom
/**
 * entries（object・record・partialRecord）をフォームの最外側（fieldPath === ""）に置いたとき、
 * フォーム全体の値を読み書きする（欄の名前が空なので、欄を通すと値が読めず、`""` のキーに書いてしまう）
 */
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { renderForm, setupDomMocks, SUBMIT_LABEL } from "../testing/renderForm";

const ready = () => screen.findByRole("button", { name: SUBMIT_LABEL });

const text = (label: string) =>
  zf.string().register(zf.string.registry, { label });

const openSelect = (name: RegExp) => {
  const input = screen.getByRole("combobox", { name });
  fireEvent.click(input);
  fireEvent.keyDown(input, { key: "ArrowDown" });
};

const optionTexts = async () =>
  (await screen.findAllByRole("option", { hidden: true })).map(
    (option) => option.textContent,
  );

describe("最外側の entries", () => {
  beforeEach(() => {
    setupDomMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("object", () => {
    const ADD = /項目を追加|Add a field/;
    const schema = zf
      .object({
        keyword: text("キーワード"),
        title: text("タイトル").optional(),
        author: text("著者").optional(),
      })
      .register(zf.object.registry, { label: "検索条件", uiType: "entries" });

    it("保存してある optional の項目を行にし、値を出す。候補はまだ無い項目だけ", async () => {
      renderForm(schema, { keyword: "k", title: "saved" });
      await ready();
      expect(screen.getByDisplayValue("k")).toBeTruthy();
      expect(screen.getByDisplayValue("saved")).toBeTruthy();
      openSelect(ADD);
      expect(await optionTexts()).toEqual(["著者"]);
    });

    it('足す・消すと、フォーム全体の値が変わる（`""` のキーを作らない）。送信にも出る', async () => {
      const { values, submit, onSubmit } = renderForm(schema, {
        keyword: "k",
        title: "saved",
      });
      await ready();
      openSelect(ADD);
      fireEvent.click(
        await screen.findByRole("option", { name: "著者", hidden: true }),
      );
      await waitFor(() => expect("author" in values()).toBe(true));
      expect("" in values()).toBe(false);
      fireEvent.change(
        screen
          .getByRole("group", { name: "著者" })
          .querySelector("input") as HTMLInputElement,
        { target: { value: "a" } },
      );
      fireEvent.click(
        screen.getByRole("button", { name: /タイトルを削除|Remove タイトル/ }),
      );
      await waitFor(() =>
        expect(values()).toEqual({ keyword: "k", author: "a" }),
      );
      submit();
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({ keyword: "k", author: "a" }),
      );
    });

    it("足す・消すと、フォームを変えた（isDirty）・触った（isTouched）扱いになる", async () => {
      const { formRef } = renderForm(schema, { keyword: "k", title: "saved" });
      await ready();
      expect(formRef.current!.state.isDirty).toBe(false);
      fireEvent.click(
        screen.getByRole("button", { name: /タイトルを削除|Remove タイトル/ }),
      );
      await waitFor(() => expect(formRef.current!.state.isDirty).toBe(true));
      expect(formRef.current!.state.isTouched).toBe(true);
    });
  });

  describe("partialRecord", () => {
    const ADD = /キーを追加|Add a key/;
    const people = zf.enum([
      zf.literal("alice").register(zf.literal.registry, { label: "アリス" }),
      zf.literal("bob").register(zf.literal.registry, { label: "ボブ" }),
    ]);
    const schema = z
      .partialRecord(people, z.string().default("x"))
      .register(zf.record.registry, { label: "あだ名", uiType: "entries" });

    it("保存してあるキーを行にし、値を出す。足す・消すとフォーム全体の値が変わる", async () => {
      const { values } = renderForm(schema, { alice: "アリー" });
      await ready();
      expect(screen.getByDisplayValue("アリー")).toBeTruthy();
      openSelect(ADD);
      expect(await optionTexts()).toEqual(["ボブ"]);
      fireEvent.click(
        await screen.findByRole("option", { name: "ボブ", hidden: true }),
      );
      await waitFor(() =>
        expect(values()).toEqual({ alice: "アリー", bob: "x" }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: /アリスを削除|Remove アリス/ }),
      );
      await waitFor(() => expect(values()).toEqual({ bob: "x" }));
    });
  });

  describe("record", () => {
    const schema = z
      .record(z.string(), z.string())
      .register(zf.record.registry, { label: "スロット", uiType: "entries" });

    it("保存してある組を行にし、値を出す。消すとフォーム全体の値が変わる", async () => {
      const { values } = renderForm(schema, { a: "1", b: "2" });
      await ready();
      expect(screen.getByDisplayValue("1")).toBeTruthy();
      expect(screen.getByDisplayValue("2")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: /aを削除|Remove a/ }));
      await waitFor(() => expect(values()).toEqual({ b: "2" }));
    });
  });
});
