# @zodapp/zod-form-s3

zod-form のファイルの項目（`zf.file`）を S3 に保存する Resolver です。ブラウザで動きます。署名付き URL は、サーバー（[`@zodapp/zod-form-s3-node`](../zod-form-s3-node/README.ja.md)）が発行し、ブラウザが S3 に直接 PUT / GET します。

## 設定（共有の定義）

```ts
import type { S3FileConfig } from "@zodapp/zod-form-s3";

declare module "@zodapp/zod-form/file/types" {
  interface FileConfigRegistry {
    config: S3FileConfig<"s3", "workspace", { workspaceId: string }>;
  }
}

const avatar = zf.file().register(zf.file.registry, {
  label: "アバター画像",
  fileConfig: {
    type: "s3",
    contextId: "workspace",
    // サーバーは、この接頭辞（キー）で読み書きの認可をする
    getLocation: (ctx) => ({ prefix: `workspaces/${ctx.workspaceId}/avatars` }),
    mimeTypes: ["image/*"],
  },
});
```

## Resolver（ブラウザ）

```ts
import { createS3FileResolver, httpS3FileEndpoints } from "@zodapp/zod-form-s3";

const fileResolvers = [
  createS3FileResolver(
    httpS3FileEndpoints({
      baseUrl: "/api",
      headers: async () => ({ authorization: `Bearer ${await getIdToken()}` }),
    }),
  ),
];
```

- フォームの値は `s3:///{key}?mimeType=...` という文字列です（バケットは入りません）。`toStoredUrl` と `keyOfStoredUrl` で行き来できます
- サーバーのエンドポイントを HTTP 以外で呼ぶときは、`requestUploadUrl` / `requestDownloadUrl`（/ `requestDelete`）を直接渡します
