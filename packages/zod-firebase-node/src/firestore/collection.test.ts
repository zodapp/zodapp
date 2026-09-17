import { collectionConfig } from "@zodapp/zod-firebase";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { getAccessor } from "./collection";

/**
 * firebase-admin の Firestore / Transaction / WriteBatch を最小限に模した fake。
 * `withContext` が read / write をどの runner に流すかだけを検証する。
 */
type WriteLog = {
  target: "direct" | "transaction" | "batch";
  op: "set" | "delete";
  path: string;
  data?: unknown;
  options?: unknown;
};

const createFakeFirestore = () => {
  const writes: WriteLog[] = [];
  const reads: { target: "direct" | "transaction"; path: string }[] = [];
  const storedData: Record<string, Record<string, unknown>> = {};

  const makeSnapshot = (path: string) => ({
    ref: { path },
    exists: path in storedData,
    data: () => storedData[path],
  });

  // 実 Firestore の `DocumentReference.path` は先頭 `/` を持たないため揃える。
  const makeDocRef = (rawPath: string) => {
    const path = rawPath.replace(/^\//, "");
    return {
      path,
      id: path.split("/").at(-1) ?? "",
      get: async () => {
        reads.push({ target: "direct", path });
        return makeSnapshot(path);
      },
      set: async (data: unknown, options?: unknown) => {
        writes.push({ target: "direct", op: "set", path, data, options });
      },
      delete: async () => {
        writes.push({ target: "direct", op: "delete", path });
      },
    };
  };

  const db = {
    doc: (path: string) => makeDocRef(path),
    collection: (path: string) => ({
      doc: (id?: string) => makeDocRef(`${path}/${id ?? "generated-id"}`),
    }),
  };

  const transaction = {
    get: async (ref: { path: string }) => {
      reads.push({ target: "transaction", path: ref.path });
      return makeSnapshot(ref.path);
    },
    set: (ref: { path: string }, data: unknown, options?: unknown) => {
      writes.push({
        target: "transaction",
        op: "set",
        path: ref.path,
        data,
        options,
      });
      return transaction;
    },
    delete: (ref: { path: string }) => {
      writes.push({ target: "transaction", op: "delete", path: ref.path });
      return transaction;
    },
  };

  const batch = {
    set: (ref: { path: string }, data: unknown, options?: unknown) => {
      writes.push({
        target: "batch",
        op: "set",
        path: ref.path,
        data,
        options,
      });
      return batch;
    },
    delete: (ref: { path: string }) => {
      writes.push({ target: "batch", op: "delete", path: ref.path });
      return batch;
    },
    commit: vi.fn(async () => []),
  };

  return { db, transaction, batch, writes, reads, storedData };
};

const testCollection = collectionConfig({
  path: "/teams/:teamId/items/:id" as const,
  fieldKeys: [] as const,
  schema: z.object({ name: z.string() }),
  createExcludedSchema: z.object({
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  }),
  onCreate: () => ({ createdAt: new Date() }),
  onWrite: () => ({ updatedAt: new Date() }),
});

// fake は firebase-admin の型を満たさないため、accessor へ渡す境界だけ cast する。
type NodeFirestore = Parameters<typeof getAccessor>[0];
type NodeTransaction = Parameters<
  ReturnType<typeof getAccessor>["withContext"]
>[0] extends infer TContext
  ? TContext extends { runner: infer TRunner }
    ? TRunner
    : never
  : never;

describe("getAccessor withContext", () => {
  it("writes directly when no context is bound", async () => {
    const fake = createFakeFirestore();
    const accessor = getAccessor(
      fake.db as unknown as NodeFirestore,
      testCollection,
    );

    await accessor.createDocWithId({ teamId: "t1", id: "a" }, { name: "x" });
    await accessor.updateDoc({ teamId: "t1", id: "a" }, { name: "y" });
    await accessor.deleteDoc({ teamId: "t1", id: "a" });

    expect(fake.writes.map((w) => [w.target, w.op, w.path])).toEqual([
      ["direct", "set", "teams/t1/items/a"],
      ["direct", "set", "teams/t1/items/a"],
      ["direct", "delete", "teams/t1/items/a"],
    ]);
    expect(fake.writes[1]?.options).toEqual({ merge: true });
  });

  it("routes reads and writes through the transaction runner", async () => {
    const fake = createFakeFirestore();
    fake.storedData["teams/t1/items/a"] = { name: "stored" };
    const accessor = getAccessor(
      fake.db as unknown as NodeFirestore,
      testCollection,
    );
    const transactional = accessor.withContext({
      runner: fake.transaction as unknown as NodeTransaction,
    });

    const doc = await transactional.getDoc({ teamId: "t1", id: "a" });
    await transactional.updateDoc({ teamId: "t1", id: "a" }, { name: "z" });
    await transactional.deleteDoc({ teamId: "t1", id: "a" });

    expect(doc).toEqual({ teamId: "t1", id: "a", name: "stored" });
    expect(fake.reads).toEqual([
      { target: "transaction", path: "teams/t1/items/a" },
    ]);
    expect(fake.writes.map((w) => [w.target, w.op])).toEqual([
      ["transaction", "set"],
      ["transaction", "delete"],
    ]);
  });

  it("routes writes through the batch runner and exposes only write methods", async () => {
    const fake = createFakeFirestore();
    const accessor = getAccessor(
      fake.db as unknown as NodeFirestore,
      testCollection,
    );
    const batched = accessor.withContext({
      runner: fake.batch as unknown as NodeTransaction,
    });

    const createdId = await batched.createDoc({ teamId: "t1" }, { name: "n" });
    await batched.createDocWithId({ teamId: "t1", id: "b" }, { name: "m" });
    await batched.deleteDoc({ teamId: "t1", id: "b" });

    expect(createdId).toBe("generated-id");
    expect(fake.writes.map((w) => [w.target, w.op, w.path])).toEqual([
      ["batch", "set", "teams/t1/items/generated-id"],
      ["batch", "set", "teams/t1/items/b"],
      ["batch", "delete", "teams/t1/items/b"],
    ]);
    // batch runner では読み取りを持たない
    expect("getDoc" in batched).toBe(false);
    expect(fake.batch.commit).not.toHaveBeenCalled();
  });

  it("returns the unbound accessor from withContext() without arguments", async () => {
    const fake = createFakeFirestore();
    const accessor = getAccessor(
      fake.db as unknown as NodeFirestore,
      testCollection,
    );
    const rebound = accessor
      .withContext({ runner: fake.batch as unknown as NodeTransaction })
      .withContext();

    await rebound.updateDoc({ teamId: "t1", id: "a" }, { name: "y" });

    expect(fake.writes.map((w) => w.target)).toEqual(["direct"]);
  });
});
