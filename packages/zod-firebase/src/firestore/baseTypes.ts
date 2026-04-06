import { z } from "zod";

/**
 * `collectionConfig()` の戻り値として扱える最低限の構造を表す base interface。
 *
 * zod-firebase(-browser/node) の各種ユーティリティが「具体的な generics を知らなくても」
 * collectionConfig 生成物として扱うための共通インターフェースです。
 */
export interface CollectionConfigBase {
  // スキーマ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly dataSchema: z.ZodType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly storeSchema: z.ZodType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly updateSchema: z.ZodType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly createSchema: z.ZodType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly createExcludedSchema?: z.ZodObject<any>;

  // Identity スキーマ（単体 / path / identity）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentKeySchema: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly nonPathKeySchema: z.ZodObject<any> | z.ZodUnknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentIdentitySchema: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionIdentitySchema: z.ZodObject<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionKeySchema: z.ZodType<any>;

  // pathUtils から引き継ぐプロパティ
  readonly path: string;
  readonly documentPathKeys: readonly string[];
  readonly collectionKeys: readonly string[];
  readonly documentKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentPathSchema: z.ZodType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionPathSchema: z.ZodType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly buildDocumentPath: (params: any) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly buildCollectionPath: (params: any) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly parseDocumentPath: (path: string) => any;

  // メタ情報
  readonly fieldKeys: readonly string[];
  readonly nonPathKeys: readonly string[];
  readonly documentIdentityKeys: readonly string[];
  readonly collectionIdentityKeys: readonly string[];

  // ライフサイクル関数
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onInit?: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly beforeGenerate: (documentIdentity: any, inputData: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly beforeWrite: (documentIdentity: any, data: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly checkNonPathKeys: (
    data: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identityParams: any,
  ) => boolean;

  // CollectionDefinition から引き継ぐプロパティ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly schema: z.ZodType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onCreateId?: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collectionIdentity: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputData: any,
  ) => string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onCreate?: (documentIdentity: any, inputData: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onWrite?: (documentIdentity: any, data: any) => any;
}

/**
 * `CollectionConfigBase` の緩い版。
 *
 * 主に型ユーティリティ/境界で「最小限の構造だけを要求したい」場合に使います。
 * `any` を許容するため、アプリ側での直接利用は推奨しません。
 */
export interface LooseCollectionConfigBase {
  // スキーマ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly dataSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly storeSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly updateSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly createSchema: any;

  // Identity スキーマ（単体 / path / identity）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentKeySchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly nonPathKeySchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentIdentitySchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionIdentitySchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionKeySchema: any;

  // pathUtils から引き継ぐプロパティ
  readonly path: string;
  readonly documentPathKeys: readonly string[];
  readonly collectionKeys: readonly string[];
  readonly documentKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly documentPathSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly collectionPathSchema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly buildDocumentPath: (params: any) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly buildCollectionPath: (params: any) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly parseDocumentPath: (path: string) => any;

  // メタ情報
  readonly fieldKeys: readonly string[];
  readonly nonPathKeys: readonly string[];
  readonly documentIdentityKeys: readonly string[];
  readonly collectionIdentityKeys: readonly string[];

  // ライフサイクル関数
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onInit?: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly beforeGenerate: (documentIdentity: any, inputData: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly beforeWrite: (documentIdentity: any, data: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly checkNonPathKeys: (
    data: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    identityParams: any,
  ) => boolean;

  // CollectionDefinition から引き継ぐプロパティ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly schema: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onCreateId?: (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collectionIdentity: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputData: any,
  ) => string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onCreate?: (documentIdentity: any, inputData: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly onWrite?: (documentIdentity: any, data: any) => any;
}
