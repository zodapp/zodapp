import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { z } from "zod";
import {
  adaptValueToSchema,
  type DynamicMetaDef,
  type FnInput,
  type ResolvedSchema,
  type SchemaResolveResult,
  type SchemaSubscription,
} from "@zodapp/zod-form";
import type { AnyFormApi } from "@tanstack/react-form";
import { useFormApi, useFormRuntime } from "./form";
import { useFnInput } from "./fnInput";
import type { EditCause } from "./schemaRegistry";

/**
 * dynamic の状態。
 *
 * - loading: 最初の resolve が終わっていない
 * - pending: 取り直し中（前の schema はあるが、選べないようにする）
 * - resolved: schema が決まっている
 * - error: 取得に失敗した。retry で取り直せる
 */
export type DynamicSchemaState =
  | { status: "loading" }
  | { status: "pending"; schema: z.ZodTypeAny }
  | { status: "resolved"; schema: z.ZodTypeAny }
  | { status: "error"; error: unknown; retry: () => void };

type DepthValue = { path: string; depth: number };

const DynamicDepthContext = createContext<DepthValue | null>(null);

/**
 * dynamic の子に、同じ path での入れ子の深さを伝える。
 * 同じ path に dynamic が重なったとき、深いほうの登録を検証に使う。
 */
export const DynamicDepthProvider = ({
  path,
  depth,
  children,
}: DepthValue & { children: React.ReactNode }) => {
  const value = useMemo(() => ({ path, depth }), [path, depth]);
  return (
    <DynamicDepthContext.Provider value={value}>
      {children}
    </DynamicDepthContext.Provider>
  );
};

/** 同じ path での dynamic の入れ子の深さ（一番外が 0） */
export const useDynamicDepth = (fieldPath: string): number => {
  const outer = useContext(DynamicDepthContext);
  return outer && outer.path === fieldPath ? outer.depth + 1 : 0;
};

const isResolvedSchema = (value: unknown): value is ResolvedSchema =>
  typeof value === "object" &&
  value !== null &&
  "schema" in value &&
  "key" in value;

const isSubscription = (value: unknown): value is SchemaSubscription =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { subscribe?: unknown }).subscribe === "function";

const isEqualValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  ) {
    return false;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) =>
    isEqualValue(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  );
};

const readValue = (form: AnyFormApi, fieldPath: string) =>
  fieldPath === "" ? form.state.values : form.getFieldValue(fieldPath);

const writeValue = (form: AnyFormApi, fieldPath: string, value: unknown) => {
  if (fieldPath === "") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.baseStore.setState((state: any) => ({ ...state, values: value }));
    return;
  }
  form.setFieldValue(fieldPath, value as never, { dontValidate: true });
};

type ResolveOutcome =
  | { kind: "value"; result: SchemaResolveResult }
  | { kind: "thrown"; error: unknown };

type AsyncState =
  | { status: "pending"; resolved?: ResolvedSchema }
  | { status: "resolved"; resolved: ResolvedSchema }
  | { status: "error"; error: unknown; resolved?: ResolvedSchema };

/**
 * dynamic の resolve を呼び、決まった schema をフォームの登録先に置く hook。
 *
 * - 同期で返る resolve は描画中に計算する（読み込み中を出さない）。副作用を持たないこと
 * - Promise と購読は、取り直しを始めたら pending、失敗したら error にする
 * - key が前回適用したものと違い、かつ取り直しの出どころが利用者の編集なら、
 *   値を新しい schema に合わせて削る。それ以外は値に触らない
 * - 古い結果は捨てる。key が同じ購読は張り直さない
 */
export const useDynamicSchema = (
  meta: DynamicMetaDef | undefined,
  fieldPath: string,
): DynamicSchemaState => {
  const form = useFormApi();
  const runtime = useFormRuntime();
  const depth = useDynamicDepth(fieldPath);
  const input = useFnInput(meta, fieldPath);
  const [retryToken, setRetryToken] = useState(0);

  const outcome = useMemo<ResolveOutcome>(() => {
    try {
      return {
        kind: "value",
        result: meta
          ? (meta.resolve as (input: FnInput) => SchemaResolveResult)(input)
          : undefined,
      };
    } catch (error) {
      return { kind: "thrown", error };
    }
    // retryToken は取り直しのため
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, input, retryToken]);

  const syncResolved =
    outcome.kind === "value" && isResolvedSchema(outcome.result)
      ? outcome.result
      : undefined;

  const [asyncState, setAsyncState] = useState<AsyncState>({
    status: "pending",
  });

  const seenRevRef = useRef(runtime.currentRev());
  const appliedRef = useRef<
    { key: string; schema: z.ZodTypeAny; path: string; depth: number } | undefined
  >(undefined);
  const requestRef = useRef(0);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const subscriptionKeyRef = useRef<string | undefined>(undefined);

  // 外れたら・path が変わったら、購読と登録を消す
  useEffect(() => {
    return () => {
      requestRef.current += 1;
      unsubscribeRef.current?.();
      unsubscribeRef.current = undefined;
      subscriptionKeyRef.current = undefined;
      appliedRef.current = undefined;
      runtime.remove(fieldPath, depth);
    };
  }, [runtime, fieldPath, depth]);

  useEffect(() => {
    // 前回見たときからの変更の出どころ。結果が届くまで closure で持ち運ぶ
    const cause: EditCause = runtime.causeSince(seenRevRef.current);
    seenRevRef.current = runtime.currentRev();

    const stopAsync = () => {
      requestRef.current += 1;
      unsubscribeRef.current?.();
      unsubscribeRef.current = undefined;
      subscriptionKeyRef.current = undefined;
    };

    const apply = (resolved: ResolvedSchema, applyCause: EditCause) => {
      const previous = appliedRef.current;
      if (
        previous &&
        previous.key === resolved.key &&
        previous.schema === resolved.schema &&
        previous.path === fieldPath &&
        previous.depth === depth
      ) {
        return;
      }
      appliedRef.current = {
        key: resolved.key,
        schema: resolved.schema,
        path: fieldPath,
        depth,
      };
      if (
        applyCause === "user" &&
        previous !== undefined &&
        previous.key !== resolved.key
      ) {
        const current = readValue(form, fieldPath);
        const next = adaptValueToSchema(current, resolved.schema);
        if (!isEqualValue(current, next)) {
          // 利用者の編集の続きとして書く（下の dynamic へ連鎖させる）
          runtime.runAsUserEdit(() => writeValue(form, fieldPath, next));
        }
        seenRevRef.current = runtime.currentRev();
      }
      runtime.set(fieldPath, depth, {
        status: "resolved",
        schema: resolved.schema,
      });
    };

    const retry = () => {
      subscriptionKeyRef.current = undefined;
      setRetryToken((token) => token + 1);
    };

    if (outcome.kind === "thrown") {
      stopAsync();
      runtime.set(fieldPath, depth, {
        status: "error",
        error: outcome.error,
        retry,
      });
      return;
    }

    if (syncResolved) {
      stopAsync();
      apply(syncResolved, cause);
      return;
    }

    const result = outcome.result;
    if (
      isSubscription(result) &&
      result.key !== undefined &&
      result.key === subscriptionKeyRef.current
    ) {
      return; // 同じ key の購読は張り直さない
    }

    stopAsync();
    const request = requestRef.current;
    const isCurrent = () => request === requestRef.current;
    runtime.set(fieldPath, depth, { status: "pending" });
    setAsyncState((state) => ({ status: "pending", resolved: state.resolved }));

    const deliver = (resolved: ResolvedSchema | undefined) => {
      if (!isCurrent()) return; // 古い結果は捨てる
      if (!resolved) return; // 決まらないあいだは pending のまま
      apply(resolved, cause);
      setAsyncState({ status: "resolved", resolved });
    };
    const fail = (error: unknown) => {
      if (!isCurrent()) return;
      runtime.set(fieldPath, depth, { status: "error", error, retry });
      setAsyncState((state) => ({
        status: "error",
        error,
        resolved: state.resolved,
      }));
    };

    if (isSubscription(result)) {
      subscriptionKeyRef.current = result.key;
      try {
        unsubscribeRef.current = result.subscribe(deliver, fail);
      } catch (error) {
        fail(error);
      }
    } else if (result instanceof Promise) {
      result.then(deliver, fail);
    }
    // result が undefined のときは、決まるまで pending のまま
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, fieldPath, depth]);

  if (outcome.kind === "thrown") {
    return {
      status: "error",
      error: outcome.error,
      retry: () => setRetryToken((token) => token + 1),
    };
  }
  if (syncResolved) {
    return { status: "resolved", schema: syncResolved.schema };
  }
  if (asyncState.status === "error") {
    return {
      status: "error",
      error: asyncState.error,
      retry: () => {
        subscriptionKeyRef.current = undefined;
        setRetryToken((token) => token + 1);
      },
    };
  }
  if (asyncState.status === "resolved") {
    return { status: "resolved", schema: asyncState.resolved.schema };
  }
  return asyncState.resolved
    ? { status: "pending", schema: asyncState.resolved.schema }
    : { status: "loading" };
};
