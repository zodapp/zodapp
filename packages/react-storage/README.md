# @zodapp/react-storage

[日本語](README.ja.md)

## Overview

`@zodapp/react-storage` provides React state hooks backed by storage. They work like `useState`, but the value is saved in storage as JSON and shared by every component that uses the same key.

- `useLocalStorageState(key, initialValue)`: saved in `localStorage`. Changes in other tabs are reflected too (the `storage` event)
- `useSessionStorageState(key, initialValue)`: saved in `sessionStorage`
- `useMemoryState(key, initialValue)`: kept in memory for the lifetime of the page (not persisted)
- `useStorageState(storage, key, initialValue)`: uses your own storage (`StateStorage`)

The zodapp examples use it to keep form input and column settings (for example, `apps/taskmanager` saves table column settings with it).

## Installation

```bash
pnpm add @zodapp/react-storage
```

## Requirements

- React 18+ / 19+

## Usage

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

- The return value is the same as `useState`: `[value, setValue]`. `setValue` also accepts an updater function
- Values are saved with `JSON.stringify` and read with `JSON.parse`. Use values that survive a JSON round trip (not `Date`, `Map`, `Set`, etc.)
- When nothing is saved, or the saved value cannot be parsed, `initialValue` is used (a function is called). `initialValue` is not written to storage until `setValue` is called
- Components using the same storage and key in the same page are updated together
- On the server (no `window`), reads return `initialValue` and writes do nothing

### Your own storage

```ts
import { useStorageState, type StateStorage } from "@zodapp/react-storage";

const storage: StateStorage = {
  getItem: (key) => myStore.get(key) ?? null,
  setItem: (key, value) => myStore.set(key, value),
  subscribe: (key, listener) => myStore.onChange(key, listener), // returns an unsubscribe function
};

const [value, setValue] = useStorageState(storage, "key", initialValue);
```

## API

- `useStorageState(storage, key, initialValue)`
- `useLocalStorageState(key, initialValue)` / `useSessionStorageState(key, initialValue)` / `useMemoryState(key, initialValue)`
- Type: `StateStorage`

## License

MIT ([`LICENSE`](../../LICENSE))
