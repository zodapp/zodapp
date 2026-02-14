import { useEffect, useMemo, useRef, useState } from "react";
import type { AnyFieldApi } from "@tanstack/react-form";

function randomHex(bytes = 16) {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// オブジェクト形式のエラーオブジェクトを、{ [fieldName]: error } の形式に変換する
// dicreminatorがないstring配列でも、keyを付与して順序を管理する
type WrappedItem = {
  key: string;
  value: unknown;
};

/**
 * TanStack Form の FieldApi で配列フィールドを扱うためのラッパー。
 *
 * 目的:
 * - 配列要素ごとに安定した key を付与し、挿入/削除時も UI の順序・識別子を維持する
 * - discriminator が指定された場合は各要素の同名プロパティを key として利用・補完する
 * - TanStack Form の配列操作 API がないため、FieldApi で値を書き換えつつフォーム全体のバリデーションを発火する
 *
 * 補足:
 * - FieldApi には pushValue/insertValue/removeValue 等の配列メソッドは存在するが、本実装では
 *   ・key 付与や discriminator 補完
 *   ・挿入/削除時にエラーの再マッピング・クリアを自前で扱いたい
 *   ため、低レベルに setValue + validateAllFields で制御している。
 *
 * 処理内容:
 * - フィールド値を監視し、要素ごとに key 付きの WrappedItem 配列を同期（undefined は null に正規化）
 * - insert/remove/append を提供し、配列を更新した上で FieldApi.setValue でフォーム値を更新
 * - 更新後にフォーム全体の validateAllFields("change") を呼び、配列操作起因の検証を全体バリデーションとして走らせる
 */
export const useArray = (
  fieldApi: AnyFieldApi,
  fieldPath: string,
  discriminator: string | undefined,
) => {
  const itemsRef = useRef<WrappedItem[]>([]);
  const [items, setItems] = useState<WrappedItem[]>([]);

  useEffect(() => {
    const syncFromValue = (value: unknown[] | undefined) => {
      const next = Array.from(value ?? []).map((item, index): WrappedItem => {
        const prevKey = itemsRef.current[index]?.key;
        if (discriminator != null) {
          if (item && typeof item === "object") {
            const record = { ...(item as Record<string, unknown>) };
            const rawKey = record[discriminator];
            const key =
              typeof rawKey === "string" || typeof rawKey === "number"
                ? String(rawKey)
                : (prevKey ?? randomHex());
            record[discriminator] = key;
            return { key, value: record };
          } else {
            const key = prevKey ?? randomHex();
            return { key, value: { [discriminator]: key } };
          }
        } else {
          const key = prevKey ?? randomHex();
          return { key, value: item };
        }
      });
      itemsRef.current = next;
      setItems(next);
    };

    syncFromValue(fieldApi.state.value as unknown[] | undefined);
  }, [fieldApi.state.value, discriminator]);

  const { insert, remove, append, move } = useMemo(() => {
    const validateArray = () => {
      queueMicrotask(() => {
        // 配列操作後、バリデーションが表示とずれるのを避けるため、この配列内のフィールドのバリデーションをすべて更新する
        for (const [key, fieldInfo] of Object.entries(
          fieldApi.form.fieldInfo,
        )) {
          if (fieldInfo.instance && key.startsWith(fieldPath)) {
            fieldInfo.instance.handleBlur();
          }
        }
      });
    };

    const setWrappedItems = (
      updater: (current: WrappedItem[]) => WrappedItem[],
    ) => {
      const nextItems = updater(itemsRef.current);
      itemsRef.current = nextItems;
      setItems(nextItems);
      fieldApi.setValue(
        () =>
          nextItems.map(
            (item) => item.value,
          ) as unknown as typeof fieldApi.state.value,
      );
      validateArray();
    };

    const insert = (index: number, newItem: unknown) => {
      const key = (() => {
        if (discriminator) {
          if (newItem && typeof newItem === "object") {
            const record = newItem as Record<string, unknown>;
            const candidate = record[discriminator];
            const safeKey =
              typeof candidate === "string" || typeof candidate === "number"
                ? String(candidate)
                : randomHex();
            record[discriminator] = safeKey;
            return safeKey;
          }
          const safeKey = randomHex();
          newItem = { [discriminator]: safeKey };
          return safeKey;
        } else {
          return randomHex();
        }
      })();
      setWrappedItems((current) => {
        const newItems = current.slice();
        newItems.splice(index, 0, {
          key,
          value: newItem,
        });
        return newItems;
      });
    };

    const remove = (index: number) => {
      setWrappedItems((current) =>
        current.filter((_, i: number) => i !== index),
      );
    };

    const append = (item: unknown) => {
      insert(itemsRef.current.length ?? 0, item);
    };

    const move = (fromIndex: number, toIndex: number) => {
      setWrappedItems((current) => {
        if (
          fromIndex < 0 ||
          fromIndex >= current.length ||
          toIndex < 0 ||
          toIndex >= current.length
        ) {
          return current;
        }
        const newItems = [...current];
        const [removed] = newItems.splice(fromIndex, 1);
        newItems.splice(toIndex, 0, removed!);
        return newItems;
      });
    };

    return { insert, remove, append, move };
  }, [discriminator, fieldApi, fieldPath]);

  return {
    items,
    insert,
    remove,
    append,
    move,
  };
};
