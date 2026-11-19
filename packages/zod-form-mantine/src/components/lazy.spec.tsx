// @vitest-environment jsdom
/**
 * optional の付かない再帰（z.lazy）を、lazy の入れ子の数で止める。
 * 値が無ければ中を描かない部品（optional・nullable・array・record の entries・Map・union）を通ったら数え直す
 */
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { renderForm, setupDomMocks } from "../testing/renderForm";

const NOTICE =
  "This form cannot show deeper levels. Raise maxDepth in the schema meta to show more.";

const notices = () =>
  document.querySelectorAll("[data-zod-form-unsupported]").length;

describe("z.lazy の再帰の上限", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    setupDomMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("自分を参照する lazy は、上限（10）で止まり、注記を出す", async () => {
    type Node = { name?: string; child: Node };
    const node: z.ZodType<Node> = z.lazy(() =>
      z.object({ name: z.string().optional(), child: node }),
    );
    renderForm(z.object({ root: node }), { root: {} });
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    expect(notices()).toBe(1);
    // name の欄は、上限までの 10 段ぶん描かれる
    expect(document.querySelectorAll("input").length).toBe(10);
    expect(
      consoleError.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes("nested more than 10 levels"),
      ),
    ).toBe(true);
  });

  it("関数で階層ごとに schema を作る書き方も、上限で止まる", async () => {
    const node = (): z.ZodTypeAny => z.object({ child: z.lazy(() => node()) });
    renderForm(node(), {});
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    expect(notices()).toBe(1);
  });

  it("関数の中で決まった階層で止まる書き方は、上限より前に終わるので止めない", async () => {
    const node = (level: number): z.ZodTypeAny =>
      level === 0
        ? z.string().register(zf.string.registry, { label: "葉" })
        : z.object({ child: z.lazy(() => node(level - 1)) });
    renderForm(node(3), {});
    expect(await screen.findByLabelText(/^葉/)).toBeTruthy();
    expect(notices()).toBe(0);
  });

  it("optional な再帰の木は、値のある所まで今までどおり描く", async () => {
    type Tree = { name: string; child?: Tree };
    const tree: z.ZodType<Tree> = z.lazy(() =>
      z.object({ name: z.string(), child: tree.optional() }),
    );
    renderForm(z.object({ root: tree }), {
      root: { name: "a", child: { name: "b", child: { name: "c" } } },
    });
    expect(await screen.findByDisplayValue("c")).toBeTruthy();
    expect(notices()).toBe(0);
  });

  it("maxDepth で上限を変えられる。上限の先の値は消さない", async () => {
    type Node = { name?: string; child: Node };
    const node: z.ZodType<Node> = z.lazy(() =>
      z.object({ name: z.string().optional(), child: node }),
    );
    const limited = node.register(zf.common.registry, { maxDepth: 2 });
    const value = {
      root: { name: "a", child: { name: "b", child: { name: "c" } } },
    };
    const { values } = renderForm(z.object({ root: limited }), value);
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    expect(screen.getByDisplayValue("b")).toBeTruthy();
    expect(screen.queryByDisplayValue("c")).toBeNull();
    await waitFor(() => expect(values()).toEqual(value));
  });

  it("optional な再帰は、maxDepth より深い値でも注記を出さずに全部描く", async () => {
    type Tree = { name: string; child?: Tree };
    const tree: z.ZodType<Tree> = z.lazy(() =>
      z.object({ name: z.string(), child: tree.optional() }),
    );
    const limited = tree.register(zf.common.registry, { maxDepth: 2 });
    renderForm(z.object({ root: limited }), {
      root: {
        name: "a",
        child: { name: "b", child: { name: "c", child: { name: "d" } } },
      },
    });
    expect(await screen.findByDisplayValue("d")).toBeTruthy();
    expect(notices()).toBe(0);
  });

  it("配列を通る再帰も、値のある所まで注記を出さずに描く", async () => {
    type Tree = { name: string; children: Tree[] };
    const tree: z.ZodType<Tree> = z.lazy(() =>
      z.object({ name: z.string(), children: z.array(tree) }),
    );
    const limited = tree.register(zf.common.registry, { maxDepth: 2 });
    const leaf = (name: string): Tree => ({ name, children: [] });
    renderForm(z.object({ root: limited }), {
      root: {
        name: "a",
        children: [
          { name: "b", children: [{ name: "c", children: [leaf("d")] }] },
        ],
      },
    });
    expect(await screen.findByDisplayValue("d")).toBeTruthy();
    expect(notices()).toBe(0);
  });

  it("optional を通ったあとの optional なしの再帰は、そこから数え直して上限で止める", async () => {
    type Node = { child: Node };
    const node: z.ZodType<Node> = z.lazy(() => z.object({ child: node }));
    const limited = node.register(zf.common.registry, { maxDepth: 3 });
    type Tree = { name: string; child?: Tree; loop?: Node };
    const tree: z.ZodType<Tree> = z.lazy(() =>
      z.object({
        name: z.string(),
        child: tree.optional(),
        loop: limited.optional(),
      }),
    );
    renderForm(z.object({ root: tree }), {
      root: {
        name: "a",
        child: { name: "b", loop: { child: { child: { child: {} as Node } } } },
      },
    });
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    expect(notices()).toBe(1);
  });

  it("optional な要素を持つ tuple の再帰は、値が無くても中を描くので、上限で止める", async () => {
    // 型の上では表せない再帰なので、ZodTypeAny で書く
    const node: z.ZodTypeAny = z.lazy(() => z.tuple([node.optional()]));
    const limited = node.register(zf.common.registry, { maxDepth: 3 });
    renderForm(z.object({ root: limited }), { root: [undefined] });
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    expect(notices()).toBe(1);
  });

  it("nullable な値を持つキーの決まった record の再帰も、上限で止める", async () => {
    // 型の上では表せない再帰なので、ZodTypeAny で書く
    const node: z.ZodTypeAny = z.lazy(() =>
      z.record(z.enum(["a"]), node.nullable()),
    );
    const limited = node.register(zf.common.registry, { maxDepth: 3 });
    renderForm(z.object({ root: limited }), { root: { a: null } });
    expect(await screen.findByText(NOTICE)).toBeTruthy();
    expect(notices()).toBe(1);
  });
});
