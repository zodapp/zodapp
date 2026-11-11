/**
 * Web アプリ固有の ResolverContext 型定義
 *
 * file / externalKey で共有する context 型をここで管理する
 */
export type WebResolverContextMap = {
  workspace: { workspaceId: string };
};

export type WebResolverContextId = keyof WebResolverContextMap;

declare module "@zodapp/zod-form/resolverContext/types" {
  interface ResolverContextRegistry {
    map: WebResolverContextMap;
  }
}
