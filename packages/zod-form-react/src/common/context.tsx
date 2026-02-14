import React, { createContext, useMemo } from "react";
import type { ZodForm } from "../utils/type";
import { getMeta } from "@zodapp/zod-form";
import type {
  ExternalKeyResolvers,
  ExternalKeyResolverResult,
  BaseExternalKeyConfig,
} from "@zodapp/zod-form/externalKey/types";
import type {
  FileResolvers,
  FileResolverResult,
  BaseFileConfig,
} from "@zodapp/zod-form/file/types";
import type { MediaResolvers } from "../media/types";
import { basicMediaResolvers } from "../mediaResolvers";

/**
 * 動的ローダ（Dynamic loader）の型。
 *
 * コンポーネント定義 `{ component }` もしくはその Promise を返します。
 * `ComponentLibrary` の各エントリはこの型で表現され、必要に応じて遅延ロードされます。
 */
export type DynamicZodFormDef =
  () => // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { component: React.ComponentType<any> }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | Promise<{ component: React.ComponentType<any> }>;

/**
 * UI コンポーネントを meta などのキーで引けるライブラリ。
 *
 * key は `meta.uiType` や `meta.typeName` 等の識別子を想定し、
 * value はコンポーネント定義を返す `DynamicZodFormDef` です。
 */
export type ComponentLibrary = Record<string, DynamicZodFormDef>;

type ZodFormContextType = {
  componentLibrary: ComponentLibrary;
  loadingComponent: ZodForm;
  notFoundComponent: ZodForm;
  externalKeyResolvers?: ExternalKeyResolvers;
  fileResolvers?: FileResolvers;
  mediaResolvers?: MediaResolvers;
  /** タイムゾーン（timestamp encoding 時に使用） */
  timezone: string;
};

/** ブラウザのローカルタイムゾーンを取得 */
const getDefaultTimezone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

const ZodFormContext = createContext<ZodFormContextType>({
  componentLibrary: {},
  loadingComponent: (props) => {
    const meta = getMeta(props.schema);
    return <div>Loading...</div>;
  },
  notFoundComponent: ({ schema }) => {
    const meta = getMeta(schema);
    return (
      <div>
        Component not found for meta.typeName: {meta?.typeName}, meta.uiType:{" "}
        {meta?.uiType}, schema.type: {meta?.typeName ?? schema.type}
      </div>
    );
  },
  timezone: getDefaultTimezone(),
});

/**
 * ZodForm の実行コンテキスト（ComponentLibrary / resolvers / timezone など）を提供します。
 *
 * `merge=true` の場合、親の `componentLibrary` に対して差分をマージできます。
 */
export const ZodFormContextProvider = ({
  componentLibrary,
  loadingComponent,
  notFoundComponent,
  externalKeyResolvers,
  fileResolvers,
  mediaResolvers,
  timezone,
  children,
  merge,
}: {
  loadingComponent?: ZodForm;
  notFoundComponent?: ZodForm;
  externalKeyResolvers?: ExternalKeyResolvers;
  fileResolvers?: FileResolvers;
  mediaResolvers?: MediaResolvers;
  /** タイムゾーン（省略時はブラウザのローカルTZ） */
  timezone?: string;
  children: React.ReactNode;
  merge?: boolean;
} & (
  | { componentLibrary: ComponentLibrary }
  | {
      componentLibrary?: ComponentLibrary;
      merge: true;
    }
)) => {
  const parentContext = React.useContext(ZodFormContext);
  const mergedContext = {
    componentLibrary: merge
      ? {
          ...parentContext.componentLibrary,
          ...componentLibrary,
        }
      : componentLibrary,
    loadingComponent: loadingComponent || parentContext.loadingComponent,
    notFoundComponent: notFoundComponent || parentContext.notFoundComponent,
    externalKeyResolvers:
      externalKeyResolvers ?? parentContext.externalKeyResolvers,
    fileResolvers: fileResolvers ?? parentContext.fileResolvers,
    mediaResolvers: mediaResolvers ?? parentContext.mediaResolvers,
    timezone: timezone ?? parentContext.timezone,
  };
  return (
    <ZodFormContext.Provider value={mergedContext}>
      {children}
    </ZodFormContext.Provider>
  );
};

/**
 * `ZodFormContextProvider` が提供するコンテキスト値を取得します。
 */
export const useZodFormContext = () => {
  return React.useContext(ZodFormContext);
};

/**
 * 配列形式のResolversをMapに変換するヘルパー
 */
function resolversToMap<T extends { type: string }>(
  resolvers: T[],
): Map<string, T> {
  return new Map(resolvers.map((entry) => [entry.type, entry]));
}

/**
 * 外部キーResolverを取得するフック
 * configのtypeからresolverを取得し、resolverを呼び出してExternalKeyResolverResultを返す
 * @throws resolverが見つからない場合、またはexternalKeyResolversが未設定の場合
 */
export const useExternalKeyResolver = <
  TConfig extends BaseExternalKeyConfig = BaseExternalKeyConfig,
>(
  config: TConfig,
): ExternalKeyResolverResult => {
  const { externalKeyResolvers } = useZodFormContext();

  // 配列をMapに変換（メモ化）
  const resolversMap = useMemo(
    () => (externalKeyResolvers ? resolversToMap(externalKeyResolvers) : null),
    [externalKeyResolvers],
  );

  if (!resolversMap) {
    throw new Error(
      "externalKeyResolvers is not configured in ZodFormContextProvider",
    );
  }

  const entry = resolversMap.get(config.type);

  if (!entry) {
    throw new Error(
      `ExternalKeyResolver for type "${config.type}" not found in externalKeyResolvers`,
    );
  }

  return entry.resolver(config);
};

/**
 * ファイルResolverを取得するフック
 * configのtypeからresolverを取得し、resolverを呼び出してFileResolverResultを返す
 * @throws resolverが見つからない場合、またはfileResolversが未設定の場合
 */
export const useFileResolver = <
  TConfig extends BaseFileConfig = BaseFileConfig,
>(
  config: TConfig,
): FileResolverResult => {
  const { fileResolvers } = useZodFormContext();

  // 配列をMapに変換（メモ化）
  const resolversMap = useMemo(
    () => (fileResolvers ? resolversToMap(fileResolvers) : null),
    [fileResolvers],
  );

  if (!resolversMap) {
    throw new Error(
      "fileResolvers is not configured in ZodFormContextProvider",
    );
  }

  const entry = resolversMap.get(config.type);

  if (!entry) {
    throw new Error(
      `FileResolver for type "${config.type}" not found in fileResolvers`,
    );
  }

  return entry.resolver(config);
};

/**
 * mediaResolversを取得するフック
 * Contextで指定されていればそれを使用、なければデフォルトを返す
 */
export const useMediaResolvers = (): MediaResolvers => {
  const { mediaResolvers } = useZodFormContext();
  return mediaResolvers ?? basicMediaResolvers;
};
