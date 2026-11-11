import { describe, expect, it, vi } from "vitest";
import { httpS3FileEndpoints } from "./endpoints";
import { createS3FileResolver } from "./resolver";
import { keyOfStoredUrl, toStoredUrl } from "./storedUrl";

const resolverContext = { workspace: { workspaceId: "w1" } } as never;
const config = {
  type: "s3" as const,
  contextId: "workspace",
  getLocation: (ctx: { workspaceId: string }) => ({
    prefix: `workspaces/${ctx.workspaceId}/avatars`,
  }),
};

const okResponse = (body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("保存する文字列", () => {
  it("キーと mimeType を行き来できる", () => {
    const stored = toStoredUrl("workspaces/w1/a b/x.png", "image/png");
    expect(stored).toBe("s3:///workspaces/w1/a%20b/x.png?mimeType=image%2Fpng");
    expect(keyOfStoredUrl(stored)).toBe("workspaces/w1/a b/x.png");
  });

  it("s3: でない文字列はエラー", () => {
    expect(() => keyOfStoredUrl("gs://bucket/x")).toThrow(/not an S3/);
  });
});

describe("createS3FileResolver", () => {
  it("接頭辞で URL を求め、S3 に PUT して、保存する文字列を返す", async () => {
    const requestUploadUrl = vi.fn(async () => ({
      key: "workspaces/w1/avatars/k1",
      url: "https://s3.example/put",
    }));
    const fetch = vi.fn(async () => new Response(null, { status: 200 }));
    const result = createS3FileResolver({
      requestUploadUrl,
      requestDownloadUrl: async () => ({ url: "" }),
      fetch,
    }).resolver(config, resolverContext);

    const file = new File(["hello"], "a.png", { type: "image/png" });
    await expect(result.upload(file)).resolves.toEqual({
      url: "s3:///workspaces/w1/avatars/k1?mimeType=image%2Fpng",
    });
    expect(requestUploadUrl).toHaveBeenCalledWith({
      prefix: "workspaces/w1/avatars",
      contentType: "image/png",
    });
    expect(fetch).toHaveBeenCalledWith("https://s3.example/put", {
      method: "PUT",
      body: file,
      headers: { "content-type": "image/png" },
    });
    expect(result.delete).toBeUndefined();
  });

  it("PUT が失敗したらエラー", async () => {
    const result = createS3FileResolver({
      requestUploadUrl: async () => ({ key: "k", url: "https://s3.example/put" }),
      requestDownloadUrl: async () => ({ url: "" }),
      fetch: async () => new Response(null, { status: 403 }),
    }).resolver(config, resolverContext);
    await expect(result.upload(new File(["x"], "x"))).rejects.toThrow(/403/);
  });

  it("ダウンロードと削除は、保存した文字列からキーを取り出して求める", async () => {
    const requestDownloadUrl = vi.fn(async () => ({ url: "https://s3.example/get" }));
    const requestDelete = vi.fn(async () => {});
    const result = createS3FileResolver({
      requestUploadUrl: async () => ({ key: "", url: "" }),
      requestDownloadUrl,
      requestDelete,
    }).resolver(config, resolverContext);
    const stored = toStoredUrl("workspaces/w1/avatars/k1", "image/png");
    await expect(result.getDownloadUrl(stored)).resolves.toEqual({
      url: "https://s3.example/get",
    });
    expect(requestDownloadUrl).toHaveBeenCalledWith("workspaces/w1/avatars/k1");
    await result.delete!(stored);
    expect(requestDelete).toHaveBeenCalledWith("workspaces/w1/avatars/k1");
  });
});

describe("httpS3FileEndpoints", () => {
  it("既定のパスに、ヘッダーを付けて POST する", async () => {
    const fetch = vi.fn(async () => okResponse({ key: "k", url: "u" }));
    const endpoints = httpS3FileEndpoints({
      baseUrl: "/api",
      headers: async () => ({ authorization: "Bearer t" }),
      fetch,
    });
    await endpoints.requestUploadUrl({ prefix: "p", contentType: "text/plain" });
    await endpoints.requestDownloadUrl("p/k");
    expect(fetch.mock.calls).toEqual([
      [
        "/api/files/upload-url",
        {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer t" },
          body: JSON.stringify({ prefix: "p", contentType: "text/plain" }),
        },
      ],
      [
        "/api/files/download-url",
        {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer t" },
          body: JSON.stringify({ key: "p/k" }),
        },
      ],
    ]);
    expect(endpoints.requestDelete).toBeUndefined();
  });

  it("エラーの応答はエラーにする", async () => {
    const endpoints = httpS3FileEndpoints({
      fetch: async () => new Response("no", { status: 403 }),
    });
    await expect(endpoints.requestDownloadUrl("k")).rejects.toThrow(/403 no/);
  });
});
