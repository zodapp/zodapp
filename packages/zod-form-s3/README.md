# @zodapp/zod-form-s3

[日本語](README.ja.md)

A resolver that stores zod-form file fields (`zf.externalFile`) in S3. It runs in the browser. Presigned URLs are issued by the server ([`@zodapp/zod-form-s3-node`](../zod-form-s3-node/README.md)), and the browser PUTs / GETs directly to S3.

## Config (shared definitions)

```ts
import type { S3FileConfig } from "@zodapp/zod-form-s3";

declare module "@zodapp/zod-form/file/types" {
  interface FileConfigRegistry {
    config: S3FileConfig<"s3", "workspace", { workspaceId: string }>;
  }
}

const avatar = zf.externalFile().register(zf.externalFile.registry, {
  label: "Avatar image",
  fileConfig: {
    type: "s3",
    contextId: "workspace",
    // The server authorizes reads and writes by this prefix (key)
    getLocation: (ctx) => ({ prefix: `workspaces/${ctx.workspaceId}/avatars` }),
    mimeTypes: ["image/*"],
  },
});
```

## Resolver (browser)

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

- The form value is a string of the form `s3:///{key}?mimeType=...` (the bucket is not included). Convert back and forth with `toStoredUrl` and `keyOfStoredUrl`
- To call the server endpoints over something other than HTTP, pass `requestUploadUrl` / `requestDownloadUrl` (/ `requestDelete`) directly
