# @zodapp/zod-form-s3-node

[`@zodapp/zod-form-s3`](../zod-form-s3/README.ja.md) のサーバー側です。署名付き URL を発行する Express の router と、署名の補助を提供します。

```ts
import { S3Client } from "@aws-sdk/client-s3";
import { createS3FileRouter, createS3FileSigner } from "@zodapp/zod-form-s3-node";

const signer = createS3FileSigner({
  client: new S3Client({ requestChecksumCalculation: "WHEN_REQUIRED" }),
  bucket: "my-files",
});

app.use(express.json());
app.use(
  "/api",
  createS3FileRouter<Auth>({
    signer,
    context: (req) => resolveAuth(req), // null / undefined なら 401
    canUpload: (auth, { key }) => canWrite(auth, workspaceOfKey(key)),
    canRead: (auth, { key }) => isMember(auth, workspaceOfKey(key)),
    // canDelete を渡したときだけ、削除のエンドポイントを作る
  }),
);
```

- エンドポイントは `POST /files/upload-url`（`{ prefix, contentType }` → `{ key, url }`）、`POST /files/download-url`（`{ key }` → `{ url }`）、`POST /files/delete`（`{ key }`。`canDelete` があるときだけ）です。パスは `paths` で変えられます
- アップロードのキーは、受け取った接頭辞の下にサーバーが作ります（`{prefix}/{UUID}`）。空の区切り、`.`、`..`、制御文字を含むキーは 400 にします。認可はキーの接頭辞で判定してください
- ブラウザの PUT は checksum を計算しないので、S3Client は `requestChecksumCalculation: "WHEN_REQUIRED"` で作ります。S3 互換のストレージ（S3Proxy など）では `endpoint` と `forcePathStyle: true` も指定します
- ローカルのストレージ向けに、バケットがなければ作る `signer.ensureBucket()` があります
