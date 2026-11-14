import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AnyFieldApi,
  AnyFormApi,
  useField as useTanstackField,
  useForm as useTanstackForm,
} from "@tanstack/react-form";
import { FormRuntime } from "./schemaRegistry";

type FormContextValue = {
  form: AnyFormApi;
  runtime: FormRuntime;
};

const FormContext = createContext<FormContextValue | null>(null);

/**
 * フォーム API（TanStack React Form）を Context として提供します。
 *
 * `useFormApi()` / `useZodField()` はこの Provider 配下で使用してください。
 */
export const FormProvider = ({
  form,
  runtime: runtimeProp,
  children,
}: {
  form: AnyFormApi;
  /**
   * 実行時に決まる schema の登録先と、値の変更の出どころの記録。
   * フォームの validators を {@link FormRuntime.wrapValidator} で包むときは、
   * 同じものを渡す。省略時は内部で作る（その場合、登録された schema は検証に使われない）。
   */
  runtime?: FormRuntime;
  children: React.ReactNode;
}) => {
  const [ownRuntime] = useState(() => new FormRuntime());
  const runtime = runtimeProp ?? ownRuntime;
  // store の購読は描画中に始める。子の effect で起きる最初の書き込みも記録するため
  runtime.attach(form);
  useEffect(() => {
    runtime.attach(form);
    return () => runtime.release(form);
  }, [runtime, form]);
  const value = useMemo(() => ({ form, runtime }), [form, runtime]);
  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};

/**
 * `FormProvider` のフォームの実行時の状態（{@link FormRuntime}）を取得します。
 */
export const useFormRuntime = (): FormRuntime => {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("useFormRuntime must be used inside FormProvider");
  }
  return ctx.runtime;
};

/**
 * fn を同期で実行し、そのあいだに起きたフォームの値の変更を「利用者の編集」として
 * 記録する関数を返します。dynamic は、利用者の編集が原因で schema の key が
 * 変わったときだけ値を新しい schema に合わせて削ります。
 *
 * 共通の関数の中は普通に書き、呼ぶ側が包むかどうかで分類が変わります
 * （React の startTransition と同じ考え方）。
 *
 * @example
 * const runAsUserEdit = useRunAsUserEdit();
 * applyAddress(form, loaded);                       // 外からの反映として
 * runAsUserEdit(() => applyAddress(form, picked));  // 利用者の編集として
 */
export const useRunAsUserEdit = (): (<T>(fn: () => T) => T) => {
  const ctx = useContext(FormContext);
  return ctx ? ctx.runtime.runAsUserEdit : runDirectly;
};

const runDirectly = <T,>(fn: () => T): T => fn();

/**
 * `FormProvider` が提供する form API を取得します。
 *
 * Provider 外で呼ぶと例外になります。
 */
export const useFormApi = <TForm extends AnyFormApi = AnyFormApi>() => {
  const ctx = useContext(FormContext);
  if (!ctx) {
    throw new Error("useFormApi must be used inside FormProvider");
  }
  return ctx.form as TForm;
};

export const useZodForm = useTanstackForm;

type UseFieldOpts = Parameters<typeof useTanstackField>[0];

/**
 * `FormProvider` の form を使って field を生成します。
 *
 * TanStack React Form の `useField()` に薄いラッパをかけ、`form` を暗黙に注入します。
 */
export const useZodField = <TValue = unknown,>(
  name: string,
  options?: Omit<UseFieldOpts, "form" | "name"> & { defaultValue?: TValue },
) => {
  const form = useFormApi();
  return useTanstackField({
    form,
    name,
    ...options,
  }) as unknown as AnyFieldApi;
};

/**
 * フォーム全体の値を購読するhook
 */
export const useFormValues = <TValues = unknown,>() => {
  const form = useFormApi();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      // useSyncExternalStore はティアダウンとして () => void を要求する。
      // @tanstack/store 0.9 系では subscribe が Subscription を返すため .unsubscribe() で包む。
      const subscription = form.store.subscribe(onStoreChange);
      return () => subscription.unsubscribe();
    },
    [form.store],
  );

  const getSnapshot = useCallback(() => {
    return form.store.state.values as TValues;
  }, [form.store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
