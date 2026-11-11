# @zodapp/zod-dynamodb-react

`@zodapp/zod-dynamodb-client` の一覧と Item を読む React の hooks です（設計は [docs/design.md](../../docs/zod-dynamodb/design.md) の §7.8）。React 18 と 19 に対応します。

API の関数を部分適用した hook を、コンポーネントの外で作ります。

```tsx
import {
  ApiProvider,
  createUseItem,
  createUseList,
  useApi,
} from "@zodapp/zod-dynamodb-react";

// リアルタイム（登録簿で live を付けたクエリ）。{ live: true } を外すと 1 回きりの取得になる
export const useTodos = createUseList(api.tasks.byStatus, { live: true });
export const useTask = createUseItem(api.tasks.get);

const Root = () => (
  <ApiProvider api={api} context={auth}>
    <TaskList workspaceId="ws1" />
  </ApiProvider>
);

const TaskList = ({ workspaceId }: { workspaceId: string }) => {
  const { status, items, hasMore, isFetchingMore, fetchMore, error } = useTodos(
    { workspaceId, status: "todo" },
    { pageSize: 50 },
  );
  const api = useApi(); // 認証コンテキストを bind した API
  if (status === "loading") return <Spinner />;
  if (status === "error") return <ErrorView error={error} />;
  return (
    <>
      {items.map((t) => (
        <TaskRow
          key={t.taskId}
          task={t}
          canFinish={
            api.tasks.setStatus.can(
              { workspaceId: t.workspaceId, taskId: t.taskId },
              { status: "done" },
              { item: t },
            ).ok
          }
        />
      ))}
      {hasMore && (
        <button disabled={isFetchingMore} onClick={fetchMore}>
          もっと見る
        </button>
      )}
    </>
  );
};

const TaskDetail = ({
  taskKey,
}: {
  taskKey: { workspaceId: string; taskId: string };
}) => {
  const { status, item, token, reload } = useTask(taskKey);
  // ...
};
```

- hooks は Client の store を `useSyncExternalStore` で読むだけです。状態の管理は store が持ちます
- store は描画中には作らず、コンポーネントが購読したときに作り、いなくなったら閉じます。StrictMode でも、開いた store は最後に 1 つだけ残ります
- `params` と `options`（`useTask` では `key`）は値で比べます。毎回新しいオブジェクトを渡しても、値が同じなら作り直しません
- `ApiProvider` は、認証コンテキストを `bind` した API を子に渡します。描画中の `can` には `useApi()` の API を使ってください。`ApiProvider` の外で `useApi()` を呼ぶとエラーになります
