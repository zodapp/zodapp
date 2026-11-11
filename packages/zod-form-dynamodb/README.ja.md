# @zodapp/zod-form-dynamodb

zod-form の外部キーの項目（`zf.externalKey`）の選択肢を、`@zodapp/zod-dynamodb` の登録簿の名前付きクエリから読む Resolver です。ブラウザで動きます。

## 設定（共有の定義）

設定はブラウザとサーバーで共有する定義に置くので、ブラウザの API には依存させず、クエリの名前（`"グループ名.操作の名前"`）とパラメーターを作る関数を書きます。

```ts
import type { DynamoExternalKeyConfig } from "@zodapp/zod-form-dynamodb";

type Context = { workspace: { workspaceId: string } };

declare module "@zodapp/zod-form/externalKey/types" {
  interface ExternalKeyConfigRegistry {
    config: DynamoExternalKeyConfig<"dynamodb", "workspace", Context["workspace"]>;
  }
}

const assignee = zf.string().register(zf.externalKey.registry, {
  label: "担当者",
  externalKeyConfig: {
    type: "dynamodb",
    contextId: "workspace",
    query: "members.list",
    params: (ctx) => ({ workspaceId: ctx.workspaceId }),
    valueField: "email",
    labelField: "displayName", // または labelFormatter: (item) => ...
    filter: (item) => item.role !== "viewer", // クエリで表せない絞り込み
  },
});
```

## Resolver（ブラウザ）

```ts
import { createDynamoExternalKeyResolver } from "@zodapp/zod-form-dynamodb";

const externalKeyResolvers = [createDynamoExternalKeyResolver(api)]; // api は createClient の戻り値
```

- クエリに `live` があればリアルタイムで購読し、一覧が変われば選択肢も変わります
- `live` がなければ、ページをたどって全体を 1 回だけ読みます
- 表示は `labelFormatter`、`labelField`、`valueField` の順に使います。読んだ一覧から作るので、Get で個別には引きません
