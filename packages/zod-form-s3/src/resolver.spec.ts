import { describe, expect, it, vi } from "vitest";
import { httpS3FileEndpoints } from "./endpoints";
import { isS3FileError, S3FileError } from "./errors";
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
    const error = await result.upload(new File(["x"], "x")).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(S3FileError);
    expect(error).toMatchObject({ code: "UPLOAD_FAILED", status: 403, message: "upload failed: 403" });
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

  it("credentials を渡すと、サーバーへの fetch に付ける", async () => {
    const fetch = vi.fn(async () => okResponse({ url: "u" }));
    await httpS3FileEndpoints({ credentials: "include", fetch }).requestDownloadUrl("k");
    expect(fetch).toHaveBeenCalledWith("/files/download-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ key: "k" }),
    });
  });

  it("サーバーの { code, message } の応答は、そのコードとステータスのエラーにする", async () => {
    const endpoints = httpS3FileEndpoints({
      fetch: async () =>
        new Response(JSON.stringify({ code: "UNAUTHENTICATED", message: "expired" }), {
          status: 401,
        }),
    });
    const error = await endpoints.requestDownloadUrl("k").catch((e: unknown) => e);
    expect(isS3FileError(error, "UNAUTHENTICATED")).toBe(true);
    expect(isS3FileError(error, "FORBIDDEN")).toBe(false);
    expect(error).toMatchObject({
      status: 401,
      message: "/files/download-url: 401 UNAUTHENTICATED expired",
    });
  });

  it("形の違うエラーの応答は UNEXPECTED_RESPONSE", async () => {
    const endpoints = httpS3FileEndpoints({
      fetch: async () => new Response("no", { status: 403 }),
    });
    await expect(endpoints.requestDownloadUrl("k")).rejects.toMatchObject({
      code: "UNEXPECTED_RESPONSE",
      status: 403,
      message: "/files/download-url: 403 no",
    });
  });

  it("成功でも JSON でない応答は UNEXPECTED_RESPONSE", async () => {
    const endpoints = httpS3FileEndpoints({
      fetch: async () => new Response("<html>", { status: 200 }),
    });
    await expect(endpoints.requestDownloadUrl("k")).rejects.toMatchObject({
      code: "UNEXPECTED_RESPONSE",
      status: 200,
    });
  });

  it("通信の失敗は NETWORK", async () => {
    const cause = new TypeError("failed to fetch");
    const endpoints = httpS3FileEndpoints({
      fetch: async () => {
        throw cause;
      },
    });
    const error = await endpoints.requestDownloadUrl("k").catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "NETWORK", status: undefined, cause });
  });
});
