import { useCallback, useEffect, useRef, useState } from 'react';

type SetStateAction<T> = T | ((prev: T) => T);

type StorageChangeDetail<T> = {
  storageType: string;
  key: string;
  value: T;
};

const STORAGE_CHANGE_EVENT = 'custom-storage-change';

function createStorageEventName(storageType: string) {
  return `${STORAGE_CHANGE_EVENT}:${storageType}`;
}

export function useStorageState<T>(
  storage: Storage,
  key: string,
  initialValue: T | (() => T)
): [T, (value: SetStateAction<T>) => void] {
  const storageType = storage === window.localStorage ? 'local' : 'session';

  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;

  const resolveInitialValue = useCallback((): T => {
    const iv = initialValueRef.current;
    // eslint-disable-next-line custom/no-unsafe-type-assertion-customized
    return typeof iv === 'function' ? (iv as () => T)() : iv;
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

  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return resolveInitialValue();
    return readValue();
  });

  const setValue = useCallback(
    (value: SetStateAction<T>) => {
      setState((prev) => {
        const next =
          typeof value === 'function'
            ? // eslint-disable-next-line custom/no-unsafe-type-assertion-customized
              (value as (prev: T) => T)(prev)
            : value;

        storage.setItem(key, JSON.stringify(next));

        window.dispatchEvent(
          new CustomEvent<StorageChangeDetail<T>>(createStorageEventName(storageType), {
            detail: { storageType, key, value: next }
          })
        );

        return next;
      });
    },
    [storage, storageType, key]
  );

  useEffect(() => {
    setState(readValue());
  }, [key, readValue]);

  useEffect(() => {
    const eventName = createStorageEventName(storageType);

    const onCustomEvent = (event: Event) => {
      // eslint-disable-next-line custom/no-unsafe-type-assertion-customized
      const customEvent = event as CustomEvent<StorageChangeDetail<T>>;
      if (customEvent.detail.key !== key) return;
      setState(customEvent.detail.value);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== storage) return;
      if (event.key !== key) return;
      setState(readValue());
    };

    window.addEventListener(eventName, onCustomEvent);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(eventName, onCustomEvent);
      window.removeEventListener('storage', onStorage);
    };
  }, [storage, storageType, key, readValue]);

  return [state, setValue];
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T | (() => T)
): [T, (value: SetStateAction<T>) => void] {
  return useStorageState(window.localStorage, key, initialValue);
}

export function useSessionStorageState<T>(
  key: string,
  initialValue: T | (() => T)
): [T, (value: SetStateAction<T>) => void] {
  return useStorageState(window.sessionStorage, key, initialValue);
}
