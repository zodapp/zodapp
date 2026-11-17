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
  getDefaultValue,
  type DynamicMetaDef,
  type FnInput,
  type DeliveredSchema,
  type ResolvedSchema,
  type SchemaLoad,
  type SchemaResolveResult,
  type SchemaSubscription,
} from "@zodapp/zod-form";
import type { AnyFormApi } from "@tanstack/react-form";
import { useFormApi, useFormRuntime } from "./form";
import { useFnInput } from "./fnInput";
import type { EditCause } from "./schemaRegistry";
import { rewrapWithOuter, type Outer } from "./outer";
import { isEqualValue } from "../utils/equal";

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

const isLoad = (value: unknown): value is SchemaLoad =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { load?: unknown }).load === "function";

type AsyncSource = SchemaLoad | SchemaSubscription;

const isAsyncSource = (value: unknown): value is AsyncSource =>
  isLoad(value) || isSubscription(value);

/**
 * 一度だけの取得と購読を、同じ形で始める。届いた schema の key が無ければ取得の key を使う。
 * 返す関数で止める（止めたあとに届いた結果は捨てる）。
 */
const startAsync = (
  source: AsyncSource,
  deliver: (resolved: ResolvedSchema) => void,
  fail: (error: unknown) => void,
): (() => void) => {
  let active = true;
  const onDelivered = (delivered: DeliveredSchema | undefined) => {
    if (!active || !delivered) return; // 決まらないあいだは pending のまま
    deliver({ schema: delivered.schema, key: delivered.key ?? source.key });
  };
  const onFail = (error: unknown) => {
    if (active) fail(error);
  };
  try {
    if (isSubscription(source)) {
      const unsubscribe = source.subscribe(onDelivered, onFail);
      return () => {
        active = false;
        unsubscribe();
      };
    }
    source.load().then(onDelivered, onFail);
  } catch (error) {
    onFail(error);
  }
  return () => {
    active = false;
  };
};

const readValue = (form: AnyFormApi, fieldPath: string) =>
  fieldPath === "" ? form.state.values : form.getFieldValue(fieldPath);

const writeValue = (form: AnyFormApi, fieldPath: string, value: unknown) => {
  if (fieldPath === "") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.baseStore.setState((state: any) => ({ ...state, values: value }));
    return;
  }
  // prune は利用者が触った欄ではないので、「触った」「変えた」にしない
  form.setFieldValue(fieldPath, value as never, {
    dontValidate: true,
    dontUpdateMeta: true,
  });
};

type ResolveOutcome =
  | { kind: "value"; result: SchemaResolveResult }
  | { kind: "thrown"; error: unknown };

type AsyncState =
  | { status: "pending"; resolved?: ResolvedSchema }
  | { status: "resolved"; resolved: ResolvedSchema }
  | { status: "error"; error: unknown; resolved?: ResolvedSchema };

/**
 * resolve を描画中に呼ぶ。非同期の取得は { key, load } / { key, subscribe } で返し、
 * load / subscribe は effect の中で呼ぶ（描画中には取りに行かない）。
 * Promise をそのまま返したら誤りにする（key が無いと、呼ばれるたびに取り直すしかないため）。
 */
const callResolve = (
  meta: DynamicMetaDef | undefined,
  input: FnInput,
): ResolveOutcome => {
  try {
    const result = meta
      ? (meta.resolve as (input: FnInput) => SchemaResolveResult)(input)
      : undefined;
    if (result instanceof Promise) {
      result.catch(() => {});
      throw new Error(
        "zf.dynamic: resolve が Promise を返しました。非同期に決まるときは { key, load } を返してください",
      );
    }
    return { kind: "value", result };
  } catch (error) {
    return { kind: "thrown", error };
  }
};

/**
 * dynamic の resolve を呼び、決まった schema をフォームの登録先に置く hook。
 *
 * - 同期で返る resolve は描画中に計算する（読み込み中を出さない）。副作用を持たないこと
 * - { key, load } と { key, subscribe } は、key が変わったら取り直しを始めて pending にし、
 *   失敗したら error にする。key が同じあいだは取り直さない（再試行のときだけ取り直す）
 * - key が前回適用したものと違い、かつ取り直しの出どころが利用者の編集なら、
 *   値を新しい schema に合わせて削る。それ以外は値に触らない
 * - 古い結果は捨てる
 */
export const useDynamicSchema = (
  meta: DynamicMetaDef | undefined,
  fieldPath: string,
  options: {
    /**
     * 同じ path の外側の包みの情報（props の outer）。登録する schema をこれで包み直す
     * （optional・nullable・default と、包みに付いた検査）
     */
    outer?: Outer;
    /**
     * 欄の schema（dynamic・externalKey の土台）。付いた検査（`.refine()` など）を、
     * 登録する schema に付け直す
     */
    schema?: z.ZodTypeAny;
  } = {},
): DynamicSchemaState => {
  const { outer, schema: fieldSchema } = options;
  const form = useFormApi();
  const runtime = useFormRuntime();
  const depth = useDynamicDepth(fieldPath);
  const input = useFnInput(meta, fieldPath);
  const [retryToken, setRetryToken] = useState(0);

  const outcome = useMemo<ResolveOutcome>(() => {
    return callResolve(meta, input);
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
    | {
        key: string;
        schema: z.ZodTypeAny;
        path: string;
        depth: number;
        outer: Outer | undefined;
        fieldSchema: z.ZodTypeAny | undefined;
      }
    | undefined
  >(undefined);
  const requestRef = useRef(0);
  const defaultFillRef = useRef<z.ZodTypeAny | undefined>(undefined);
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
      if (defaultFillRef.current) {
        runtime.removeDefaultFill(fieldPath, defaultFillRef.current);
        defaultFillRef.current = undefined;
      }
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
        previous.depth === depth &&
        previous.outer === outer &&
        previous.fieldSchema === fieldSchema
      ) {
        return;
      }
      const wrapped = rewrapWithOuter(resolved.schema, fieldSchema, outer);
      appliedRef.current = {
        key: resolved.key,
        schema: resolved.schema,
        path: fieldPath,
        depth,
        outer,
        fieldSchema,
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
      } else if (previous === undefined) {
        // 最初に決まったとき：値が無いところだけを既定値で補う（削らない。保存済みのデータかもしれない）。
        // 外側の包み（optional・nullable・default）ごと歩くので、optional で値が無ければ補わない。
        // 利用者の編集ではないので runAsUserEdit で包まず、「触った」「変えた」にもしない。
        // AutoForm が defaultValues にも同じ補いを入れられるよう、runtime に登録する
        defaultFillRef.current = wrapped;
        runtime.setDefaultFill(fieldPath, wrapped);
        const current = readValue(form, fieldPath);
        const next = getDefaultValue(wrapped, current);
        if (!isEqualValue(current, next)) {
          writeValue(form, fieldPath, next);
        }
        seenRevRef.current = runtime.currentRev();
      }
      runtime.set(fieldPath, depth, {
        status: "resolved",
        schema: wrapped,
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
    if (!isAsyncSource(result)) {
      // 決まらないあいだは pending のまま
      stopAsync();
      runtime.set(fieldPath, depth, { status: "pending" });
      setAsyncState((state) => ({
        status: "pending",
        resolved: state.resolved,
      }));
      return;
    }
    if (result.key === subscriptionKeyRef.current) {
      return; // 同じ key のあいだは取り直さない
    }

    stopAsync();
    const request = requestRef.current;
    const isCurrent = () => request === requestRef.current;
    runtime.set(fieldPath, depth, { status: "pending" });
    setAsyncState((state) => ({ status: "pending", resolved: state.resolved }));

    const deliver = (resolved: ResolvedSchema) => {
      if (!isCurrent()) return; // 古い結果は捨てる
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

    subscriptionKeyRef.current = result.key;
    unsubscribeRef.current = startAsync(result, deliver, fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, fieldPath, depth, outer, fieldSchema]);

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

/**
 * フォームの外（表など読み取り専用の場所）で dynamic の resolve を呼び、schema を得る hook。
 * 登録・検証・prune はしない。同期・一度だけの取得・購読のどれにも対応する。
 */
export const useResolvedSchema = (
  meta: DynamicMetaDef | undefined,
  input: FnInput,
): DynamicSchemaState => {
  const [retryToken, setRetryToken] = useState(0);
  const outcome = useMemo<ResolveOutcome>(() => {
    return callResolve(meta, input);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, input, retryToken]);
  const syncResolved =
    outcome.kind === "value" && isResolvedSchema(outcome.result)
      ? outcome.result
      : undefined;
  const [asyncState, setAsyncState] = useState<AsyncState>({
    status: "pending",
  });
  const subscriptionKeyRef = useRef<string | undefined>(undefined);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);
  const requestRef = useRef(0);

  useEffect(
    () => () => {
      requestRef.current += 1;
      unsubscribeRef.current?.();
    },
    [],
  );

  useEffect(() => {
    if (outcome.kind === "thrown" || syncResolved) return;
    const result = outcome.result;
    if (!isAsyncSource(result)) return; // 決まらないあいだは pending のまま
    if (result.key === subscriptionKeyRef.current) return; // 同じ key は取り直さない
    requestRef.current += 1;
    unsubscribeRef.current?.();
    unsubscribeRef.current = undefined;
    const request = requestRef.current;
    const deliver = (resolved: ResolvedSchema) => {
      if (request !== requestRef.current) return;
      setAsyncState({ status: "resolved", resolved });
    };
    const fail = (error: unknown) => {
      if (request !== requestRef.current) return;
      setAsyncState((state) => ({
        status: "error",
        error,
        resolved: state.resolved,
      }));
    };
    setAsyncState((state) => ({ status: "pending", resolved: state.resolved }));
    subscriptionKeyRef.current = result.key;
    unsubscribeRef.current = startAsync(result, deliver, fail);
  }, [outcome, syncResolved]);

  const retry = () => {
    subscriptionKeyRef.current = undefined;
    setRetryToken((token) => token + 1);
  };
  if (outcome.kind === "thrown") {
    return { status: "error", error: outcome.error, retry };
  }
  if (syncResolved) {
    return { status: "resolved", schema: syncResolved.schema };
  }
  if (asyncState.status === "error") {
    return { status: "error", error: asyncState.error, retry };
  }
  if (asyncState.status === "resolved") {
    return { status: "resolved", schema: asyncState.resolved.schema };
  }
  return asyncState.resolved
    ? { status: "pending", schema: asyncState.resolved.schema }
    : { status: "loading" };
};
