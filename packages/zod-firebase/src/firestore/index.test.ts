import { describe, it, expect, vi, expectTypeOf } from "vitest";
import { z } from "zod";
import {
  collectionConfig,
  CollectionDefinition,
  QueryFn,
  MutationFn,
  CollectionConfig,
  CollectionConfigMethods,
} from "./index";

describe("collectionConfig", () => {
  // テスト用のコレクション設定
  const testCollection = collectionConfig({
    path: "/teams/:teamId/users/:userId" as const,
    fieldKeys: ["groupId"] as const,
    schema: z.object({
      userId: z.string(),
      teamId: z.string(),
      name: z.string(),
      email: z.email(),
      createdAt: z.date().optional(),
      updatedAt: z.date().optional(),
    }),
    createOmitKeys: ["createdAt", "updatedAt"] as const,
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

    it("should have updateSchema with fieldKeys (required) and other documentIdentityKeys (optional)", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
        groupId: "group-789", // fieldKeys（nonPathKeys）は必須
      };

      const result = testCollection.updateSchema.parse(data);
      expect(result).toEqual(data);

      // groupId なしは NG
      expect(() =>
        testCollection.updateSchema.parse({
          name: "John Doe",
          email: "john@example.com",
        }),
      ).toThrow();

      // documentIdentityKeys ありでも OK
      const dataWithIdentity = {
        ...data,
        userId: "123",
        teamId: "456",
      };
      const resultWithIdentity =
        testCollection.updateSchema.parse(dataWithIdentity);
      expect(resultWithIdentity).toEqual(dataWithIdentity);
    });

    it("should have storeSchema without documentPathKeys but with fieldKeys (required)", () => {
      const data = {
        groupId: "group-789",
        name: "John Doe",
        email: "john@example.com",
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

    it("should have createSchema without documentIdentityKeys and createOmitKeys", () => {
      const data = {
        name: "John Doe",
        email: "john@example.com",
      };

      const result = testCollection.createSchema.parse(data);
      expect(result).toEqual(data);

      // createSchema には userId, teamId, groupId, createdAt, updatedAt が含まれない
      // （パース結果の型で確認）
      const resultKeys = Object.keys(result);
      expect(resultKeys).not.toContain("userId");
      expect(resultKeys).not.toContain("teamId");
      expect(resultKeys).not.toContain("groupId");
      expect(resultKeys).not.toContain("createdAt");
      expect(resultKeys).not.toContain("updatedAt");
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
    // intrinsicSchema 側で z.string() より厳しいバリデーションを持つキーが
    // fieldKeys に含まれる場合、元のバリデーションが保持されること
    const withValidation = collectionConfig({
      path: "/teams/:teamId/users/:userId" as const,
      fieldKeys: ["groupId", "teamId"] as const,
      schema: z.object({
        userId: z.string().min(1),
        teamId: z.string().min(1),
        groupId: z.string().min(1),
        name: z.string(),
        email: z.email(),
      }),
    });

    it("dataSchema は intrinsicSchema のバリデーションを保持する", () => {
      // 有効なデータ
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
      // 有効なデータ（fieldKeys のみ必須）
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
      // 有効なデータ（documentPathKeys は除外、fieldKeys は必須）
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
      // teamId が空文字列 → min(1) により reject（pathFieldKeys で復元されたスキーマ）
      expect(() =>
        withValidation.storeSchema.parse({
          groupId: "g1",
          teamId: "",
          name: "Alice",
          email: "alice@example.com",
        }),
      ).toThrow();
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
      expectTypeOf<Data>().toEqualTypeOf<{
        userId: string;
        teamId: string;
        groupId: string;
        name: string;
        email: string;
        createdAt?: Date | undefined;
        updatedAt?: Date | undefined;
      }>();
      expectTypeOf<Update>().toEqualTypeOf<{
        userId?: string | undefined;
        teamId?: string | undefined;
        groupId: string; // fieldKeys（nonPathKeys）は必須
        name: string;
        email: string;
        createdAt?: Date | undefined;
        updatedAt?: Date | undefined;
      }>();
      expectTypeOf<Store>().toEqualTypeOf<{
        groupId: string;
        name: string;
        email: string;
        createdAt?: Date | undefined;
        updatedAt?: Date | undefined;
      }>();
      expectTypeOf<Create>().toEqualTypeOf<{
        name: string;
        email: string;
      }>();
    });

    it("fieldKeys なし: nonPathKeySchema / identity schemas の z.infer が期待通り", () => {
      const noFieldKeys = collectionConfig({
        path: "/teams/:teamId/users/:userId" as const,
        fieldKeys: [] as const,
        schema: z.object({
          userId: z.string(),
          teamId: z.string(),
          name: z.string(),
        }),
      });
      void noFieldKeys;

      type DocumentPath = z.infer<
        (typeof noFieldKeys)["documentPathSchema"]
      >;
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
        IntrinsicSchema extends z.ZodObject<any>,
        Mutations extends Record<string, MutationFn<IntrinsicSchema>> = Record<
          string,
          never
        >,
        Queries extends Record<string, QueryFn> = Record<string, never>,
        CreateOmitKeys extends string = never,
      > = CollectionDefinition<
        Path,
        FieldKeys,
        IntrinsicSchema,
        Mutations,
        Queries,
        CreateOmitKeys
      > &
        CollectionConfigMethods<
          Path,
          FieldKeys,
          IntrinsicSchema,
          Mutations,
          Queries,
          CreateOmitKeys
        >;

      type CollectionConfigBareFn = <
        const Path extends string,
        const FieldKeys extends string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        IntrinsicSchema extends z.ZodObject<any>,
        Mutations extends Record<string, MutationFn<IntrinsicSchema>> = Record<
          string,
          never
        >,
        Queries extends Record<string, QueryFn> = Record<string, never>,
        CreateOmitKeys extends string = never,
      >() => CollectionConfigBare<
        Path,
        FieldKeys,
        IntrinsicSchema,
        Mutations,
        Queries,
        CreateOmitKeys
      >;

      type CollectionConfigFn = <
        const Path extends string,
        const FieldKeys extends string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        IntrinsicSchema extends z.ZodObject<any>,
        Mutations extends Record<string, MutationFn<IntrinsicSchema>> = Record<
          string,
          never
        >,
        Queries extends Record<string, QueryFn> = Record<string, never>,
        CreateOmitKeys extends string = never,
      >() => CollectionConfig<
        Path,
        FieldKeys,
        IntrinsicSchema,
        Mutations,
        Queries,
        CreateOmitKeys
      >;

      expectTypeOf<CollectionConfigFn>().toEqualTypeOf<CollectionConfigBareFn>();
    });
  });
});
