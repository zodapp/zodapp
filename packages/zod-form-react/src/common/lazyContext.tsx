import React, { createContext, useContext } from "react";

/**
 * 動的 import から React コンポーネントを生成するためのファクトリ関数型。
 *
 * デフォルト実装は `React.lazy()` を使いますが、環境に応じて差し替え可能です。
 * `importFn` は `{ component }` もしくはその Promise を返します。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LazyComponentFactory = <T extends React.ComponentType<any>>(
  importFn: () => Promise<{ component: T }> | { component: T },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => React.ComponentType<any>;

// デフォルトはReact.lazy
const defaultLazyFactory: LazyComponentFactory = (importFn) => {
  return React.lazy(async () => {
    const def = await importFn();
    return { default: def.component };
  });
};

const LazyContext = createContext<LazyComponentFactory>(defaultLazyFactory);

/**
 * `Dynamic` 等で使う lazy factory を Context で提供します。
 *
 * `lazyFactory` を差し替えることで、Suspense 以外の遅延ロード戦略も選べます。
 */
export const LazyProvider = ({
  children,
  lazyFactory,
}: {
  children: React.ReactNode;
  lazyFactory: LazyComponentFactory;
}) => {
  return (
    <LazyContext.Provider value={lazyFactory}>{children}</LazyContext.Provider>
  );
};

/**
 * `LazyProvider` が提供する lazy factory を取得します。
 */
export const useLazyFactory = () => useContext(LazyContext);
