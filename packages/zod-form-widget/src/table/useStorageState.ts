import { useCallback, useEffect, useRef, useState } from "react";

type SetStateAction<T> = T | ((prev: T) => T);

type StateStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  subscribe: (key: string, listener: () => void) => () => void;
};

function createStorageEmitter() {
  const listenersByKey = new Map<string, Set<() => void>>();

  const emit = (key: string) => {
    listenersByKey.get(key)?.forEach((listener) => listener());
  };

  const subscribe = (key: string, listener: () => void) => {
    const listeners = listenersByKey.get(key) ?? new Set<() => void>();
    listeners.add(listener);
    listenersByKey.set(key, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        listenersByKey.delete(key);
      }
    };
  };

  return { emit, subscribe };
}

function createMemoryStateStorage(): StateStorage {
  const state = new Map<string, string>();
  const emitter = createStorageEmitter();

  return {
    getItem(key) {
      return state.get(key) ?? null;
    },
    setItem(key, value) {
      state.set(key, value);
      emitter.emit(key);
    },
    subscribe: emitter.subscribe,
  };
}

function createBrowserStateStorage(
  getStorage: () => Storage | undefined,
): StateStorage {
  const emitter = createStorageEmitter();
  let isStorageEventSubscribed = false;

  const ensureStorageEventSubscription = () => {
    if (isStorageEventSubscribed || typeof window === "undefined") return;

    window.addEventListener("storage", (event) => {
      if (!event.key) return;
      if (event.storageArea !== getStorage()) return;
      emitter.emit(event.key);
    });

    isStorageEventSubscribed = true;
  };

  return {
    getItem(key) {
      return getStorage()?.getItem(key) ?? null;
    },
    setItem(key, value) {
      getStorage()?.setItem(key, value);
      emitter.emit(key);
    },
    subscribe(key, listener) {
      ensureStorageEventSubscription();
      return emitter.subscribe(key, listener);
    },
  };
}

const localStateStorage = createBrowserStateStorage(() =>
  typeof window === "undefined" ? undefined : window.localStorage,
);
const sessionStateStorage = createBrowserStateStorage(() =>
  typeof window === "undefined" ? undefined : window.sessionStorage,
);
const memoryStateStorage = createMemoryStateStorage();

export function useStorageState<T>(
  storage: StateStorage,
  key: string,
  initialValue: T | (() => T),
): [T, (value: SetStateAction<T>) => void] {
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  const resolveInitialValue = useCallback((): T => {
    const iv = initialValueRef.current;
    return typeof iv === "function" ? (iv as () => T)() : iv;
  }, []);

  const readValue = useCallback((): T => {
    try {
      const raw = storage.getItem(key);
      if (raw == null) return resolveInitialValue();

      return JSON.parse(raw) as T;
    } catch {
      return resolveInitialValue();
    }
  }, [storage, key, resolveInitialValue]);

  const [state, setState] = useState<T>(() => readValue());

  const setValue = useCallback(
    (value: SetStateAction<T>) => {
      setState((prev) => {
        const next =
          typeof value === "function" ? (value as (prev: T) => T)(prev) : value;

        storage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [storage, key],
  );

  useEffect(() => {
    setState(readValue());
  }, [key, readValue]);

  useEffect(
    () => storage.subscribe(key, () => setState(readValue())),
    [storage, key, readValue],
  );

  return [state, setValue];
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, (value: SetStateAction<T>) => void] {
  return useStorageState(localStateStorage, key, initialValue);
}

export function useSessionStorageState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, (value: SetStateAction<T>) => void] {
  return useStorageState(sessionStateStorage, key, initialValue);
}

export function useMemoryState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, (value: SetStateAction<T>) => void] {
  return useStorageState(memoryStateStorage, key, initialValue);
}
