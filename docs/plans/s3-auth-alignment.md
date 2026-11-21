# S3 のファイルの認証まわりを DynamoDB 側にそろえる

- ステータス：実装済み（zod-form-s3・zod-form-s3-node の単体テスト・型・lint が通る）

## 1. 背景

zod-form の externalKey（DynamoDB）と externalFile（S3）の認証の分離を確かめた。
ライブラリ（`packages/*`）は Cognito に依存しておらず、Cognito 固有の処理はサンプルアプリ（`apps/taskmanager`・`apps/survey`）に閉じている。
ただし S3 のパッケージ（`@zodapp/zod-form-s3`・`@zodapp/zod-form-s3-node`）は、認証の扱いが DynamoDB のパッケージとそろっていない点が 4 つある。

## 2. 決まり

### 2.1 S3 の router は `UnauthenticatedError` を 401 にする

`createS3FileRouter` は、`context` が `null` / `undefined` を返したときだけ 401 にしている。
`context`（や `canUpload` など）が `UnauthenticatedError` を投げると `next(error)` に流れ、アプリのエラーハンドラーがなければ 500 になる。
DynamoDB の router（`zod-dynamodb-express`）は 401 を返すので、動きが違う。

- ハンドラーの中で投げられたエラーの `name` が `"UnauthenticatedError"` なら、401 と `{ code: "UNAUTHENTICATED", message }` を返す。
- `instanceof` ではなく `name` で見る。`@zodapp/zod-dynamodb-node` に依存しないため（アプリが同じ名前のエラーを自分で定義しても通る）。
- それ以外のエラーは、今と同じく `next(error)` に渡す。

### 2.2 S3 のクライアントのエラーに `code` と `status` を入れる

`httpS3FileEndpoints` は `new Error("path: 401 ...")` を投げていて、アプリが「401 ならトークンを更新してやり直す」を書きにくい。
`zod-dynamodb-client` の `ClientError` にならい、`S3FileError` を足す。

- `code`：サーバーの応答の `code`（`UNAUTHENTICATED`・`FORBIDDEN`・`INVALID_INPUT` など）。応答が `{ code, message }` の形でなければ `UNEXPECTED_RESPONSE`、通信に失敗したら `NETWORK`。
- `status`：HTTP ステータス（応答がなければ `undefined`）。
- `isS3FileError(error, code?)` で判定できる。
- `createS3FileResolver` の S3 への PUT の失敗も、`S3FileError`（`code: "UPLOAD_FAILED"`、`status` 付き）にする。
- メッセージにはこれまでどおりパスとステータスを入れる。
- `zod-dynamodb-client` への依存は足さない（S3 のパッケージだけで使えるようにする）。

### 2.3 `httpS3FileEndpoints` に `credentials` を足す

`zod-dynamodb-client` の `createClient` と同じく、`credentials?: RequestCredentials` を受け取り、サーバーのエンドポイントへの fetch に渡す。
Cookie で認証していて API が別のオリジンにあるとき、`fetch` を差し替えなくてよくなる。
S3 への PUT（署名付き URL）には渡さない。

### 2.4 README の例を `getToken()` にそろえる

`zod-form-s3` の README（英・日）の例の `getIdToken()` を、`zod-dynamodb-client` の README と同じ `getToken()` にする。
あわせて、`credentials` と `S3FileError` を README に書き、`zod-form-s3-node` の README に 401 の扱いを書く。

## 3. しないこと

- Realtime のトークンの渡し方（URL のクエリ以外の方式）のドキュメントは、今回は扱わない。
- サンプルアプリの `onError` は、ほかのルートでも使うのでそのまま残す。
- 公開前（0.1.0 の前）なので changeset は足さない。

## 4. テスト

- `zod-form-s3-node`：`context` が `UnauthenticatedError` を投げたら 401 と `UNAUTHENTICATED`。ほかのエラーは今までどおりアプリのハンドラーに届く。
- `zod-form-s3`：401・403 の応答で `S3FileError` の `code` と `status`、形の違う応答で `UNEXPECTED_RESPONSE`、通信の失敗で `NETWORK`、`credentials` が fetch に渡ること、PUT の失敗で `UPLOAD_FAILED`。
