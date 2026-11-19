import { previewReplacer } from "./previewReplacer";
import {
  Suspense,
  useMemo,
  useState,
  useEffect,
  memo,
  useCallback,
  useRef,
} from "react";
import { Alert, Code, Group, Loader, Stack, Text } from "@mantine/core";
import {
  Switch,
  FormProvider,
  ZodFormContextProvider,
  ValidatePrecedingFieldsProvider,
  FormRuntime,
  useDefaultValuesWithFills,
  useZodForm,
  componentLibrary as defaultComponentLibrary,
} from "@zodapp/zod-form-mantine";
import {
  getDefaultValue,
  type ExternalKeyResolvers,
  type FileResolvers,
} from "@zodapp/zod-form";
import type { RegisteredResolverContext } from "@zodapp/zod-form/resolverContext/types";
import type {
  MediaResolvers,
  ValueActionResolver,
  CollectionReferenceActionEntry,
  ComponentLibrary,
} from "@zodapp/zod-form-react";
import type { z } from "zod";
import { submitBlockedReasons } from "./submitBlocked";
import {
  type AutoFormAction,
  type AutoFormActionComponent,
  normalizeAutoFormActionComponents,
} from "./autoFormActions";
import { useMsg } from "../messages/useMsg";

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
  /**
   * ボタンの行を入力欄の上と下のどちらに置くか。省略時は "top"。
   */
  actionsPosition?: "top" | "bottom";
  /**
   * 描画に使う ComponentLibrary。省略時は zod-form-mantine の
   * componentLibrary。カスタムウィジェットを使う場合は
   * `{ ...componentLibrary, 独自キー: ... }` を渡す。
   */
  componentLibrary?: ComponentLibrary;
  externalKeyResolvers?: ExternalKeyResolvers;
  valueActionResolver?: ValueActionResolver;
  fileResolvers?: FileResolvers;
  mediaResolvers?: MediaResolvers;
  resolverContext?: RegisteredResolverContext;
  collectionReferenceActions?: readonly CollectionReferenceActionEntry[];
  readOnly?: boolean;
};

/**
 * defaultValues を schema の既定値で補う。補えなければ（optional の付かない z.lazy の無限の再帰など）、
 * 補わずに渡された値を使う
 */
const fillDefaultValues = (schema: z.ZodTypeAny, defaultValues: unknown) => {
  try {
    return getDefaultValue(schema, defaultValues) ?? defaultValues ?? {};
  } catch (error) {
    console.error(
      "[AutoForm] Could not fill the default values from the schema:",
      error,
    );
    return defaultValues ?? {};
  }
};

const AutoFormInner = <T extends z.ZodTypeAny>({
  schema,
  defaultValues,
  actions,
  actionComponents,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel: submitLabelFromProps,
  cancelLabel: cancelLabelFromProps,
  showPreview = false,
  actionsPosition = "top",
  componentLibrary = defaultComponentLibrary,
  externalKeyResolvers,
  valueActionResolver,
  fileResolvers,
  mediaResolvers,
  resolverContext,
  collectionReferenceActions,
  readOnly = false,
}: AutoFormProps<T>) => {
  const msg = useMsg();
  const submitLabel =
    submitLabelFromProps ?? msg("zodFormWidget.autoForm.submit" /* 保存 */);
  const cancelLabel =
    cancelLabelFromProps ?? msg("zodFormWidget.common.cancel" /* キャンセル */);
  // 開くときに、値が無いところを schema の既定値で補う（`.default()`・空の配列・値が 1 つの literal など）。
  // 補った値は既定値に入るので、開いただけでは「変更あり」にならない
  const initialValues = useMemo(
    () => fillDefaultValues(schema, defaultValues) as z.input<T>,
    [schema, defaultValues],
  );
  const defaultSubmitHandlerRef = useRef(onSubmit);
  const pendingSubmitHandlerRef = useRef<
    ((data: z.output<T>) => void) | undefined
  >(undefined);

  // 実行時に決まる schema（zf.dynamic）の登録先。フォーム全体の validator を包み、
  // 静的な schema に加えて、登録された path の schema でも検証する。
  // 包んだ validator は standard schema の形なので、TanStack Form 1.33 以降の
  // validators の型（RejectPromiseValidator<T>）にもそのまま渡せる。
  const [runtime] = useState(() => new FormRuntime());
  // 検証は通ったが parse できなかったときの issue（送信が止まった理由に使う）
  const parseIssuesRef = useRef<readonly { code?: string }[] | undefined>(
    undefined,
  );
  const validator = useMemo(
    () => runtime.wrapValidator<z.input<T>>(schema),
    [runtime, schema],
  );

  // dynamic が補った既定値を defaultValues にも入れる（開いただけで「変更あり」にせず、reset でも残す）
  const defaultValuesWithFills = useDefaultValuesWithFills(
    runtime,
    initialValues,
  );

  const form = useZodForm({
    defaultValues: defaultValuesWithFills,
    validators: {
      onChange: validator,
      onBlur: validator,
      onSubmit: validator,
    },
    // onSubmit には parse した値（output）を渡す。parse できなければ送らない
    // （止まった理由は handleSubmit が出す。onCancel にはフォームの値（input）を渡す）
    onSubmit: ({ value }) => {
      const parsed = runtime.parse(schema, value);
      if (!parsed.success) {
        parseIssuesRef.current = parsed.issues;
        return;
      }
      const handler =
        pendingSubmitHandlerRef.current ?? defaultSubmitHandlerRef.current;
      pendingSubmitHandlerRef.current = undefined;
      handler?.(parsed.data as z.output<T>);
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

  // 送信が止まった理由。次に送信を押すまで出したままにし、送信が通れば消す
  const [blockedReasons, setBlockedReasons] = useState<string[]>([]);

  const handleSubmit = useCallback(() => {
    return new Promise<z.output<T> | undefined>((resolve, reject) => {
      pendingSubmitHandlerRef.current = (data: z.output<T>) => {
        setBlockedReasons([]);
        resolve(data);
      };

      parseIssuesRef.current = undefined;
      void form
        .handleSubmit()
        .then(() => {
          if (!form.state.isValid) {
            // 登録された schema（読み込み中・取得失敗を含む）でも通るときだけ送る
            const issues = runtime.validate(schema, form.state.values);
            const parsed =
              issues.length === 0
                ? runtime.parse(schema, form.state.values)
                : undefined;
            if (parsed?.success) {
              const handler = pendingSubmitHandlerRef.current;
              pendingSubmitHandlerRef.current = undefined;
              handler?.(parsed.data as z.output<T>);
              resolve(parsed.data as z.output<T>);
              return;
            }
            console.warn("[AutoForm] Validation errors:", form.getAllErrors());
            setBlockedReasons(
              submitBlockedReasons(
                parsed && !parsed.success ? parsed.issues : issues,
              ),
            );
            pendingSubmitHandlerRef.current = undefined;
            resolve(undefined);
            return;
          }
          // 検証は通ったが parse できなかった（onSubmit が送らなかった）
          const parseIssues = parseIssuesRef.current;
          if (parseIssues) {
            parseIssuesRef.current = undefined;
            console.warn("[AutoForm] Could not parse the values:", parseIssues);
            setBlockedReasons(submitBlockedReasons(parseIssues));
            pendingSubmitHandlerRef.current = undefined;
            resolve(undefined);
          }
        })
        .catch(reject);
    });
  }, [form, schema, runtime]);

  const submitBlocked = blockedReasons.length > 0 && (
    <Alert color="red" mt="xs" data-testid="form-submit-blocked">
      <Stack gap={2}>
        {blockedReasons.map((reason) => (
          <Text key={reason} size="sm">
            {msg.resolve(reason)}
          </Text>
        ))}
      </Stack>
    </Alert>
  );

  const actionsGroup = normalizedActionComponents.length > 0 && (
    <>
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
      {submitBlocked}
    </>
  );

  return (
    <Suspense fallback={<Loader />}>
      <ZodFormContextProvider
        merge
        componentLibrary={componentLibrary}
        externalKeyResolvers={externalKeyResolvers}
        valueActionResolver={valueActionResolver}
        fileResolvers={fileResolvers}
        mediaResolvers={mediaResolvers}
        resolverContext={resolverContext}
        collectionReferenceActions={collectionReferenceActions}
      >
        <FormProvider form={form} runtime={runtime}>
          <ValidatePrecedingFieldsProvider>
            {/*
              TanStack Form の公式の書き方に合わせて form で包む。Enter を押すと、
              ブラウザが最初の type="submit" のボタン（submit のアクション）を押す。
              送信はボタンの onClick で行うので、ここではページの遷移を止めるだけにする。
              stopPropagation は、モーダルの中の AutoForm の submit が、React の
              イベントとして外側の form に伝わらないようにするため。
              noValidate は、ブラウザ自前の入力チェックを出さず、zod の検証に任せるため。
            */}
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {actionsPosition === "top" && actionsGroup}
              {/* デモ・デバッグ用: リアクティブに現在の値を表示 */}
              {showPreview && (
                <Code block style={{ maxHeight: 200, overflow: "auto" }}>
                  {JSON.stringify(formValues, previewReplacer, 2)}
                </Code>
              )}
              <Switch fieldPath="" schema={schema} readOnly={readOnly} />
              {actionsPosition === "bottom" && actionsGroup}
            </form>
          </ValidatePrecedingFieldsProvider>
        </FormProvider>
      </ZodFormContextProvider>
    </Suspense>
  );
};

export const AutoForm = memo(AutoFormInner) as typeof AutoFormInner;
