import { z } from "zod";

// 最後のドキュメントキーを取得
export type DocumentKeyFromPath<Path extends string> =
  Path extends `${string}/:${infer Key}/${infer Rest}`
    ? DocumentKeyFromPath<`/${Rest}`>
    : Path extends `${string}/:${infer Key}`
      ? Key
      : never;

// 最後以外のコレクションキー（中間のドキュメントID）を取得
export type CollectionPathKeyFromPath<Path extends string> =
  Path extends `${string}/:${infer Key}/${infer Rest}`
    ? Rest extends `${string}/:${string}/${string}` | `${string}/:${string}`
      ? Key | CollectionPathKeyFromPath<`/${Rest}`>
      : never
    : never;

export type DocumentPathKeyFromPath<Path extends string> =
  | CollectionPathKeyFromPath<Path>
  | DocumentKeyFromPath<Path>;

export type DocumentPathParamsFromPath<Path extends string> = Record<
  DocumentPathKeyFromPath<Path>,
  string
>;
export type CollectionPathParamsFromPath<Path extends string> = Record<
  CollectionPathKeyFromPath<Path>,
  string
>;

type ZodStringShape<K extends string> = { [P in K]: z.ZodString };

export const compilePath = <T extends string>(documentPathTemplate: T) => {
  type DocumentPathParams = DocumentPathParamsFromPath<T>;
  type DocumentPathKeys = DocumentPathKeyFromPath<T>;
  type DocumentKey = DocumentKeyFromPath<T>;
  type CollectionPathKey = CollectionPathKeyFromPath<T>;
  type CollectionPathParams = Record<CollectionPathKey, string>;
  const documentPathKeys = documentPathTemplate
    .split("/")
    .filter((key) => key.startsWith(":"))
    .map((key) => key.slice(1)) as DocumentPathKeys[];
  const documentKey = documentPathKeys.slice(-1)[0] as DocumentKey;
  const collectionPathKeys = documentPathKeys.slice(
    0,
    -1,
  ) as CollectionPathKey[];
  const pathRegex = new RegExp(
    documentPathTemplate
      .replace(/^\//, "\\/?")
      .replace(/:(\w+)/g, "(?<$1>[^/]+)"),
  );
  const documentPathSchema = z.object(
    Object.fromEntries(
      documentPathKeys.map((key) => [key, z.string()]),
    ) as unknown as ZodStringShape<DocumentPathKeys>,
  ) as z.ZodObject<ZodStringShape<DocumentPathKeys>>;
  const collectionPathTemplate = documentPathTemplate.replace(
    `/:${documentKey}`,
    "",
  );

  const collectionPathSchema = z.object(
    Object.fromEntries(
      collectionPathKeys.map((key) => [key, z.string()]),
    ) as unknown as ZodStringShape<CollectionPathKey>,
  ) as z.ZodObject<ZodStringShape<CollectionPathKey>>;

  // documentKeySchema: documentKeyのみ
  const documentKeySchema = z.object({
    [documentKey]: z.string(),
  }) as z.ZodObject<{ [K in DocumentKey]: z.ZodString }>;

  return {
    documentKey,
    collectionKeys: collectionPathKeys,
    documentPathKeys,
    collectionPathKeys,
    documentKeySchema,
    documentPathSchema,
    collectionPathSchema,
    buildDocumentPath: (params: DocumentPathParamsFromPath<T>): string => {
      const parsedParams = documentPathSchema.parse(
        params,
      ) as DocumentPathParams;
      return documentPathTemplate.replace(
        /:(\w+)/g,
        (match: string, p1: DocumentPathKeys) => {
          return parsedParams[p1] || match;
        },
      );
    },
    buildCollectionPath: (params: CollectionPathParams): string => {
      return collectionPathTemplate.replace(
        /:(\w+)/g,
        (match: string, p1: CollectionPathKey) => {
          return params[p1] || match;
        },
      );
    },
    parseDocumentPath: (path: string): DocumentPathParamsFromPath<T> | null => {
      const match = path.match(pathRegex);
      if (!match) {
        return null;
      }
      const params = Object.fromEntries(
        documentPathKeys.map((key: string, index: number) => {
          return [key, match[index + 1]];
        }),
      ) as DocumentPathParamsFromPath<T>;
      return documentPathSchema.parse(params) as DocumentPathParamsFromPath<T>;
    },
  };
};
