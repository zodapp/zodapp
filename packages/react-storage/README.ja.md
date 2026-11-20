# @zodapp/react-storage

[English](README.md)

## 概要

`@zodapp/react-storage` は、ストレージに保存する React の state の hook です。`useState` と同じように使え、値は JSON でストレージに保存され、同じキーを使うコンポーネントのあいだで共有されます。

- `useLocalStorageState(key, initialValue)`：`localStorage` に保存する。ほかのタブでの変更も反映する（`storage` イベント）
- `useSessionStorageState(key, initialValue)`：`sessionStorage` に保存する
- `useMemoryState(key, initialValue)`：ページが開いているあいだだけメモリーに持つ（保存しない）
- `useStorageState(storage, key, initialValue)`：自前のストレージ（`StateStorage`）を使う

zodapp のサンプルでは、フォームの入力や列の設定を残すのに使っています（例：`apps/taskmanager` の表の列の設定）。

## インストール

```bash
pnpm add @zodapp/react-storage
```

## 要件

- React 18+ / 19+

## 使い方

```tsx
import { useLocalStorageState } from "@zodapp/react-storage";

const Settings = () => {
  const [pageSize, setPageSize] = useLocalStorageState("myApp.pageSize", 20);
  return (
    <select
      value={pageSize}
      onChange={(e) => setPageSize(Number(e.target.value))}
    >
      <option value={20}>20</option>
      <option value={50}>50</option>
    </select>
  );
};
```

- 戻り値は `useState` と同じ `[value, setValue]` です。`setValue` は更新の関数も受け取ります
- 値は `JSON.stringify` で保存し、`JSON.parse` で読みます。JSON で往復できる値にしてください（`Date`・`Map`・`Set` などは戻りません）
- 保存された値が無いか、読めないときは `initialValue` を使います（関数なら呼びます）。`initialValue` は、`setValue` を呼ぶまでストレージに書きません
- 同じページの中で、同じストレージと同じキーを使うコンポーネントは一緒に変わります
- サーバー（`window` が無いところ）では、読むと `initialValue` を返し、書いても何もしません

### 自前のストレージ

```ts
import { useStorageState, type StateStorage } from "@zodapp/react-storage";

const storage: StateStorage = {
  getItem: (key) => myStore.get(key) ?? null,
  setItem: (key, value) => myStore.set(key, value),
  subscribe: (key, listener) => myStore.onChange(key, listener), // 購読をやめる関数を返す
};

const [value, setValue] = useStorageState(storage, "key", initialValue);
```

## API

- `useStorageState(storage, key, initialValue)`
- `useLocalStorageState(key, initialValue)` / `useSessionStorageState(key, initialValue)` / `useMemoryState(key, initialValue)`
- 型：`StateStorage`

## ライセンス

MIT（[`LICENSE`](../../LICENSE)）
