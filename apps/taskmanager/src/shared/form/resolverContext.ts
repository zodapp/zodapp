/**
 * zod-form の resolverContext の型（file / externalKey で共有する）
 */
export type AppResolverContextMap = {
  workspace: { workspaceId: string };
};

export type AppResolverContextId = keyof AppResolverContextMap;

declare module "@zodapp/zod-form/resolverContext/types" {
  interface ResolverContextRegistry {
    map: AppResolverContextMap;
  }
}
