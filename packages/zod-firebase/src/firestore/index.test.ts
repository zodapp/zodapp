import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { z } from "zod";
import {
  collectionConfig,
  createCollectionMutations,
  createCollectionQueries,
  createCollectionReference,
  resolveScopedQueryOptions,
  CollectionFromReference,
  CollectionDefinition,
  CollectionConfig,
  CollectionConfigMethods,
  CollectionReference,
  type CollectionReferenceConfig,
} from "./index";

describe("collectionConfig", () => {
  // テスト用のコレクション設定
  const testCollection = collectionConfig({
    path: "/teams/:teamId/users/:userId" as const,
    fieldKeys: ["groupId"] as const,
    schema: z.object({
      name: z.string(),
      email: z.email(),
    }),
    createExcludedSchema: z.object({
      createdAt: z.date().optional(),
      updatedAt: z.date().optional(),
    }),
    onCreate: () => ({ createdAt: new Date() }),
    onWrite: () => ({ updatedAt: new Date() }),
  });

  describe("beforeGenerate", () => {
    it("should apply onCreate and onWrite hooks to new data", () => {
      const now = new Date();
      vi.setSystemTime(now);

      const documentIdentity = {
        teamId: "456",
        userId: "123",
        groupId: "group-789",
      };
      const data = {
        name: "John Doe",
        email: "john@example.com",
      };

      const result = testCollection.beforeGenerate(documentIdentity, data);

      // onCreate -> onWrite の順で適用され、fieldKeys（groupId）も注入される
      expect(result).toEqual({
        ...data,
        createdAt: now,
        updatedAt: now,
        groupId: "group-789",
      });

      vi.useRealTimers();
    });
  });

  describe("beforeWrite", () => {
    it("should apply onWrite hook for existing data (update)", () => {
      const now = new Date();
      vi.setSystemTime(now);

      const documentIdentity = {
        teamId: "456",
        userId: "123",
        groupId: "group-789",
      };
      const existingData = {
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      const result = testCollection.beforeWrite(documentIdentity, existingData);

      // onWrite のみ適用（onCreate は create 時のみ）、fieldKeys（groupId）も注入される
      expect(result).toEqual({
        ...existingData,
        updatedAt: now,
        groupId: "group-789",
      });
      expect(result.createdAt).toEqual(existingData.createdAt);

      vi.useRealTimers();
    });
  });

  describe("buildDocumentPath", () => {
    it("should build correct path from parameters", () => {
      const params = {
        teamId: "456",
        userId: "123",
      };

      const result = testCollection.buildDocumentPath(params);

      expect(result).toBe("/teams/456/users/123");
    });
  });

  describe("parseDocumentPath", () => {
    it("should parse path and extract parameters", () => {
      const path = "/teams/456/users/123";

      const result = testCollection.parseDocumentPath(path);

      expect(result).toEqual({
        teamId: "456",
        userId: "123",
      });
    });

    it("should return null for invalid path", () => {
      const path = "/invalid/path";

      const result = testCollection.parseDocumentPath(path);

      expect(result).toBeNull();
    });
  });

  describe("型の推論テスト", () => {
    it("should have correct type inference", () => {
      // 型推論が正しく動作することを確認
      // dataSchema には documentIdentityKeys (userId, teamId, groupId) が必須で含まれる
      const data = {
        userId: "123",
        teamId: "456",
        groupId: "group-789",
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      // このテストはTypeScript の型チェックのためのものです
      const result = testCollection.dataSchema.parse(data);
      // z.infer<typeof testCollection.dataSchema> が正しく推論されることを確認
      expectTypeOf(result).toHaveProperty("userId");
      expectTypeOf(result).toHaveProperty("teamId");
      expectTypeOf(result).toHaveProperty("groupId");
      expectTypeOf(result).toHaveProperty("name");
      expectTypeOf(result).toHaveProperty("email");
    });
  });

  describe("identity系スキーマ", () => {
    it("should have documentPathSchema with documentPathKeys only", () => {
      const params = {
        teamId: "456",
        userId: "123",
      };

      const result = testCollection.documentPathSchema.parse(params);
      expect(result).toEqual(params);
    });

    it("should have collectionPathSchema with collectionKeys only", () => {
      const params = {
        teamId: "456",
      };

      const result = testCollection.collectionPathSchema.parse(params);
      expect(result).toEqual(params);
    });

    it("should have documentKeySchema with documentKey only", () => {
      const params = {
        userId: "123",
      };

      const result = testCollection.documentKeySchema.parse(params);
      expect(result).toEqual(params);
    });

    it("should have nonPathKeySchema with nonPathKeys only", () => {
      const params = {
        groupId: "group-789",
      };

      const result = testCollection.nonPathKeySchema.parse(params);
      expect(result).toEqual(params);
    });

    it("should have documentIdentitySchema with documentPathKeys + nonPathKeys", () => {
      const params = {
        teamId: "456",
        userId: "123",
        groupId: "group-789",
      };

      const result = testCollection.documentIdentitySchema.parse(params);
      expect(result).toEqual(params);

      // 必須キー不足はエラー
      expect(() =>
        testCollection.documentIdentitySchema.parse({
          teamId: "456",
          groupId: "group-789",
        }),
      ).toThrow();
      expect(() =>
        testCollection.documentIdentitySchema.parse({
          teamId: "456",
          userId: "123",
        }),
      ).toThrow();
    });

    it("should have collectionIdentitySchema with collectionKeys + nonPathKeys", () => {
      const params = {
        teamId: "456",
        groupId: "group-789",
      };

      const result = testCollection.collectionIdentitySchema.parse(params);
      expect(result).toEqual(params);

      // 必須キー不足はエラー
      expect(() =>
        testCollection.collectionIdentitySchema.parse({
          groupId: "group-789",
        }),
      ).toThrow();
      expect(() =>
        testCollection.collectionIdentitySchema.parse({
          teamId: "456",
        }),
      ).toThrow();
    });
  });

  describe("派生スキーマ", () => {
    it("should have dataSchema with documentIdentityKeys (required)", () => {
      const data = {
        userId: "123",
        teamId: "456",
        groupId: "group-789",
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      const result = testCollection.dataSchema.parse(data);
      expect(result).toEqual(data);

      // documentIdentityKeys が必須であることを確認
      expect(() =>
        testCollection.dataSchema.parse({
          name: "John Doe",
          email: "john@example.com",
        }),
      ).toThrow();

      // schema 側のバリデーションも通る/落ちる
      expect(() =>
        testCollection.dataSchema.parse({
          ...data,
          email: "invalid-email",
        }),
      ).toThrow();
      expect(() =>
        testCollection.dataSchema.parse({
          userId: "123",
          teamId: "456",
          groupId: "group-789",
          // name と email が不足
        }),
      ).toThrow();
    });

    it("should keep createExcludedSchema optionality as-is", () => {
      const result = testCollection.dataSchema.parse({
        userId: "123",
        teamId: "456",
        groupId: "group-789",
        name: "John Doe",
        email: "john@example.com",
      });
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();

      const updated = testCollection.updateSchema.parse({
        name: "John Doe",
        email: "john@example.com",
        groupId: "group-789",
      });
      expect(updated.createdAt).toBeUndefined();
      expect(updated.updatedAt).toBeUndefined();

      const stored = testCollection.storeSchema.parse({
        groupId: "group-789",
        name: "John Doe",
        email: "john@example.com",
      });
      expect(stored.createdAt).toBeUndefined();
      expect(stored.updatedAt).toBeUndefined();
    });

    it("should have updateSchema with identity keys and fieldKeys optional", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      const result = testCollection.updateSchema.parse(data);
      expect(result).toEqual(data);

      // fieldKeys / identityKeys がなくても OK
      expect(
        testCollection.updateSchema.parse({
          name: "John Doe",
          email: "john@example.com",
        }),
      ).toEqual({
        name: "John Doe",
        email: "john@example.com",
      });

      // documentIdentityKeys ありでも OK
      const dataWithIdentity = {
        ...data,
        groupId: "group-789",
        userId: "123",
        teamId: "456",
      };
      const resultWithIdentity =
        testCollection.updateSchema.parse(dataWithIdentity);
      expect(resultWithIdentity).toEqual(dataWithIdentity);
    });

    it("should have storeSchema without documentPathKeys but with fieldKeys/createExcluded (required)", () => {
      const data = {
        groupId: "group-789",
        name: "John Doe",
        email: "john@example.com",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      const result = testCollection.storeSchema.parse(data);
      expect(result).toEqual(data);

      // fieldKeys が必須であることを確認
      expect(() =>
        testCollection.storeSchema.parse({
          name: "John Doe",
          email: "john@example.com",
        }),
      ).toThrow();
    });

    it("should have createSchema based only on intrinsic schema", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
      };

      const result = testCollection.createSchema.parse(data);
      expect(result).toEqual(data);

      // createSchema には intrinsic schema にない追加項目は現れない
      const resultKeys = Object.keys(result);
      expect(resultKeys).not.toContain("userId");
      expect(resultKeys).not.toContain("teamId");
      expect(resultKeys).not.toContain("groupId");
      expect(resultKeys).not.toContain("createdAt");
      expect(resultKeys).not.toContain("updatedAt");
    });

    it("should auto-hide identity keys while preserving intrinsic validation", () => {
      const withIntrinsicIdentity = collectionConfig({
        path: "/teams/:teamId/users/:userId" as const,
        fieldKeys: [] as const,
        schema: z.object({
          userId: z.string().min(1).optional(),
          name: z.string(),
        }),
      });

      const parsed = withIntrinsicIdentity.updateSchema.parse({
        teamId: "team-1",
        userId: "user-1",
        name: "Alice",
      });
      expect(parsed).toEqual({
        teamId: "team-1",
        userId: "user-1",
        name: "Alice",
      });

      expect(() =>
        withIntrinsicIdentity.dataSchema.parse({
          teamId: "t1",
          userId: "",
          name: "Alice",
        }),
      ).toThrow();
    });

    it("should throw when intrinsic has required identity key overlap", () => {
      expect(() =>
        collectionConfig({
          path: "/teams/:teamId/users/:userId" as const,
          fieldKeys: [] as const,
          schema: z.object({
            userId: z.string().min(1),
            name: z.string(),
          }),
        }),
      ).toThrow(/must be optional/);
    });

    it("should throw when intrinsic has required createExcluded key overlap", () => {
      expect(() =>
        collectionConfig({
          path: "/teams/:teamId/users/:userId" as const,
          schema: z.object({
            name: z.string(),
            createdAt: z.date(),
          }),
          createExcludedSchema: z.object({
            createdAt: z.date().optional(),
          }),
        }),
      ).toThrow(/must be optional/);
    });
  });

  describe("checkNonPathKeys のテスト", () => {
    it("should correctly check nonPathKeys", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        groupId: "group-789",
      };
      const identityParams = {
        teamId: "456",
        userId: "123",
        groupId: "group-789",
      };

      expect(testCollection.checkNonPathKeys(data, identityParams)).toBe(true);

      // groupId が一致しない場合
      expect(
        testCollection.checkNonPathKeys(data, {
          ...identityParams,
          groupId: "wrong-group",
        }),
      ).toBe(false);
    });
  });

  describe("onCreateId", () => {
    it("should return docId from inputData when configured", () => {
      const withOnCreateId = collectionConfig({
        path: "/workspaces/:workspaceId/members/:memberId" as const,
        fieldKeys: [] as const,
        schema: z.object({ email: z.string().email(), name: z.string() }),
        onCreateId: (_collectionIdentity, inputData) =>
          (inputData as { email: string }).email,
      });
      const docId = withOnCreateId.onCreateId?.(
        { workspaceId: "ws1" },
        { email: "u@example.com", name: "User" },
      );
      expect(docId).toBe("u@example.com");
    });

    it("should be undefined when not configured", () => {
      expect(testCollection.onCreateId).toBeUndefined();
    });
  });

  describe("分離 helper", () => {
    it("queries / mutations / reference を別 object として作成できる", () => {
      const queries = createCollectionQueries(testCollection, {
        recent: () => ({
          orderBy: [{ field: "updatedAt", direction: "desc" as const }],
        }),
      });
      const mutations = createCollectionMutations(testCollection, {
        rename: (name: string) => ({ name }),
      });
      const reference = createCollectionReference(testCollection, {
        labelField: "name",
        valueField: "userId",
      });

      expect(queries.collection).toBe(testCollection);
      expect(mutations.collection).toBe(testCollection);
      expect(reference.collection).toBe(testCollection);
      expect(reference.config).toEqual({
        labelField: "name",
        valueField: "userId",
      });
    });
  });

  describe("CollectionReference の型ユーティリティ", () => {
    it("CollectionFromReference で元の collection 型を取り出せる", () => {
      const reference = createCollectionReference(testCollection, {
        labelField: "name",
        valueField: "userId",
      });

      type ExtractedCollection = CollectionFromReference<typeof reference>;
      type ExtractedCollectionFromGeneric = CollectionFromReference<
        CollectionReference<typeof testCollection>
      >;

      expectTypeOf<ExtractedCollection>().toEqualTypeOf<
        typeof testCollection
      >();
      expectTypeOf<ExtractedCollectionFromGeneric>().toEqualTypeOf<
        typeof testCollection
      >();
      expectTypeOf(reference.collection).toEqualTypeOf<ExtractedCollection>();
    });
  });

  describe("CollectionReferenceConfig の型安全性", () => {
    it("labelField にフィールド名（keyof T）を指定できる", () => {
      const ref = createCollectionReference(testCollection, {
        labelField: "name",
        valueField: "userId",
      });
      expect(ref.config.labelField).toBe("name");
      expect(ref.config.valueField).toBe("userId");
    });

    it("labelFormatter に関数を指定できる", () => {
      const ref = createCollectionReference(testCollection, {
        labelFormatter: (data) => `${data.name} (${data.email})`,
        valueField: "userId",
      });
      expect(typeof ref.config.labelFormatter).toBe("function");
    });

    it("labelField と labelFormatter を同時に指定できる（labelFormatter が優先される）", () => {
      const ref = createCollectionReference(testCollection, {
        labelField: "name",
        labelFormatter: (data) => `${data.name} (${data.email})`,
        valueField: "userId",
      });
      expect(ref.config.labelField).toBe("name");
      expect(typeof ref.config.labelFormatter).toBe("function");
    });

    it("labelField を省略できる", () => {
      const ref = createCollectionReference(testCollection, {
        valueField: "userId",
      });
      expect(ref.config.labelField).toBeUndefined();
    });

    it("valueField を省略できる", () => {
      const ref = createCollectionReference(testCollection, {
        labelField: "name",
      });
      expect(ref.config.valueField).toBeUndefined();
    });

    it("labelField と valueField の両方を省略できる（空オブジェクト）", () => {
      const ref = createCollectionReference(testCollection, {});
      expect(ref.config.labelField).toBeUndefined();
      expect(ref.config.valueField).toBeUndefined();
    });

    it("CollectionReferenceConfig<T> の型パラメータが dataSchema から推論される", () => {
      type TestData = z.infer<(typeof testCollection)["dataSchema"]>;
      type RefLookup = (typeof testRef)["config"];

      const testRef = createCollectionReference(testCollection, {
        labelField: "name",
        valueField: "userId",
      });
      void testRef;

      expectTypeOf<RefLookup>().toEqualTypeOf<
        CollectionReferenceConfig<TestData>
      >();
    });

    it("labelFormatter の引数がデータ型に型付けされている", () => {
      createCollectionReference(testCollection, {
        labelFormatter: (data) => {
          expectTypeOf(data).toHaveProperty("name");
          expectTypeOf(data).toHaveProperty("email");
          expectTypeOf(data).toHaveProperty("userId");
          expectTypeOf(data).toHaveProperty("teamId");
          return data.name;
        },
        valueField: "userId",
      });
    });

    it("存在しないフィールド名を labelField に指定するとコンパイルエラーになる", () => {
      createCollectionReference(testCollection, {
        // @ts-expect-error "nonExistent" は dataSchema のキーに存在しない
        labelField: "nonExistent",
        valueField: "userId",
      });
    });

    it("存在しないフィールド名を valueField に指定するとコンパイルエラーになる", () => {
      createCollectionReference(testCollection, {
        labelField: "name",
        // @ts-expect-error "nonExistent" は dataSchema のキーに存在しない
        valueField: "nonExistent",
      });
    });

    it("labelFormatter 関数内で存在しないプロパティにアクセスするとコンパイルエラーになる", () => {
      createCollectionReference(testCollection, {
        labelFormatter: (data) =>
          // @ts-expect-error "nonExistent" は dataSchema のキーに存在しない
          data.nonExistent,
        valueField: "userId",
      });
    });
  });

  describe("pathFieldKeys（fieldKeys のうち path に含まれるキー）", () => {
    it("should include pathFieldKeys in storeSchema as required", () => {
      const withPathField = collectionConfig({
        path: "/teams/:teamId/users/:userId" as const,
        fieldKeys: ["teamId"] as const,
        schema: z.object({ name: z.string() }),
      });
      const parsed = withPathField.storeSchema.parse({
        teamId: "t1",
        name: "Alice",
      });
      expect(parsed).toEqual({ teamId: "t1", name: "Alice" });
      expect(() =>
        withPathField.storeSchema.parse({ name: "Alice" }),
      ).toThrow();
    });
  });

  describe("intrinsicSchema のバリデーション保持", () => {
    // intrinsicSchema 側で identity / fieldKeys と重複するキーは optional にする（新契約）
    // optional でも min(1) 等のバリデーションは保持される
    const withValidation = collectionConfig({
      path: "/teams/:teamId/users/:userId" as const,
      fieldKeys: ["groupId", "teamId"] as const,
      schema: z.object({
        userId: z.string().min(1).optional(),
        teamId: z.string().min(1).optional(),
        groupId: z.string().min(1).optional(),
        name: z.string(),
        email: z.email(),
      }),
    });

    it("dataSchema は intrinsicSchema のバリデーションを保持する", () => {
      expect(
        withValidation.dataSchema.parse({
          userId: "u1",
          teamId: "t1",
          groupId: "g1",
          name: "Alice",
          email: "alice@example.com",
        }),
      ).toBeTruthy();

      // groupId が空文字列 → min(1) により reject
      expect(() =>
        withValidation.dataSchema.parse({
          userId: "u1",
          teamId: "t1",
          groupId: "",
          name: "Alice",
          email: "alice@example.com",
        }),
      ).toThrow();

      // userId が空文字列 → min(1) により reject
      expect(() =>
        withValidation.dataSchema.parse({
          userId: "",
          teamId: "t1",
          groupId: "g1",
          name: "Alice",
          email: "alice@example.com",
        }),
      ).toThrow();
    });

    it("updateSchema は intrinsicSchema のバリデーションを保持する", () => {
      expect(
        withValidation.updateSchema.parse({
          groupId: "g1",
          teamId: "t1",
          name: "Alice",
          email: "alice@example.com",
        }),
      ).toBeTruthy();

      // groupId が空文字列 → min(1) により reject
      expect(() =>
        withValidation.updateSchema.parse({
          groupId: "",
          teamId: "t1",
          name: "Alice",
          email: "alice@example.com",
        }),
      ).toThrow();

      // teamId が空文字列 → min(1) により reject
      expect(() =>
        withValidation.updateSchema.parse({
          groupId: "g1",
          teamId: "",
          name: "Alice",
          email: "alice@example.com",
        }),
      ).toThrow();
    });

    it("storeSchema は intrinsicSchema のバリデーションを保持する（nonPathKeys）", () => {
      expect(
        withValidation.storeSchema.parse({
          groupId: "g1",
          teamId: "t1",
          name: "Alice",
          email: "alice@example.com",
        }),
      ).toBeTruthy();

      // groupId が空文字列 → min(1) により reject
      expect(() =>
        withValidation.storeSchema.parse({
          groupId: "",
          teamId: "t1",
          name: "Alice",
          email: "alice@example.com",
        }),
      ).toThrow();
    });

    it("storeSchema は intrinsicSchema のバリデーションを保持する（pathFieldKeys）", () => {
      expect(() =>
        withValidation.storeSchema.parse({
          groupId: "g1",
          teamId: "",
          name: "Alice",
          email: "alice@example.com",
        }),
      ).toThrow();
    });

    it("createSchema は identity / createExcluded を hidden 化する", () => {
      const result = withValidation.createSchema.parse({
        name: "Alice",
        email: "alice@example.com",
      });
      expect(result).toEqual({
        name: "Alice",
        email: "alice@example.com",
      });

      const resultWithIdentity = withValidation.createSchema.parse({
        name: "Alice",
        email: "alice@example.com",
        groupId: "g1",
        teamId: "t1",
        userId: "u1",
      });
      expect(resultWithIdentity.name).toBe("Alice");
    });
  });

  describe("z.infer（***Schema）の型チェックを網羅", () => {
    it("fieldKeys あり（nonPathKeys）: すべての ***Schema の z.infer が期待通り", () => {
      type DocumentPath = z.infer<
        (typeof testCollection)["documentPathSchema"]
      >;
      type CollectionPath = z.infer<
        (typeof testCollection)["collectionPathSchema"]
      >;
      type DocumentKey = z.infer<(typeof testCollection)["documentKeySchema"]>;
      type NonPathKey = z.infer<(typeof testCollection)["nonPathKeySchema"]>;
      type DocumentIdentity = z.infer<
        (typeof testCollection)["documentIdentitySchema"]
      >;
      type CollectionIdentity = z.infer<
        (typeof testCollection)["collectionIdentitySchema"]
      >;
      type CollectionKey = z.infer<
        (typeof testCollection)["collectionKeySchema"]
      >;

      type Data = z.infer<(typeof testCollection)["dataSchema"]>;
      type Update = z.infer<(typeof testCollection)["updateSchema"]>;
      type Store = z.infer<(typeof testCollection)["storeSchema"]>;
      type Create = z.infer<(typeof testCollection)["createSchema"]>;

      // --- identity系 ---
      expectTypeOf<DocumentPath>().toEqualTypeOf<{
        teamId: string;
        userId: string;
      }>();
      expectTypeOf<CollectionPath>().toEqualTypeOf<{ teamId: string }>();
      expectTypeOf<DocumentKey>().toEqualTypeOf<{ userId: string }>();
      expectTypeOf<NonPathKey>().toEqualTypeOf<{ groupId: string }>();
      expectTypeOf<DocumentIdentity>().toEqualTypeOf<{
        teamId: string;
        userId: string;
        groupId: string;
      }>();
      expectTypeOf<CollectionIdentity>().toEqualTypeOf<{
        teamId: string;
        groupId: string;
      }>();
      // collectionKeySchema は「collection を識別するキー群（= collectionPathSchema）」の想定
      expectTypeOf<CollectionKey>().toEqualTypeOf<{ teamId: string }>();

      // --- 派生スキーマ ---
      type ExpectedData = {
        userId: string;
        teamId: string;
        groupId: string;
        name: string;
        email: string;
        createdAt?: Date | undefined;
        updatedAt?: Date | undefined;
      };
      type ExpectedUpdate = {
        userId?: string | undefined;
        teamId?: string | undefined;
        groupId?: string | undefined;
        name: string;
        email: string;
        createdAt?: Date | undefined;
        updatedAt?: Date | undefined;
      };
      type ExpectedStore = {
        groupId: string;
        name: string;
        email: string;
        createdAt?: Date | undefined;
        updatedAt?: Date | undefined;
      };
      type ExpectedCreate = {
        name: string;
        email: string;
      };

      const dataActualToExpected: ExpectedData = {} as Data;
      const dataExpectedToActual: Data = {} as ExpectedData;
      const updateActualToExpected: ExpectedUpdate = {} as Update;
      const updateExpectedToActual: Update = {} as ExpectedUpdate;
      const storeActualToExpected: ExpectedStore = {} as Store;
      const storeExpectedToActual: Store = {} as ExpectedStore;
      const createActualToExpected: ExpectedCreate = {} as Create;
      const createExpectedToActual: Create = {} as ExpectedCreate;

      void dataActualToExpected;
      void dataExpectedToActual;
      void updateActualToExpected;
      void updateExpectedToActual;
      void storeActualToExpected;
      void storeExpectedToActual;
      void createActualToExpected;
      void createExpectedToActual;
    });

    it("fieldKeys なし: nonPathKeySchema / identity schemas の z.infer が期待通り", () => {
      const noFieldKeys = collectionConfig({
        path: "/teams/:teamId/users/:userId" as const,
        fieldKeys: [] as const,
        schema: z.object({
          userId: z.string().optional(),
          teamId: z.string().optional(),
          name: z.string(),
        }),
      });
      void noFieldKeys;

      type DocumentPath = z.infer<(typeof noFieldKeys)["documentPathSchema"]>;
      type CollectionPath = z.infer<
        (typeof noFieldKeys)["collectionPathSchema"]
      >;
      type DocumentKey = z.infer<(typeof noFieldKeys)["documentKeySchema"]>;
      type NonPathKey = z.infer<(typeof noFieldKeys)["nonPathKeySchema"]>;
      type DocumentIdentity = z.infer<
        (typeof noFieldKeys)["documentIdentitySchema"]
      >;
      type CollectionIdentity = z.infer<
        (typeof noFieldKeys)["collectionIdentitySchema"]
      >;

      expectTypeOf<DocumentPath>().toEqualTypeOf<{
        teamId: string;
        userId: string;
      }>();
      expectTypeOf<CollectionPath>().toEqualTypeOf<{ teamId: string }>();
      expectTypeOf<DocumentKey>().toEqualTypeOf<{ userId: string }>();
      // fieldKeys が空のときは z.unknown() なので unknown
      expectTypeOf<NonPathKey>().toEqualTypeOf<unknown>();
      expectTypeOf<DocumentIdentity>().toEqualTypeOf<{
        teamId: string;
        userId: string;
      }>();
      expectTypeOf<CollectionIdentity>().toEqualTypeOf<{ teamId: string }>();
    });
  });
  describe("型チェックのためのテスト", () => {
    it("CollectionConfigFn と CollectionConfigBareFn の型が一致すること", () => {
      type CollectionConfigBare<
        Path extends string,
        FieldKeys extends string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        IntrinsicSchema extends z.ZodTypeAny,
        CreateExcludedShape extends z.ZodRawShape = {},
      > = CollectionDefinition<
        Path,
        FieldKeys,
        IntrinsicSchema,
        CreateExcludedShape
      > &
        CollectionConfigMethods<
          Path,
          FieldKeys,
          IntrinsicSchema,
          CreateExcludedShape
        >;

      type CollectionConfigBareFn = <
        const Path extends string,
        const FieldKeys extends string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        IntrinsicSchema extends z.ZodTypeAny,
        CreateExcludedShape extends z.ZodRawShape = {},
      >() => CollectionConfigBare<
        Path,
        FieldKeys,
        IntrinsicSchema,
        CreateExcludedShape
      >;

      type CollectionConfigFn = <
        const Path extends string,
        const FieldKeys extends string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        IntrinsicSchema extends z.ZodTypeAny,
        CreateExcludedShape extends z.ZodRawShape = {},
      >() => CollectionConfig<
        Path,
        FieldKeys,
        IntrinsicSchema,
        CreateExcludedShape
      >;

      expectTypeOf<CollectionConfigFn>().toEqualTypeOf<CollectionConfigBareFn>();
    });
  });
});

// ---------------------------------------------------------------------------
// autoQuery helpers
// ---------------------------------------------------------------------------

describe("autoQuery helpers", () => {
  // top-level collection: path に teamId が含まれず fieldKeys に teamId がある
  const topLevelCollection = collectionConfig({
    path: "/dialogs/:id" as const,
    fieldKeys: ["teamId"] as const,
    schema: z.object({
      teamId: z.string().optional(),
      name: z.string(),
      deleted: z.boolean(),
    }),
  });

  // path-scoped collection: path に teamId が含まれる（nonPathKeys なし）
  const pathScopedCollection = collectionConfig({
    path: "/teams/:teamId/auditLogs/:id" as const,
    fieldKeys: [] as const,
    schema: z.object({
      action: z.string(),
    }),
  });

  // pathFieldKeys を持つ collection: fieldKeys に teamId があるが path にも teamId がある
  const pathFieldCollection = collectionConfig({
    path: "/teams/:teamId/users/:userId" as const,
    fieldKeys: ["teamId", "groupId"] as const,
    schema: z.object({
      userId: z.string().optional(),
      teamId: z.string().optional(),
      groupId: z.string().optional(),
      name: z.string(),
    }),
  });

  // 複数 nonPathKeys
  const multiNonPathCollection = collectionConfig({
    path: "/items/:id" as const,
    fieldKeys: ["teamId", "orgId"] as const,
    schema: z.object({
      teamId: z.string().optional(),
      orgId: z.string().optional(),
      title: z.string(),
    }),
  });

  describe("config.nonPathKeys", () => {
    it("should contain nonPath keys for top-level collection", () => {
      expect(topLevelCollection.nonPathKeys).toEqual(["teamId"]);
    });

    it("should be empty for path-scoped collection with no fieldKeys", () => {
      expect(pathScopedCollection.nonPathKeys).toEqual([]);
    });

    it("should exclude pathFieldKeys", () => {
      expect(pathFieldCollection.nonPathKeys).toEqual(["groupId"]);
      expect(pathFieldCollection.nonPathKeys).not.toContain("teamId");
    });

    it("should contain multiple nonPath keys", () => {
      expect(multiNonPathCollection.nonPathKeys).toEqual(["teamId", "orgId"]);
    });
  });

  describe("resolveScopedQueryOptions", () => {
    it("should apply auto where when explicitQuery is undefined", () => {
      const result = resolveScopedQueryOptions(
        topLevelCollection,
        { teamId: "team_1" },
        undefined,
      );
      expect(result).toEqual({
        where: [{ field: "teamId", operator: "==", value: "team_1" }],
        orderBy: undefined,
      });
    });

    it("should apply auto where when explicitQuery is empty object", () => {
      const result = resolveScopedQueryOptions(
        topLevelCollection,
        { teamId: "team_1" },
        {},
      );
      expect(result).toEqual({
        where: [{ field: "teamId", operator: "==", value: "team_1" }],
        orderBy: undefined,
      });
    });

    it("should not remove auto scope when where is empty array", () => {
      const result = resolveScopedQueryOptions(
        topLevelCollection,
        { teamId: "team_1" },
        { where: [] },
      );
      expect(result).toEqual({
        where: [{ field: "teamId", operator: "==", value: "team_1" }],
        orderBy: undefined,
      });
    });

    it("should merge auto where with explicit business conditions", () => {
      const result = resolveScopedQueryOptions(
        topLevelCollection,
        { teamId: "team_1" },
        {
          where: [{ field: "deleted", operator: "==", value: false }],
          orderBy: [{ field: "createdAt", direction: "desc" }],
        },
      );
      expect(result).toEqual({
        where: [
          { field: "teamId", operator: "==", value: "team_1" },
          { field: "deleted", operator: "==", value: false },
        ],
        orderBy: [{ field: "createdAt", direction: "desc" }],
      });
    });

    it("should deduplicate same-value == on auto-scoped field", () => {
      const result = resolveScopedQueryOptions(
        topLevelCollection,
        { teamId: "team_1" },
        {
          where: [
            { field: "teamId", operator: "==", value: "team_1" },
            { field: "deleted", operator: "==", value: false },
          ],
        },
      );
      expect(result).toEqual({
        where: [
          { field: "teamId", operator: "==", value: "team_1" },
          { field: "deleted", operator: "==", value: false },
        ],
      });
      expect(result.where!.filter((w) => w.field === "teamId")).toHaveLength(1);
    });

    it("should throw on conflicting == value for auto-scoped field", () => {
      expect(() =>
        resolveScopedQueryOptions(
          topLevelCollection,
          { teamId: "team_1" },
          {
            where: [{ field: "teamId", operator: "==", value: "team_2" }],
          },
        ),
      ).toThrow(/conflicting values/);
    });

    it("should throw on non-== operator for auto-scoped field", () => {
      expect(() =>
        resolveScopedQueryOptions(
          topLevelCollection,
          { teamId: "team_1" },
          {
            where: [{ field: "teamId", operator: "!=", value: "team_1" }],
          },
        ),
      ).toThrow(/does not accept operator/);
    });

    it("should throw on 'in' operator for auto-scoped field", () => {
      expect(() =>
        resolveScopedQueryOptions(
          topLevelCollection,
          { teamId: "team_1" },
          {
            where: [
              {
                field: "teamId",
                operator: "in",
                value: ["team_1", "team_2"],
              },
            ],
          },
        ),
      ).toThrow(/does not accept operator/);
    });

    it("should throw on range operator for auto-scoped field", () => {
      expect(() =>
        resolveScopedQueryOptions(
          topLevelCollection,
          { teamId: "team_1" },
          {
            where: [{ field: "teamId", operator: ">", value: "team_0" }],
          },
        ),
      ).toThrow(/does not accept operator/);
    });

    it("should pass through for path-scoped collection (no auto where)", () => {
      const explicit = {
        where: [{ field: "deleted", operator: "==" as const, value: false }],
        orderBy: [{ field: "createdAt", direction: "desc" as const }],
      };
      const result = resolveScopedQueryOptions(
        pathScopedCollection,
        { teamId: "team_1" },
        explicit,
      );
      expect(result).toEqual(explicit);
    });

    it("should return undefined where/orderBy for path-scoped + undefined query", () => {
      const result = resolveScopedQueryOptions(
        pathScopedCollection,
        { teamId: "team_1" },
        undefined,
      );
      expect(result).toEqual({ where: undefined, orderBy: undefined });
    });

    it("should only auto-where on groupId, not teamId (pathFieldKey)", () => {
      const result = resolveScopedQueryOptions(
        pathFieldCollection,
        { teamId: "team_1", groupId: "g1" },
        {
          where: [{ field: "name", operator: "==", value: "Alice" }],
        },
      );
      expect(result).toEqual({
        where: [
          { field: "groupId", operator: "==", value: "g1" },
          { field: "name", operator: "==", value: "Alice" },
        ],
        orderBy: undefined,
      });
    });

    it("should handle multiple nonPath keys", () => {
      const result = resolveScopedQueryOptions(
        multiNonPathCollection,
        { teamId: "team_1", orgId: "org_1" },
        {
          where: [{ field: "title", operator: "==", value: "test" }],
          orderBy: [{ field: "title", direction: "asc" }],
        },
      );
      expect(result).toEqual({
        where: [
          { field: "teamId", operator: "==", value: "team_1" },
          { field: "orgId", operator: "==", value: "org_1" },
          { field: "title", operator: "==", value: "test" },
        ],
        orderBy: [{ field: "title", direction: "asc" }],
      });
    });

    it("should preserve orderBy even when where is empty", () => {
      const result = resolveScopedQueryOptions(
        topLevelCollection,
        { teamId: "team_1" },
        { orderBy: [{ field: "createdAt", direction: "desc" }] },
      );
      expect(result).toEqual({
        where: [{ field: "teamId", operator: "==", value: "team_1" }],
        orderBy: [{ field: "createdAt", direction: "desc" }],
      });
    });

    it("canonical: auto where always comes first, then explicit", () => {
      const result = resolveScopedQueryOptions(
        multiNonPathCollection,
        { teamId: "team_1", orgId: "org_1" },
        {
          where: [
            { field: "title", operator: "==", value: "a" },
            { field: "orgId", operator: "==", value: "org_1" },
          ],
        },
      );
      expect(result.where).toHaveLength(3);
      expect(result.where?.[0]?.field).toBe("teamId");
      expect(result.where?.[1]?.field).toBe("orgId");
      expect(result.where?.[2]?.field).toBe("title");
    });
  });

  describe("union / discriminatedUnion / intersection schema 対応", () => {
    it("should support discriminatedUnion schema with identity auto-merge", () => {
      const unionCollection = collectionConfig({
        path: "/items/:itemId" as const,
        fieldKeys: [] as const,
        schema: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("a"), value: z.string() }),
          z.object({ kind: z.literal("b"), count: z.number() }),
        ]),
      });

      const dataA = unionCollection.dataSchema.parse({
        itemId: "i1",
        kind: "a",
        value: "hello",
      });
      expect(dataA).toEqual({ itemId: "i1", kind: "a", value: "hello" });

      const dataB = unionCollection.dataSchema.parse({
        itemId: "i2",
        kind: "b",
        count: 42,
      });
      expect(dataB).toEqual({ itemId: "i2", kind: "b", count: 42 });

      expect(() =>
        unionCollection.dataSchema.parse({ kind: "a", value: "hello" }),
      ).toThrow();
    });

    it("should support plain union schema with identity auto-merge", () => {
      const plainUnion = collectionConfig({
        path: "/docs/:docId" as const,
        fieldKeys: [] as const,
        schema: z.union([
          z.object({ type: z.literal("text"), body: z.string() }),
          z.object({ type: z.literal("image"), url: z.string() }),
        ]),
      });

      const parsed = plainUnion.dataSchema.parse({
        docId: "d1",
        type: "text",
        body: "hello",
      });
      expect(parsed).toEqual({ docId: "d1", type: "text", body: "hello" });
    });

    it("should support intersection schema with identity auto-merge", () => {
      const intersectionCollection = collectionConfig({
        path: "/entries/:entryId" as const,
        fieldKeys: [] as const,
        schema: z.intersection(
          z.object({ title: z.string() }),
          z.object({ priority: z.number() }),
        ),
      });

      const parsed = intersectionCollection.dataSchema.parse({
        entryId: "e1",
        title: "task",
        priority: 1,
      });
      expect(parsed).toEqual({ entryId: "e1", title: "task", priority: 1 });
    });

    it("should strip identity keys from storeSchema for union", () => {
      const unionStore = collectionConfig({
        path: "/teams/:teamId/items/:itemId" as const,
        fieldKeys: ["teamId"] as const,
        schema: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("a"), value: z.string() }),
          z.object({ kind: z.literal("b"), count: z.number() }),
        ]),
      });

      const stored = unionStore.storeSchema.parse({
        teamId: "t1",
        kind: "a",
        value: "hello",
      });
      expect(stored).toEqual({ teamId: "t1", kind: "a", value: "hello" });
    });
  });
});
