# @zodapp/zod-form-s3-node

[日本語](README.ja.md)

The server side of [`@zodapp/zod-form-s3`](../zod-form-s3/README.md). It provides an Express router that issues presigned URLs, and signing helpers.

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
    context: (req) => resolveAuth(req), // 401 if null / undefined, or if it throws UnauthenticatedError
    canUpload: (auth, { key }) => canWrite(auth, workspaceOfKey(key)),
    canRead: (auth, { key }) => isMember(auth, workspaceOfKey(key)),
    // the delete endpoint is created only when canDelete is passed
  }),
);
```

- The endpoints are `POST /files/upload-url` (`{ prefix, contentType }` → `{ key, url }`), `POST /files/download-url` (`{ key }` → `{ url }`), and `POST /files/delete` (`{ key }`; only with `canDelete`). Paths can be changed with `paths`
- When `context` (or `canUpload` / `canRead` / `canDelete`) throws an error whose `name` is `"UnauthenticatedError"` (such as `UnauthenticatedError` of `@zodapp/zod-dynamodb-node`), the router returns 401 with `{ code: "UNAUTHENTICATED", message }`, the same as the zod-dynamodb router. It does not depend on that package. Other errors go to Express's error handler
- The server creates upload keys under the received prefix (`{prefix}/{UUID}`). Keys with empty segments, `.`, `..`, or control characters get a 400. Authorize by the key's prefix
- Browser PUTs do not compute a checksum, so create the S3Client with `requestChecksumCalculation: "WHEN_REQUIRED"`. For S3-compatible storage (such as S3Proxy), also specify `endpoint` and `forcePathStyle: true`
- For local storage, there is `signer.ensureBucket()`, which creates the bucket if it does not exist
