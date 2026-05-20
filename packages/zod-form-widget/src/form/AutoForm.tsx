import {
  Suspense,
  useMemo,
  useState,
  useEffect,
  memo,
  useCallback,
  useRef,
} from "react";
import { Code, Group, Loader } from "@mantine/core";
import {
  componentLibrary,
  Switch,
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
  type AutoFormAction,
  type AutoFormActionComponent,
  normalizeAutoFormActionComponents,
} from "./autoFormActions";

type AutoFormProps<T extends z.ZodTypeAny> = {
  schema: T;
  defaultValues?: z.input<T> | Partial<z.input<T>>;
  actions?: readonly AutoFormAction<T>[];
  actionComponents?: readonly AutoFormActionComponent<T>[];
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
  actionComponents,
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

  const normalizedActionComponents = useMemo(
    () =>
      normalizeAutoFormActionComponents({
        actionComponents,
        actions,
        onSubmit,
        onCancel,
        submitLabel,
        cancelLabel,
      }),
    [actionComponents, actions, cancelLabel, onCancel, onSubmit, submitLabel],
  );

  const handleSubmit = useCallback(() => {
    return new Promise<z.output<T> | undefined>((resolve, reject) => {
      pendingSubmitHandlerRef.current = (data: z.output<T>) => {
        resolve(data);
      };

      void form
        .handleSubmit()
        .then(() => {
          if (!form.state.isValid) {
            console.warn("[AutoForm] Validation errors:", form.getAllErrors());
            pendingSubmitHandlerRef.current = undefined;
            resolve(undefined);
          }
        })
        .catch(reject);
    });
  }, [form]);

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
            <div>
              {normalizedActionComponents.length > 0 && (
                <Group justify="flex-end" mt="md">
                  {normalizedActionComponents.map((ActionComponent, index) => {
                    return (
                      <ActionComponent
                        key={index}
                        form={form}
                        handleSubmit={handleSubmit}
                        isLoading={isLoading}
                      />
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
              <Switch fieldPath="" schema={schema} readOnly={readOnly} />
            </div>
          </ValidatePrecedingFieldsProvider>
        </FormProvider>
      </ZodFormContextProvider>
    </Suspense>
  );
};

export const AutoForm = memo(AutoFormInner) as typeof AutoFormInner;
