import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  AnyFieldApi,
  AnyFormApi,
  useField as useTanstackField,
  useForm as useTanstackForm,
} from "@tanstack/react-form";

type FormContextValue = {
  form: AnyFormApi;
};

const FormContext = createContext<FormContextValue | null>(null);

/**
 * フォーム API（TanStack React Form）を Context として提供します。
 *
 * `useFormApi()` / `useZodField()` はこの Provider 配下で使用してください。
 */
export const FormProvider = ({
  form,
  children,
}: {
  form: AnyFormApi;
  children: React.ReactNode;
}) => {
  const value = useMemo(() => ({ form }), [form]);
  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};

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
      return form.store.subscribe(onStoreChange);
    },
    [form.store],
  );

  const getSnapshot = useCallback(() => {
    return form.store.state.values as TValues;
  }, [form.store]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
