import type {
  RegisteredResolverContext,
  RegisteredResolverContextMap,
} from "./types";

export function getResolverContextSlice(
  resolverContext: RegisteredResolverContext | undefined,
): undefined;
export function getResolverContextSlice<
  TId extends string,
>(
  resolverContext: RegisteredResolverContext | undefined,
  contextId: TId,
): (
  TId extends keyof RegisteredResolverContextMap
    ? RegisteredResolverContextMap[TId]
    : unknown
) | undefined;
export function getResolverContextSlice<
  TId extends string,
>(
  resolverContext: RegisteredResolverContext | undefined,
  contextId: TId | undefined,
): (
  TId extends keyof RegisteredResolverContextMap
    ? RegisteredResolverContextMap[TId]
    : unknown
) | undefined;
export function getResolverContextSlice(
  resolverContext: RegisteredResolverContext | undefined,
  contextId?: string,
) {
  if (contextId === undefined) {
    return undefined;
  }
  return resolverContext?.[contextId as keyof RegisteredResolverContextMap];
}

export const getRequiredResolverContextSlice = <TContext = unknown>(
  resolverContext: RegisteredResolverContext | undefined,
  contextId: string,
): TContext => {
  const context = getResolverContextSlice(resolverContext, contextId);
  if (context === undefined) {
    throw new Error(`resolverContext["${contextId}"] is required`);
  }
  return context as TContext;
};
