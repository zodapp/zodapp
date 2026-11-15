# @zodapp/zod-form

> この README は日本語版です。英語版は日本語レビュー・整合性チェック後に翻訳予定です。

## 概要

`@zodapp/zod-form` は、**React 非依存**で Zod スキーマにフォーム用メタデータを付与できるようにするためのパッケージです。

- `zf.*`: Zod v4 registry を用いた拡張ファクトリ（`label` / `uiType` / `readOnly` 等のメタ）
- `getMeta(schema)`: スキーマから付与されたメタデータを取り出す
- `externalKey` / `file`: 外部キー選択・ファイルアップロードのための型/設定を扱う土台（config はただのデータ。親や context で変えるときは `zf.dynamic` で包む。選択肢を取り直すかどうかは config を文字列にしたものと context の値で決まるので、関数だけが違う config に差し替えるときは config に `key` を書く）
- `computed` / `dynamic`: `{ value, parent, context }` を受け取る関数で、表示や実際に使う schema を実行時に決める
- `valueAction`: 選んだ値に対する操作（リンクで開くなど）の型
- `zf.time`: 時刻だけを持つ値（`z.iso.time()` と、0 時からの経過量を持つ `z.number()`）
- `createMockFileResolver`: ローカル開発用のモック（Data URL で保持）
- `createMockTopic` / `createMockExternalKeyResolver`: ローカル開発用の externalKey のモック。topic に入れた選択肢を届け、topic が変わるたびに届け直す。モックは待たない。topic に値があれば購読したその場で届け、値の無い topic（`createMockTopic()`）は最初の `set` まで何も届けない（欄は読み込み中のまま）。読み込み中を見せたいときは、使う側で resolver を包んで遅らせる。config の `filter(option, context)` で、`contextId` の resolverContext を使って絞れる

実際のフォーム描画（React コンポーネント）は `@zodapp/zod-form-react` / `@zodapp/zod-form-mantine` を使います。

## インストール

```bash
pnpm add @zodapp/zod-form
```

## 要件

- Zod v4

## クイックスタート（スキーマ定義）

```ts
import { z } from "zod";
import { zf } from "@zodapp/zod-form";

const userSchema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "名前" }),
    email: zf
      .string()
      .email()
      .register(zf.string.registry, { label: "メール" }),
    age: zf.number().min(0).register(zf.number.registry, { label: "年齢" }),
  })
  .register(zf.object.registry, {});

export type User = z.infer<typeof userSchema>;
```

## メタデータの取得

```ts
import { zf, getMeta } from "@zodapp/zod-form";

const schema = zf
  .string()
  .register(zf.string.registry, { label: "パスワード", uiType: "password" });

const meta = getMeta(schema);
// meta?.typeName === "string"
// meta?.label === "パスワード"
// meta?.uiType === "password"
```

## 日付・時刻の保存形式（`zf.date` / `zf.time`）

`zf.date` の `z.iso.datetime()` / `z.iso.datetime({ local: true })` と、`zf.time` の `z.iso.time()` は、同じ決まりで文字列を書きます。

- precision があるときは precision に合わせて書く（-1: 分まで、0: 秒まで、1 以上: 秒の小数をその桁数）。unit 省略時は precision から決める（-1 → minute、0 → second、1 以上 → millisecond）
- unit を precision が持てるより細かくすると値に入らないので、定義の時点でエラーを投げる（例: precision -1 に unit `second`、precision 0 に unit `millisecond`）
- precision が無い形式は zod がどの粒度でも受け付けるので、unit で書く形を決める（unit 省略時は second）

| unit                   | `z.iso.datetime()`                             | `z.iso.datetime({ local: true })` | `z.iso.time()` |
| ---------------------- | ---------------------------------------------- | --------------------------------- | -------------- |
| hour / minute / second | `YYYY-MM-DDTHH:mm:ssZ`（minute なら秒は `00`） | `YYYY-MM-DDTHH:mm:ss`             | `HH:mm:ss`     |
| millisecond            | `YYYY-MM-DDTHH:mm:ss.SSSZ`                     | `YYYY-MM-DDTHH:mm:ss.SSS`         | `HH:mm:ss.SSS` |

（`hour` は `zf.time` のみ）

- precision が無いフィールドの unit は後から変えないでください。保存済みの値と新しく書く値で形が混ざります
- unit が保存されている値より粗いとき、編集すると unit より細かい部分は 0 になります（例: 秒を持つ値を unit `minute` で編集すると秒は `00`）。開いただけでは値を書き換えません

## 外部キー / ファイル（型と設定の土台）

このパッケージは **設定型**を提供します。実際の解決（Firestore/Storage など）は別パッケージで提供します。

- 外部キー: `@zodapp/zod-form-firebase`（Firestore resolver）
- ファイル: `@zodapp/zod-form-firebase`（Firebase Storage resolver）

## externalKey の resolver

resolver は `subscribe(callback, onError?)` を持つ値を返します。

```ts
const resolvers = [
  {
    type: "api",
    resolver: (config) => ({
      subscribe: (callback, onError) => {
        const off = watchOptions(config, {
          next: (options) => callback(options), // { label, value }[]
          error: (error) => onError?.(error),
        });
        return off;
      },
    }),
  },
];
```

- `callback` で選択肢を届けます。何度呼んでもよく、呼ぶたびに欄の選択肢が変わります
- 取得に失敗したら `onError` を呼びます。欄は dynamic の error になり「再試行」が出て、送信は止まります。値は消しません（prune も unlisted の clear もしない）
- 同じ購読のまま、あとで `callback` で選択肢が届けば、再試行を押さなくても戻ります。再試行を押すと、購読をやめて最初からやり直します
- `onError` は省略できます。使わない resolver はそのまま動きます
- モックの topic は `fail(error)` で失敗を届けます。失敗の状態は次の `set` まで続き、そのあいだに購読した欄にもその場で失敗を届けます

## 開発・テスト用: `createMockFileResolver`

アップロード先が未確定な段階や、UI 開発時の動作確認向けに、**実アップロードを行わない** file resolver を提供しています。

```ts
import { createMockFileResolver } from "@zodapp/zod-form";

const fileResolvers = [createMockFileResolver()];
```

`apps/form-demo/src/pages/form/detail.tsx` でも、フォームのデモページ用に `createMockFileResolver()` を使っています。

## 選択肢に無い値（`unlisted`）

`zf.enum` / `zf.externalKey` の `unlisted` で、値が選択肢に無いときの扱いを決めます。

- `clear`（既定）: 値を消す
- `keep`: 値を残し、欄に「（不正な値）」と出してエラーにする。選択肢が戻れば元の表示に戻る

`clear` は、欄を表示した時点で消します。利用者が何も触らなくても、保存されていた値が選択肢に無ければ消え、そのまま保存すると消えた値で保存されます。選択肢を購読しているときは、編集中のフォームでも、誰かが選択肢からその値を外した時点で消えます。あとで選択肢が戻っても、消えた値は戻りません。値を失いたくないときは `keep` を使います。

フォームを開いただけで値が変わるかどうかは、仕組みによって違います。

- `z.preprocess`（`union` など）: 開いたときに値を整える
- `unlisted: "clear"`: 開いたときに、選択肢に無い値を消す
- 日付・時刻の精度: 開いただけでは書き換えない（利用者が編集したときだけ、欄の精度に合わせる）

開いたときの書き換え（`clear`・`z.preprocess` の `union`）は仕様です。ただし、どちらも欄を「触った」「変えた」にはしないので、開いただけでは `isDirty` は `false` のままです。

- `clear` で消えた欄の必須のエラーは、ほかの必須の欄と同じく、触るか送信するまで出ません
- dynamic の取り直しで値を削る（prune）ときも同じです
- 利用者が上の欄を変えて下の欄が消えたときは、上の欄の編集で `isDirty` が `true` になります

## API（抜粋）

- `zf` / `getMeta`
- 関数を受け取る meta: `FnInput`, `FnSourceMeta`, `ComputedMetaDef`, `DynamicMetaDef`, `SchemaResolver`, `asRegistrySchemaResolver`, `defineDynamicMeta`
- 値の調整: `pruneValueToSchema`, `adaptValueToSchema`
- `valueAction` 型: `BaseValueActionConfig`, `ValueActionRegistry`, `RegisteredValueActionConfig`
- `externalKey` 型: `ExternalKeyResolverEntry`, `ExternalKeyResolvers`, `BaseExternalKeyConfig`, `RegisteredExternalKeyConfig`, ...
- `file` 型/関数: `FileResolverEntry`, `FileResolvers`, `BaseFileConfig`, `RegisteredFileConfig`, `parseMimeTypeFromUrl`, `createMockFileResolver`, ...

## 関連

- `@zodapp/zod-form-react`: React 依存の `Dynamic` / hooks / `zfReact`
- `@zodapp/zod-form-mantine`: Mantine UI の componentLibrary 実装
- `@zodapp/zod-form-firebase`: Firestore / Storage resolver

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）

