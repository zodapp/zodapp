import {
  defineContext,
  defineEndpoints,
  DefinitionError,
  tableConfig,
} from "@zodapp/zod-dynamodb";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
} from "vitest";
import { z } from "zod";
import {
  ForbiddenError,
  MissingContextError,
  UnauthenticatedError,
} from "./errors";
import { createRepository } from "./repository";
import { createServerApi, runWithContext } from "./server-api";
import { appTable } from "./test/fixtures";
import { createTestTable, localClient } from "./test/local";

type Auth = { userId: string; admin?: boolean };
const { createOps, override } = defineContext<Auth>();

const notes = tableConfig({
  table: appTable,
  entity: "OpNote",
  item: z.object({
    ownerId: z.string(),
    noteId: z.string(),
    body: z.string(),
    status: z.enum(["draft", "done"]),
    editedBy: z.string().optional(),
    updatedAt: z.date(),
  }),
  create: z.object({ body: z.string(), status: z.enum(["draft", "done"]) }),
  key: { partition: ["ownerId"], sort: ["noteId"] },
  onWrite: ({ now }) => ({ updatedAt: now }),
  generateKey: {
    args: z.object({ ownerId: z.string() }),
    key: (args, input) => ({
      ownerId: args.ownerId,
      noteId: `g-${input.body}`,
    }),
  },
});

const own = (ctx: Auth, ownerId: string) => ctx.admin || ctx.userId === ownerId;

const noteOps = createOps(notes, (o) => ({
  get: o.get({ authorize: (ctx, { key }) => own(ctx, key.ownerId) }),
  create: o.create({ authorize: (ctx, { key }) => own(ctx, key.ownerId) }),
  add: o.createWithGeneratedKey({
    authorize: (ctx, { args }) => own(ctx, args.ownerId),
  }),
  remove: o.delete({
    authorize: (ctx, { key }) => own(ctx, key.ownerId),
    where: () => ({ status: "done" }),
  }),
  edit: o.mutation({
    params: z.object({ body: z.string() }),
    authorize: (ctx, { key }) => own(ctx, key.ownerId),
    patch: (p, ctx) => ({ body: p.body, editedBy: ctx.userId }),
  }),
  finish: o.mutation({
    params: z.object({}),
    authorize: (ctx, { key }) => own(ctx, key.ownerId),
    patch: () => ({ status: "done" as const }),
  }),
  byOwner: o.query({
    params: z.object({ ownerId: z.string() }),
    authorize: (ctx, { params }) => own(ctx, params.ownerId),
    where: (p) => ({ partition: { ownerId: p.ownerId } }),
  }),
  purge: o.delete(),
}));

const client = localClient();
let table: Awaited<ReturnType<typeof createTestTable>>;

const repo = (
  overrides: Parameters<typeof createRepository>[0]["overrides"] = [],
) =>
  createRepository({
    tables: { notes },
    dynamodb: client,
    tableNames: { app: table.name },
    cursorSecret: "secret",
    overrides,
  });

beforeAll(async () => {
  table = await createTestTable(client, appTable);
});
afterAll(async () => {
  await table.drop();
});

const alice: Auth = { userId: "alice" };
const bob: Auth = { userId: "bob" };

describe("execute", () => {
  it("validates, authorizes and runs each kind of operation", async () => {
    const r = repo();
    const key = { ownerId: "alice", noteId: "n1" };
    const created = await r.execute(
      noteOps.create,
      { key, input: { body: "hi", status: "draft" } },
      { context: alice },
    );
    expect(created).toMatchObject({ body: "hi" });
    const found = (await r.execute(
      noteOps.get,
      { key, withToken: true },
      { context: alice },
    )) as { item: unknown; token: string };
    expect(found.item).toMatchObject({ body: "hi" });
    expect(typeof found.token).toBe("string");

    const edited = await r.execute(
      noteOps.edit,
      { key, params: { body: "hello" }, ifUnchanged: found.token },
      { context: alice },
    );
    expect(edited).toMatchObject({ body: "hello", editedBy: "alice" });

    const added = await r.execute(
      noteOps.add,
      { args: { ownerId: "alice" }, input: { body: "x", status: "draft" } },
      { context: alice },
    );
    expect(added).toMatchObject({ noteId: "g-x" });

    const page = (await r.execute(
      noteOps.byOwner,
      { params: { ownerId: "alice" }, limit: 1 },
      { context: alice },
    )) as { items: unknown[]; cursor?: string };
    expect(page.items).toHaveLength(1);
    expect(page.cursor).toBeTypeOf("string");
  });

  it("rejects with FORBIDDEN when authorize returns false", async () => {
    const r = repo();
    await expect(
      r.execute(
        noteOps.get,
        { key: { ownerId: "alice", noteId: "n1" } },
        {
          context: bob,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("requires a context for operations with authorize", async () => {
    const r = repo();
    await expect(
      r.execute(noteOps.get, { key: { ownerId: "alice", noteId: "n1" } }),
    ).rejects.toBeInstanceOf(MissingContextError);
  });

  it("validates input before authorize", async () => {
    const r = repo();
    await expect(
      r.execute(noteOps.edit, {
        key: { ownerId: "alice", noteId: "n1" },
        params: { body: 1 },
      }),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });

  it("delete uses the shared where and returns the before-image", async () => {
    const r = repo();
    const key = { ownerId: "alice", noteId: "d1" };
    await r.notes.create(key, { body: "b", status: "draft" });
    await expect(
      r.execute(noteOps.remove, { key }, { context: alice }),
    ).rejects.toMatchObject({ name: "ConditionFailedError" });
    await r.execute(noteOps.finish, { key, params: {} }, { context: alice });
    const before = await r.execute(noteOps.remove, { key }, { context: alice });
    expect(before).toMatchObject({ status: "done" });
  });

  it("server-only operations run without a context", async () => {
    const r = repo();
    const key = { ownerId: "carol", noteId: "p1" };
    await r.notes.create(key, { body: "b", status: "draft" });
    expect(await r.execute(noteOps.purge, { key })).toMatchObject({
      body: "b",
    });
  });
});

describe("overrides", () => {
  it("adds a hidden rule with authorize calling shared", async () => {
    const r = repo([
      override(noteOps.get, {
        authorize: (ctx, req, shared) =>
          shared(ctx, req) && ctx.userId !== "blocked",
      }),
    ]);
    const key = { ownerId: "alice", noteId: "n1" };
    await expect(
      r.execute(
        noteOps.get,
        { key },
        { context: { userId: "blocked", admin: true } },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(
      await r.execute(
        noteOps.get,
        { key },
        { context: { userId: "x", admin: true } },
      ),
    ).toMatchObject({ ownerId: "alice" });
  });

  it("rejects an async authorize (authorize must be synchronous)", async () => {
    const r = repo([
      override(noteOps.get, {
        // @ts-expect-error authorize は同期の関数だけ
        authorize: async () => true,
      }),
    ]);
    await expect(
      r.execute(
        noteOps.get,
        { key: { ownerId: "alice", noteId: "n1" } },
        { context: { userId: "x", admin: true } },
      ),
    ).rejects.toThrow(/authorize must be synchronous/);
  });

  it("wraps patch and where of a mutation, async allowed", async () => {
    const r = repo([
      override(noteOps.edit, {
        patch: async (p, ctx, shared) => ({
          ...shared(p, ctx),
          body: `${p.body}!`,
        }),
        where: (_p, _ctx) => ({ status: "draft" }),
      }),
    ]);
    const key = { ownerId: "alice", noteId: "o1" };
    await r.notes.create(key, { body: "b", status: "draft" });
    expect(
      await r.execute(
        noteOps.edit,
        { key, params: { body: "c" } },
        { context: alice },
      ),
    ).toMatchObject({ body: "c!", editedBy: "alice" });
    // 素の mutate にも上書きが効く
    await r.notes.mutate(noteOps.finish, key, {});
    await expect(
      r.notes.mutate(noteOps.edit, key, { body: "d" }, { context: alice }),
    ).rejects.toMatchObject({ name: "ConditionFailedError" });
  });

  it("rejects two overrides of the same operation", () => {
    expect(() =>
      repo([override(noteOps.get, {}), override(noteOps.get, {})]),
    ).toThrow(DefinitionError);
  });

  it("rejects overrides from different defineContext calls", () => {
    const other = defineContext<Auth>();
    const otherOps = other.createOps(notes, (o) => ({
      get: o.get({ authorize: () => true }),
    }));
    // 上書きどうし
    expect(() =>
      repo([override(noteOps.get, {}), other.override(otherOps.get, {})]),
    ).toThrow(/different defineContext calls are mixed/);
    // 上書きと登録簿
    const otherEndpoints = defineEndpoints({ x: [{ op: otherOps.get }] });
    expect(() =>
      createServerApi(otherEndpoints, {
        repository: repo([override(noteOps.get, {})]),
      }),
    ).toThrow(/different defineContext calls/);
  });
});

const endpoints = defineEndpoints({
  notes: [
    { op: noteOps.get, path: "/notes/get" },
    { op: noteOps.create, path: "/notes/create" },
    { op: noteOps.remove, path: "/notes/delete" },
    { op: noteOps.edit, path: "/notes/edit" },
    { op: noteOps.finish, path: "/notes/finish" },
    { op: noteOps.byOwner, path: "/notes/by-owner", live: true },
    { op: noteOps.purge },
  ],
});

describe("createServerApi", () => {
  const api = () =>
    createServerApi(endpoints, {
      repository: repo(),
      context: (req: { user: string }) => ({ userId: req.user }),
    });

  it("calls operations by name with an explicit context", async () => {
    const s = api();
    const key = { ownerId: "dave", noteId: "s1" };
    const item = await s.notes.create(
      key,
      { body: "a", status: "draft" },
      { context: { userId: "dave" } },
    );
    expect(item.body).toBe("a");
    expectTypeOf(item.body).toEqualTypeOf<string>();
    const found = await s.notes.get(key, { context: { userId: "dave" } });
    expect(found?.body).toBe("a");
    const page = await s.notes.byOwner(
      { ownerId: "dave" },
      { context: { userId: "dave" }, fields: { pick: ["body"] } },
    );
    expect(page.items[0]).toEqual({ ownerId: "dave", noteId: "s1", body: "a" });
  });

  it("uses the scope when no context is passed", async () => {
    const s = api();
    const key = { ownerId: "erin", noteId: "s2" };
    await runWithContext({ userId: "erin" }, async () => {
      await s.notes.create(key, { body: "a", status: "draft" });
      const edited = await s.notes.edit(key, { body: "b" });
      expect(edited.editedBy).toBe("erin");
      expect(s.notes.edit.can(key, { body: "c" })).toEqual({ ok: true });
    });
    await expect(s.notes.get(key)).rejects.toBeInstanceOf(MissingContextError);
    expect(s.notes.edit.can(key, { body: "c" })).toEqual({
      ok: false,
      reason: "NO_CONTEXT",
    });
  });

  it("an explicit context of undefined or null never falls back to the scope", async () => {
    const s = api();
    const key = { ownerId: "erin", noteId: "s3" };
    await runWithContext({ userId: "erin" }, async () => {
      await s.notes.create(key, { body: "a", status: "draft" });
      // 「bob の権限で」のつもりで、bob が見つからず undefined になった場合
      for (const context of [undefined, null]) {
        await expect(
          s.notes.get(key, { context } as never),
        ).rejects.toBeInstanceOf(MissingContextError);
        await expect(
          s.notes.edit(key, { body: "x" }, { context } as never),
        ).rejects.toBeInstanceOf(MissingContextError);
        expect(
          s.notes.edit.can(key, { body: "c" }, { context } as never),
        ).toEqual({ ok: false, reason: "NO_CONTEXT" });
        expect(() =>
          s.authorize(s.endpoints.entryOf(noteOps.get)!, { key }, { context }),
        ).toThrow(MissingContextError);
      }
      // キーを書かなければ、いままでどおりスコープの値
      expect((await s.notes.get(key))?.body).toBe("a");
    });
  });

  it("scope() resolves the context from the request", async () => {
    const s = api();
    const key = { ownerId: "fay", noteId: "s3" };
    await new Promise<void>((resolve, reject) => {
      s.scope()({ user: "fay" }, {}, (error?: unknown) => {
        if (error) return reject(error);
        s.notes
          .create(key, { body: "a", status: "draft" })
          .then(() => resolve(), reject);
      });
    });
    expect(await s.notes.purge(key)).toMatchObject({ body: "a" });
  });

  it("can checks input, authorize and where with an item", () => {
    const s = api();
    const key = { ownerId: "gil", noteId: "x" };
    const ctx = { context: { userId: "gil" } };
    expect(s.notes.remove.can(key, ctx)).toEqual({ ok: true });
    expect(
      s.notes.remove.can(key, {
        ...ctx,
        item: { ...key, body: "", status: "draft", updatedAt: new Date() },
      }),
    ).toEqual({ ok: false, reason: "CONDITION" });
    expect(s.notes.remove.can(key, { context: { userId: "h" } })).toEqual({
      ok: false,
      reason: "FORBIDDEN",
    });
    expect(s.notes.edit.can(key, { body: 1 } as never, ctx)).toMatchObject({
      ok: false,
      reason: "INVALID_INPUT",
    });
  });

  it("credential と context を分け、期限と checkContext を操作のたびに確かめる", async () => {
    type Ctx = { userId: string; expiresAt: number; suspended?: boolean };
    const s = createServerApi(endpoints, {
      repository: repo(),
      // 認証の情報の型はアプリが決める（ここでは文字列でないオブジェクト）
      credential: (req: { session?: { user: string; ttl: number } }) =>
        req.session,
      context: (session): Ctx | undefined =>
        session && {
          userId: session.user,
          expiresAt: Date.now() + session.ttl,
        },
      expiresAt: (ctx: Ctx) => ctx.expiresAt,
      // 期限のほかの確認（アカウントの停止など）
      checkContext: (ctx: Ctx) => {
        if (ctx.suspended) throw new UnauthenticatedError("suspended");
      },
    });
    expect(
      s.credentialFromRequest({ session: { user: "ian", ttl: 1 } }),
    ).toEqual({ user: "ian", ttl: 1 });
    expect(await s.contextOf({})).toBeUndefined();
    const live = (await s.contextOf({
      session: { user: "ian", ttl: 60_000 },
    })) as Ctx;
    const key = { ownerId: "ian", noteId: "c1" };
    await s.notes.create(
      key,
      { body: "a", status: "draft" },
      { context: live },
    );
    const expired: Ctx = { userId: "ian", expiresAt: Date.now() - 1 };
    await expect(s.notes.get(key, { context: expired })).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
    // authorize は同期で投げる
    expect(() =>
      s.authorize(
        s.endpoints.entries.find((e) => e.name === "get")!,
        { key },
        { context: expired },
      ),
    ).toThrow(UnauthenticatedError);
    expect(() => s.checkContext(expired)).toThrow(UnauthenticatedError);
    expect(s.expiresAt(live)).toBe(live.expiresAt);
    expect(() => s.checkContext({ ...live, suspended: true })).toThrow(
      /suspended/,
    );
    // can は判定だけ。期限は見ない
    expect(s.notes.get.can(key, { context: expired })).toEqual({ ok: true });
    // 認証コンテキストを使わないサーバー専用の操作は、確認しない
    expect(await s.notes.purge(key)).toMatchObject({ body: "a" });
  });

  it("credential を省くと、リクエストそのものを context に渡す", async () => {
    const s = api();
    expect(s.credentialFromRequest({ user: "jo" })).toEqual({ user: "jo" });
    expect(await s.contextFromCredential({ user: "jo" })).toEqual({
      userId: "jo",
    });
    expect(await s.contextOf({ user: "jo" })).toEqual({ userId: "jo" });
  });

  it("rejects reserved group names", () => {
    const e = defineEndpoints({ scope: [{ op: noteOps.purge }] });
    expect(() => createServerApi(e, { repository: repo() })).toThrow(
      /reserved/,
    );
  });
});

describe("検証は 1 回だけ（認可と書き込みで同じ値）", () => {
  // 毎回違う値を作る default。parse を 2 回すると、認可が見た値と保存される値が食い違う
  const stamps = tableConfig({
    table: appTable,
    entity: "OpStamp",
    item: z.object({
      ownerId: z.string(),
      stampId: z.string(),
      nonce: z.string(),
      tag: z.string(),
    }),
    create: z.object({
      nonce: z.string().default(() => crypto.randomUUID()),
      tag: z.string(),
    }),
    key: { partition: ["ownerId"], sort: ["stampId"] },
  });
  const seen: Record<string, unknown>[] = [];
  const stampOps = createOps(stamps, (o) => ({
    create: o.create({
      authorize: (_ctx, req) => {
        seen.push({ ...req.input });
        return true;
      },
    }),
    retag: o.mutation({
      params: z.object({ tag: z.string().default(() => crypto.randomUUID()) }),
      authorize: (_ctx, req) => {
        seen.push({ ...req.params });
        return true;
      },
      patch: (p) => ({ tag: p.tag }),
    }),
  }));
  const stampRepo = () =>
    createRepository({
      tables: { stamps },
      dynamodb: client,
      tableNames: { app: table.name },
      cursorSecret: "secret",
    });

  it("create の default の値を、認可と保存で揃える", async () => {
    seen.length = 0;
    const r = stampRepo();
    const key = { ownerId: "o1", stampId: "s1" };
    const item = (await r.execute(
      stampOps.create,
      { key, input: { tag: "a" } },
      { context: { userId: "o1" } },
    )) as { nonce: string };
    expect(seen[0]!.nonce).toBe(item.nonce);
  });

  it("mutation の params の default も揃える", async () => {
    seen.length = 0;
    const r = stampRepo();
    const key = { ownerId: "o1", stampId: "s2" };
    await r.execute(
      stampOps.create,
      { key, input: { tag: "a" } },
      { context: { userId: "o1" } },
    );
    seen.length = 0;
    const after = (await r.execute(
      stampOps.retag,
      { key, params: {} },
      { context: { userId: "o1" } },
    )) as { tag: string };
    expect(seen[0]!.tag).toBe(after.tag);
  });

  it("Accessor を直接呼ぶ場合は、いままでどおり検証する", async () => {
    const r = stampRepo();
    await expect(
      r.stamps.create({ ownerId: "o1", stampId: "s3" }, { tag: 1 } as never),
    ).rejects.toMatchObject({ name: "ValidationError" });
  });
});

describe("上書きの authorize とサーバーの API", () => {
  const guarded = () =>
    createServerApi(endpoints, {
      repository: repo([
        override(noteOps.get, {
          authorize: (ctx, req, shared) =>
            shared(ctx, req) && ctx.userId !== "mallory",
        }),
      ]),
      context: (req: { user: string }) => ({ userId: req.user, admin: true }),
    });

  it("直接の呼び出しは、上書きの authorize が false なら FORBIDDEN", async () => {
    const s = guarded();
    const key = { ownerId: "frank", noteId: "o1" };
    await expect(
      s.notes.get(key, { context: { userId: "mallory", admin: true } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      s.notes.get(key, { context: { userId: "frank" } }),
    ).resolves.toBeNull();
  });

  it("can は共有の規則だけで判定し、上書きは反映しない", () => {
    const s = guarded();
    const key = { ownerId: "frank", noteId: "o1" };
    expect(
      s.notes.get.can(key, { context: { userId: "mallory", admin: true } }),
    ).toEqual({ ok: true });
  });
});
