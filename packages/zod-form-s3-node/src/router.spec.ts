import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { S3Client } from "@aws-sdk/client-s3";
import { httpS3FileEndpoints } from "@zodapp/zod-form-s3";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { isSafeKey, newKeyUnder } from "./keys";
import { createS3FileRouter } from "./router";
import { createS3FileSigner, type S3FileSigner } from "./signer";

type Auth = { userId: string; workspaces: string[] };

const workspaceOfKey = (key: string) => /^workspaces\/([^/]+)\//.exec(key)?.[1];

const signer: S3FileSigner = {
  bucket: "b",
  signUpload: vi.fn(async (key: string, type: string) => `put:${key}:${type}`),
  signDownload: vi.fn(async (key: string) => `get:${key}`),
  deleteObject: vi.fn(async () => {}),
  ensureBucket: async () => "exists",
};

let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createS3FileRouter<Auth>({
      signer,
      context: (req) => {
        const user = req.header("x-user");
        return user ? { userId: user, workspaces: ["w1"] } : undefined;
      },
      canUpload: (auth, { key }) => auth.workspaces.includes(workspaceOfKey(key) ?? ""),
      canRead: (auth, { key }) => auth.workspaces.includes(workspaceOfKey(key) ?? ""),
      canDelete: (auth, { key }) => key.startsWith(`workspaces/w1/users/${auth.userId}/`),
      allowContentType: (type) => type.startsWith("image/"),
    }),
  );
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => {
  server.close();
});

const endpoints = (user?: string) =>
  httpS3FileEndpoints({
    baseUrl: base,
    headers: (): Record<string, string> => (user ? { "x-user": user } : {}),
    enableDelete: true,
  });

const post = (path: string, body: unknown, user = "u1") =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user": user },
    body: JSON.stringify(body),
  });

describe("createS3FileRouter", () => {
  it("接頭辞の下にキーを作り、署名付き URL を返す", async () => {
    const out = await endpoints("u1").requestUploadUrl({
      prefix: "workspaces/w1/avatars/",
      contentType: "image/png",
    });
    expect(out.key).toMatch(/^workspaces\/w1\/avatars\/[0-9a-f-]{36}$/);
    expect(out.url).toBe(`put:${out.key}:image/png`);
  });

  it("認証コンテキストがなければ 401", async () => {
    await expect(
      endpoints().requestUploadUrl({ prefix: "workspaces/w1/a", contentType: "image/png" }),
    ).rejects.toThrow(/401/);
  });

  it("認可されない接頭辞は 403", async () => {
    await expect(
      endpoints("u1").requestUploadUrl({ prefix: "workspaces/w2/a", contentType: "image/png" }),
    ).rejects.toThrow(/403/);
  });

  it("許さない content-type と、`..` を含む接頭辞は 400", async () => {
    expect((await post("/files/upload-url", { prefix: "workspaces/w1/a", contentType: "text/html" })).status).toBe(400);
    expect((await post("/files/upload-url", { prefix: "workspaces/w1/../w2", contentType: "image/png" })).status).toBe(400);
    expect((await post("/files/upload-url", { prefix: 1 })).status).toBe(400);
  });

  it("読めるキーだけ、ダウンロードの URL を返す", async () => {
    await expect(endpoints("u1").requestDownloadUrl("workspaces/w1/a/k")).resolves.toEqual({
      url: "get:workspaces/w1/a/k",
    });
    await expect(endpoints("u1").requestDownloadUrl("workspaces/w2/a/k")).rejects.toThrow(/403/);
    expect((await post("/files/download-url", { key: "workspaces/w1/../w2/k" })).status).toBe(400);
  });

  it("canDelete があれば削除のエンドポイントを作る", async () => {
    await endpoints("u1").requestDelete!("workspaces/w1/users/u1/k");
    expect(signer.deleteObject).toHaveBeenCalledWith("workspaces/w1/users/u1/k");
    await expect(endpoints("u1").requestDelete!("workspaces/w1/users/u2/k")).rejects.toThrow(/403/);
  });
});

describe("キー", () => {
  it("安全なキーだけを受け付ける", () => {
    expect(isSafeKey("workspaces/w1/a")).toBe(true);
    for (const key of ["", "/a", "a//b", "a/./b", "a/../b", "a\\b", "a\nb", "x".repeat(1025)]) {
      expect(isSafeKey(key)).toBe(false);
    }
  });

  it("接頭辞の末尾の / は無視する", () => {
    expect(newKeyUnder("a/b//", "id")).toBe("a/b/id");
  });
});

describe("createS3FileSigner", () => {
  it("PUT と GET の署名付き URL を作る（ネットワークは使わない）", async () => {
    const client = new S3Client({
      region: "ap-northeast-1",
      endpoint: "http://127.0.0.1:9",
      forcePathStyle: true,
      credentials: { accessKeyId: "a", secretAccessKey: "s" },
      requestChecksumCalculation: "WHEN_REQUIRED",
    });
    const s = createS3FileSigner({ client, bucket: "files", expiresIn: 60 });
    const put = new URL(await s.signUpload("w/k", "image/png"));
    expect(put.pathname).toBe("/files/w/k");
    expect(put.searchParams.get("X-Amz-Expires")).toBe("60");
    const get = new URL(await s.signDownload("w/k"));
    expect(get.pathname).toBe("/files/w/k");
  });
});
