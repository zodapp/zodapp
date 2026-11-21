# @zodapp/zod-form-s3

[English](README.md)

zod-form のファイルの項目（`zf.externalFile`）を S3 に保存する Resolver です。ブラウザで動きます。署名付き URL は、サーバー（[`@zodapp/zod-form-s3-node`](../zod-form-s3-node/README.ja.md)）が発行し、ブラウザが S3 に直接 PUT / GET します。

## 設定（共有の定義）

```ts
import type { S3FileConfig } from "@zodapp/zod-form-s3";

declare module "@zodapp/zod-form/file/types" {
  interface FileConfigRegistry {
    config: S3FileConfig<"s3", "workspace", { workspaceId: string }>;
  }
}

const avatar = zf.externalFile().register(zf.externalFile.registry, {
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
      // 省略できる。非同期でもよい。別のオリジンに Cookie を送るときは credentials: "include"
      headers: async () => ({ authorization: `Bearer ${await getToken()}` }),
    }),
  ),
];
```

- フォームの値は `s3:///{key}?mimeType=...` という文字列です（バケットは入りません）。`toStoredUrl` と `keyOfStoredUrl` で行き来できます
- 失敗すると、`code` と `status` を持つ `S3FileError` を投げます。`code` はサーバーのコード（`UNAUTHENTICATED`・`FORBIDDEN`・`INVALID_INPUT` など）、`{ code, message }` の形でない応答なら `UNEXPECTED_RESPONSE`、送れなければ `NETWORK`、S3 への PUT の失敗なら `UPLOAD_FAILED` です。`isS3FileError(error, "UNAUTHENTICATED")` で判定できます（トークンを更新してやり直すときなど）
- サーバーのエンドポイントを HTTP 以外で呼ぶときは、`requestUploadUrl` / `requestDownloadUrl`（/ `requestDelete`）を直接渡します
