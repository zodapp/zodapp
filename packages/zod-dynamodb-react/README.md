# @zodapp/zod-dynamodb-react

[日本語](README.ja.md)

React hooks that read lists and items from `@zodapp/zod-dynamodb-client` (the specification is [Browser API](../zod-dynamodb-client/docs/client-api.md)). Supports React 18 and 19.

Create hooks outside components by partially applying API functions.

```tsx
import {
  ApiProvider,
  createUseItem,
  createUseList,
  useApi,
} from "@zodapp/zod-dynamodb-react";

// Realtime (queries marked live in the registry). Remove { live: true } for a one-off fetch
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
  const api = useApi(); // the API with the authentication context bound
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
          Load more
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

- The hooks only read the client's stores with `useSyncExternalStore`. State management belongs to the stores
- Stores are not created during rendering; they are created when a component subscribes, and closed when none remain. Even in StrictMode, only one opened store remains in the end
- `params` and `options` (`key` for `useTask`) are compared by value. Even if you pass new objects every time, nothing is recreated when the values are the same
- `ApiProvider` passes an API with the authentication context bound (`bind`) to its children. Use the API from `useApi()` for `can` during rendering. Calling `useApi()` outside `ApiProvider` is an error

## License

MIT ([`LICENSE`](../../LICENSE))
