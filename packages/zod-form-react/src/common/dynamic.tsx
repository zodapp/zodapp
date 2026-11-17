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
type Check = z.core.$ZodCheck<unknown>;

/**
 * 登録する schema を包み直す。
 * 1. 欄の schema（dynamic・externalKey の土台）に付いた検査（`.refine()`・`.min()` など）を付け直す。
 *    zod 4 では refine も包みを作らず、同じ型の複製の `def.checks` に入る
 *    （zf の meta は zod-propagating-registry で複製に引き継がれるので、部品はこの schema を受け取る）
 * 2. 欄の optional・nullable に合わせて包む
 */
const wrapEmpty = (
  schema: z.ZodTypeAny,
  {
    optional,
    nullable,
    checks,
  }: { optional: boolean; nullable: boolean; checks: readonly Check[] },
): z.ZodTypeAny => {
  const checked =
    checks.length > 0
      ? (schema.check(...(checks as Check[])) as z.ZodTypeAny)
      : schema;
  const withNull = nullable ? checked.nullable() : checked;
  return optional ? withNull.optional() : withNull;
};

const checksOf = (schema: z.ZodTypeAny | undefined): readonly Check[] =>
  ((schema as unknown as { def?: { checks?: Check[] } } | undefined)?.def
    ?.checks ?? []) as Check[];

export const useDynamicSchema = (
  meta: DynamicMetaDef | undefined,
  fieldPath: string,
  options: {
    /**
     * true なら（optional の中にあるなら）、登録する schema を optional にする。
     * 値が無いときに、決まった schema の「必須」で止めないため
     */
    optional?: boolean;
    /**
     * true なら（nullable の中にあるなら）、登録する schema を nullable にする。
     * 空にした欄に書く null を、決まった schema の検証で止めないため
     */
    nullable?: boolean;
    /**
     * 欄の schema（dynamic・externalKey の土台）。付いた検査（`.refine()` など）を、
     * 登録する schema に付け直す
     */
    schema?: z.ZodTypeAny;
  } = {},
): DynamicSchemaState => {
  const optional = options.optional === true;
  const nullable = options.nullable === true;
  const fieldSchema = options.schema;
  const checks = useMemo(() => checksOf(fieldSchema), [fieldSchema]);
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
        optional: boolean;
        nullable: boolean;
        checks: readonly Check[];
      }
    | undefined
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
        previous.depth === depth &&
        previous.optional === optional &&
        previous.nullable === nullable &&
        previous.checks === checks
      ) {
        return;
      }
      appliedRef.current = {
        key: resolved.key,
        schema: resolved.schema,
        path: fieldPath,
        depth,
        optional,
        nullable,
        checks,
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
        schema: wrapEmpty(resolved.schema, { optional, nullable, checks }),
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
  }, [outcome, fieldPath, depth, optional, nullable, checks]);

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
