import {
  Suspense,
  useMemo,
  useState,
  useEffect,
  memo,
  useCallback,
  useRef,
} from "react";
import { Button, Code, Group, Loader, Stack } from "@mantine/core";
import {
  componentLibrary,
  Dynamic,
  FormProvider,
  ZodFormContextProvider,
  ValidatePrecedingFieldsProvider,
  useZodForm,
} from "@zodapp/zod-form-mantine";
import type { ExternalKeyResolvers, FileResolvers } from "@zodapp/zod-form";
import type { RegisteredResolverContext } from "@zodapp/zod-form/resolverContext/types";
import type {
  MediaResolvers,
  ExternalKeyActionResolver,
  CollectionReferenceActionEntry,
} from "@zodapp/zod-form-react";
import type { z } from "zod";
import {
  normalizeAutoFormActions,
  type AutoFormAction,
} from "./autoFormActions";

type AutoFormProps<T extends z.ZodTypeAny> = {
  schema: T;
  defaultValues?: z.input<T> | Partial<z.input<T>>;
  actions?: readonly AutoFormAction<T>[];
  onSubmit?: (data: z.output<T>) => void;
  onCancel?: (data: z.input<T>) => void;
  isLoading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  showPreview?: boolean;
  externalKeyResolvers?: ExternalKeyResolvers;
  externalKeyActionResolver?: ExternalKeyActionResolver;
  fileResolvers?: FileResolvers;
  mediaResolvers?: MediaResolvers;
  resolverContext?: RegisteredResolverContext;
  collectionReferenceActions?: readonly CollectionReferenceActionEntry[];
  readOnly?: boolean;
};

const AutoFormInner = <T extends z.ZodTypeAny>({
  schema,
  defaultValues,
  actions,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = "保存",
  cancelLabel = "キャンセル",
  showPreview = false,
  externalKeyResolvers,
  externalKeyActionResolver,
  fileResolvers,
  mediaResolvers,
  resolverContext,
  collectionReferenceActions,
  readOnly = false,
}: AutoFormProps<T>) => {
  const initialValues = useMemo(
    () => (defaultValues ?? {}) as z.input<T>,
    [defaultValues],
  );
  const defaultSubmitHandlerRef = useRef(onSubmit);
  const pendingSubmitHandlerRef = useRef<
    ((data: z.output<T>) => void) | undefined
  >(undefined);

  const form = useZodForm({
    defaultValues: initialValues,
    validators: {
      onChange: schema,
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: ({ value }) => {
      const handler =
        pendingSubmitHandlerRef.current ?? defaultSubmitHandlerRef.current;
      pendingSubmitHandlerRef.current = undefined;
      handler?.(value as z.output<T>);
    },
  });

  useEffect(() => {
    defaultSubmitHandlerRef.current = onSubmit;
  }, [onSubmit]);

  // デバッグ用: リアクティブに現在の値を購読
  const [formValues, setFormValues] = useState(() => form.state.values);
  useEffect(() => {
    if (!showPreview) return;
    const subscription = form.store.subscribe(() => {
      setFormValues(form.state.values);
    });
    return () => subscription.unsubscribe();
  }, [form, showPreview]);

  const normalizedActions = useMemo(
    () =>
      normalizeAutoFormActions({
        actions,
        onSubmit,
        onCancel,
        submitLabel,
        cancelLabel,
      }),
    [actions, cancelLabel, onCancel, onSubmit, submitLabel],
  );

  const handleSubmitAction = useCallback(
    async (handler: (data: z.output<T>) => void) => {
      pendingSubmitHandlerRef.current = handler;
      await form.handleSubmit();
      if (!form.state.isValid) {
        console.warn("[AutoForm] Validation errors:", form.getAllErrors());
        pendingSubmitHandlerRef.current = undefined;
      }
    },
    [form],
  );

  return (
    <Suspense fallback={<Loader />}>
      <ZodFormContextProvider
        componentLibrary={componentLibrary}
        externalKeyResolvers={externalKeyResolvers}
        externalKeyActionResolver={externalKeyActionResolver}
        fileResolvers={fileResolvers}
        mediaResolvers={mediaResolvers}
        resolverContext={resolverContext}
        collectionReferenceActions={collectionReferenceActions}
      >
        <FormProvider form={form}>
          <ValidatePrecedingFieldsProvider>
            <Stack gap="md">
              <Dynamic fieldPath="" schema={schema} readOnly={readOnly} />

              {!readOnly && normalizedActions.length > 0 && (
                <Group justify="flex-end" mt="md">
                  {normalizedActions.map((action, index) => {
                    const disabled = isLoading || action.disabled;
                    const loading = action.loading ?? false;

                    if (action.type === "submit") {
                      return (
                        <Button
                          key={index}
                          variant={action.variant}
                          color={action.color}
                          onClick={() => handleSubmitAction(action.onSubmit)}
                          type="button"
                          loading={loading}
                          disabled={disabled}
                        >
                          {action.label}
                        </Button>
                      );
                    }

                    if (action.type === "cancel") {
                      return (
                        <Button
                          key={index}
                          variant={action.variant}
                          color={action.color}
                          onClick={() => action.onCancel(form.state.values)}
                          type="button"
                          loading={loading}
                          disabled={disabled}
                        >
                          {action.label}
                        </Button>
                      );
                    }

                    return (
                      <Button
                        key={index}
                        variant={action.variant}
                        color={action.color}
                        onClick={() =>
                          action.onClick({ values: form.state.values })
                        }
                        type="button"
                        loading={loading}
                        disabled={disabled}
                      >
                        {action.label}
                      </Button>
                    );
                  })}
                </Group>
              )}
              {/* デモ・デバッグ用: リアクティブに現在の値を表示 */}
              {showPreview && (
                <Code block style={{ maxHeight: 200, overflow: "auto" }}>
                  {JSON.stringify(
                    formValues,
                    (_key, value) => {
                      if (typeof value === "bigint") {
                        return value.toString();
                      }
                      return value;
                    },
                    2,
                  )}
                </Code>
              )}
            </Stack>
          </ValidatePrecedingFieldsProvider>
        </FormProvider>
      </ZodFormContextProvider>
    </Suspense>
  );
};

export const AutoForm = memo(AutoFormInner) as typeof AutoFormInner;
