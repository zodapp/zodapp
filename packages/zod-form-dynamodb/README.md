# @zodapp/zod-form-dynamodb

[日本語](README.ja.md)

A resolver that reads the options of zod-form foreign key fields (`zf.externalKey`) from a named query in the `@zodapp/zod-dynamodb` registry. It runs in the browser.

## Config (shared definitions)

The config lives in the definitions shared by the browser and the server, so it does not depend on the browser API. Instead, you write the query name (`"group.operation"`) and a function that builds the parameters.

```ts
import type { DynamoExternalKeyConfig } from "@zodapp/zod-form-dynamodb";

type Context = { workspace: { workspaceId: string; showViewers: boolean } };

declare module "@zodapp/zod-form/externalKey/types" {
  interface ExternalKeyConfigRegistry {
    config: DynamoExternalKeyConfig<"dynamodb", "workspace", Context["workspace"]>;
  }
}

const assignee = zf.string().register(zf.externalKey.registry, {
  label: "Assignee",
  externalKeyConfig: {
    type: "dynamodb",
    contextId: "workspace",
    query: "members.list",
    params: (ctx) => ({ workspaceId: ctx.workspaceId }),
    valueField: "email",
    labelField: "displayName", // or labelFormatter: (item) => ...
    filter: (item, ctx) => item.role !== "viewer" || ctx.showViewers, // filtering the query cannot express; ctx is the same as for params
  },
});
```

## Resolver (browser)

```ts
import { createDynamoExternalKeyResolver } from "@zodapp/zod-form-dynamodb";

const externalKeyResolvers = [createDynamoExternalKeyResolver(api)]; // api is the return value of createClient
```

- If the query has `live`, it subscribes in realtime, and the options change when the list changes
- Without `live`, it follows the pages and reads the whole list once
- When the store becomes `error`, it calls `onError`. The field goes into the error state and shows "Retry"
- The display uses `labelFormatter`, `labelField`, and `valueField`, in that order. It is built from the list that was read, so items are not fetched individually with Get
- `filter` receives the same resolverContext as `params`. Conditions that depend on the context can be read here, so you do not need to swap the config. When the context values change, the options are fetched again
- When you swap functions in the config (`filter`, `labelFormatter`) with `zf.dynamic`, write a `key` in the config to express the difference. Functions are not part of the key that decides whether to fetch again
