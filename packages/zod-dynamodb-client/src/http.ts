import {
  buildPath,
  errorBodySchema,
  type Endpoint,
  type InputOf,
  type OutputOf,
} from "@zodapp/zod-dynamodb";
import { ClientError, issuesOf } from "./errors";

type HeadersLike = Record<string, string>;

export type HttpOptions = {
  /** パスの前に付けるURL（例：`/api`、`https://example.com/api`） */
  baseUrl: string;
  /** すべての呼び出しに付けるヘッダー。認証のトークンなど。非同期でもよい */
  headers?: () => HeadersLike | Promise<HeadersLike>;
  /** `fetch` にそのまま渡す（Cookieを送るなら `"include"`） */
  credentials?: RequestCredentials;
  /** 省略すると `globalThis.fetch` */
  fetch?: typeof fetch;
};

/** 呼び出しごとの指定 */
export type CallOptions = {
  signal?: AbortSignal;
  /** この呼び出しだけに付けるヘッダー */
  headers?: HeadersLike;
};

const isAbort = (error: unknown, signal: AbortSignal | undefined) =>
  signal?.aborted === true ||
  (error instanceof Error && error.name === "AbortError");

const joinUrl = (baseUrl: string, path: string) =>
  baseUrl.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`);

/**
 * エンドポイントを1回呼ぶ（§7.8）。入力を検証してJSONに変換し、応答を出力に戻す。
 * 失敗は `ClientError` で投げる（K1、K3）。
 */
export const callEndpoint = async <E extends Endpoint>(
  options: HttpOptions,
  endpoint: E,
  input: InputOf<E>,
  call: CallOptions = {},
): Promise<OutputOf<E>> => {
  // 1. 入力を検証してJSONにする。失敗したら送らない
  let json: unknown;
  try {
    json = endpoint.encodeInput(input);
  } catch (error) {
    throw new ClientError("INVALID_INPUT", {
      issues: issuesOf(error),
      cause: error,
    });
  }

  // 2. リクエストを組み立てる
  let url = joinUrl(options.baseUrl, buildPath(endpoint.path, json));
  const headers: HeadersLike = {
    ...((await options.headers?.()) ?? {}),
    ...call.headers,
  };
  const init: RequestInit = {
    method: endpoint.method,
    headers,
    credentials: options.credentials,
    signal: call.signal,
  };
  if (endpoint.method === "GET") {
    // パスに入らない入力は、入力全体のJSONをクエリ文字列の `input` に入れる（K2）
    url += `${url.includes("?") ? "&" : "?"}input=${encodeURIComponent(
      JSON.stringify(json),
    )}`;
  } else {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(json);
  }

  // 3. 送る
  const fetchFn = options.fetch ?? globalThis.fetch;
  let res: Response;
  let text: string;
  try {
    res = await fetchFn(url, init);
    text = await res.text();
  } catch (error) {
    if (isAbort(error, call.signal)) throw error;
    throw new ClientError("NETWORK", { cause: error });
  }

  let body: unknown;
  let parsed = true;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = false;
  }

  // 4. エラーの応答
  if (!res.ok) {
    const error = parsed ? errorBodySchema.safeParse(body) : undefined;
    if (error?.success) {
      throw new ClientError(error.data.code, {
        message: error.data.message,
        status: res.status,
        issues: error.data.issues,
      });
    }
    throw new ClientError("UNEXPECTED_RESPONSE", { status: res.status });
  }
  if (!parsed) {
    throw new ClientError("UNEXPECTED_RESPONSE", { status: res.status });
  }

  // 5. 出力に戻す。Schemaに合わなければコントラクトの版ずれなど
  try {
    return endpoint.decodeOutput(body, input) as OutputOf<E>;
  } catch (error) {
    throw new ClientError("INVALID_RESPONSE", {
      status: res.status,
      issues: issuesOf(error),
      cause: error,
    });
  }
};
