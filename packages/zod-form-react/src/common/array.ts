import { useMemo, useRef } from "react";
import type { AnyFieldApi } from "@tanstack/react-form";

let idCounter = 0;
function generateKey() {
  return `_ai_${++idCounter}_${Date.now().toString(36)}`;
}

type ArrayItem = {
  key: string;
  index: number;
};

type ArrayFieldError = {
  message?: string;
};

type PathSegment = string | number;

const parseFieldPath = (fieldPath: string): PathSegment[] =>
  fieldPath
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));

const getIssuePath = (error: unknown): PathSegment[] | undefined => {
  if (!error || typeof error !== "object" || !("path" in error)) return undefined;
  const path = (error as { path?: unknown }).path;
  if (!Array.isArray(path)) return undefined;
  return path.flatMap((segment) => {
    if (typeof segment === "string" || typeof segment === "number") {
      return [segment];
    }
    if (segment && typeof segment === "object" && "key" in segment) {
      const key = (segment as { key?: unknown }).key;
      return typeof key === "string" || typeof key === "number" ? [key] : [];
    }
    return [];
  });
};

const pathsEqual = (left: readonly PathSegment[], right: readonly PathSegment[]) =>
  left.length === right.length && left.every((segment, index) => segment === right[index]);

export const getArrayFieldError = (
  errors: unknown,
  fieldPath: string,
): ArrayFieldError | undefined => {
  if (!Array.isArray(errors)) return undefined;
  const ownPath = parseFieldPath(fieldPath);
  const error = errors.flat(Number.POSITIVE_INFINITY).find((candidate) => {
    if (typeof candidate === "string") return true;
    if (!candidate || typeof candidate !== "object") return false;
    const issuePath = getIssuePath(candidate);
    return issuePath === undefined || pathsEqual(issuePath, ownPath);
  });

  if (typeof error === "string") return { message: error };
  return error as ArrayFieldError | undefined;
};

/**
 * TanStack Form の FieldApi ネイティブ配列操作（insertValue / removeValue /
 * pushValue / moveValue）を利用する配列フィールド用フック。
 *
 * このフックは要素単位の操作を TanStack Form に委譲することで、
 * フィールドメタデータ（バリデーション状態・touched 等）の再インデックスを
 * フレームワーク側で正しく処理させる。
 *
 * React / DnD 用の安定キーは引き続き管理し、discriminator にも対応する。
 */
export const useArray = (
  fieldApi: AnyFieldApi,
  discriminator: string | undefined,
) => {
  const keysRef = useRef<string[]>([]);
  const value = fieldApi.state.value as unknown[] | undefined;
  const len = value?.length ?? 0;

  const items: ArrayItem[] = useMemo(() => {
    const prev = keysRef.current;

    if (discriminator) {
      const nextKeys: string[] = [];
      for (let i = 0; i < len; i++) {
        const item = value![i];
        if (item && typeof item === "object") {
          const rawKey = (item as Record<string, unknown>)[discriminator];
          if (typeof rawKey === "string" || typeof rawKey === "number") {
            nextKeys.push(String(rawKey));
            continue;
          }
        }
        nextKeys.push(prev[i] ?? generateKey());
      }
      keysRef.current = nextKeys;
    } else {
      while (prev.length < len) {
        prev.push(generateKey());
      }
      prev.length = len;
    }

    return keysRef.current.map((key, index) => ({ key, index }));
  }, [value, len, discriminator]);

  const ops = useMemo(() => {
    const ensureDiscriminator = (newItem: unknown): unknown => {
      if (!discriminator) return newItem;
      if (newItem && typeof newItem === "object") {
        const record = newItem as Record<string, unknown>;
        if (
          typeof record[discriminator] !== "string" &&
          typeof record[discriminator] !== "number"
        ) {
          record[discriminator] = generateKey();
        }
        return record;
      }
      return { [discriminator]: generateKey() };
    };

    const keyFor = (prepared: unknown): string => {
      if (discriminator && prepared && typeof prepared === "object") {
        return String(
          (prepared as Record<string, unknown>)[discriminator] ?? generateKey(),
        );
      }
      return generateKey();
    };

    const insert = (index: number, newItem: unknown) => {
      const prepared = ensureDiscriminator(newItem);
      keysRef.current.splice(index, 0, keyFor(prepared));
      fieldApi.insertValue(index, prepared);
    };

    const remove = (index: number) => {
      keysRef.current.splice(index, 1);
      fieldApi.removeValue(index);
    };

    const append = (newItem: unknown) => {
      const prepared = ensureDiscriminator(newItem);
      keysRef.current.push(keyFor(prepared));
      fieldApi.pushValue(prepared);
    };

    const move = (fromIndex: number, toIndex: number) => {
      const keys = keysRef.current;
      if (
        fromIndex < 0 ||
        fromIndex >= keys.length ||
        toIndex < 0 ||
        toIndex >= keys.length
      ) {
        return;
      }
      const [movedKey] = keys.splice(fromIndex, 1);
      keys.splice(toIndex, 0, movedKey!);
      fieldApi.moveValue(fromIndex, toIndex);
    };

    return { insert, remove, append, move };
  }, [fieldApi, discriminator]);

  return {
    items,
    error:
      fieldApi.state.meta.isTouched || fieldApi.form.state.isSubmitted
        ? getArrayFieldError(fieldApi.state.meta.errors, fieldApi.name)
        : undefined,
    ...ops,
  };
};
