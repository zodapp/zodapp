import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Card,
  Grid,
  Group,
  List,
  Stack,
  Text,
} from "@mantine/core";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import { z } from "zod";
import { stableStringify } from "@zodapp/caching-utilities";
import { hideSchemaFieldsExcept } from "@zodapp/zod-form";
import type { StandardSchemaV1 } from "@tanstack/react-form";
import {
  componentLibrary,
  FormProvider,
  Switch,
  useFormValues,
  useZodForm,
  ValidatePrecedingFieldsProvider,
  ZodFormContextProvider,
} from "@zodapp/zod-form-mantine";
import {
  AutoForm,
  createAutoFormButtonAction,
  createAutoFormResetAction,
  createAutoFormSubmitAction,
} from "@zodapp/zod-form-widget/form";

import { surveysCollection } from "../../../shared/survey/collections";
import { buildSurveySchema } from "../../../shared/survey/buildSurveySchema";

/**
 * アンケートビルダー（2 カラム: 設定 + ライブプレビュー）。
 *
 * 左の設定フォームは AutoForm ではなく `useZodForm` + `FormProvider` + `Switch`
 * で手組みしている。AutoForm はフォーム値を外部へ公開しないため、
 * 「編集中（未保存）の値からプレビューを組み立てる」には同じ form インスタンスを
 * 右カラムからも購読する必要があるため。
 * 右カラムは `useFormValues()` で値を購読し、`buildSurveySchema()` で
 * 実行時にスキーマを組み立てて AutoForm に渡す。
 */

type EditorSchema = typeof surveysCollection.updateSchema;
type SurveyDoc = z.infer<typeof surveysCollection.dataSchema>;

// updateSchema は動的に組み立てられるため静的な値型を持たない。
// フォーム値としては「編集対象のフィールドだけ」を緩く型付けする
type EditorValues = {
  title?: string;
  description?: string;
  fields?: unknown;
  [key: string]: unknown;
};

export type SurveyBuilderProps = {
  survey: SurveyDoc;
  workspaceId: string;
  surveyId: string;
  onSaveDraft: (data: z.output<EditorSchema>) => Promise<void>;
  onPublish: () => Promise<void>;
  isSaving: boolean;
};

/** 右カラム: 編集中の質問定義からリアルタイムに組み立てた回答フォーム */
const SurveyPreview = () => {
  const values = useFormValues<EditorValues>();
  const fields = values?.fields;

  const { schema, warnings, fieldErrors } = useMemo(
    () => buildSurveySchema(fields),
    [fields],
  );

  // スキーマが変わったらプレビューのフォーム状態をリセットする
  const previewKey = useMemo(() => stableStringify(fields ?? []), [fields]);
  const questionCount = Object.keys(schema.shape).length;

  return (
    <Card withBorder style={{ position: "sticky", top: 76 }}>
      <Group justify="space-between" mb="md">
        <Text fw={500}>プレビュー</Text>
        <Text size="sm" c="dimmed">
          {questionCount} 問
        </Text>
      </Group>

      <Stack gap="sm">
        {values?.description && (
          <Text size="sm" c="dimmed">
            {values.description}
          </Text>
        )}

        {fieldErrors.length > 0 && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="red"
            variant="light"
            title="表示できない質問があります"
          >
            <List size="sm">
              {fieldErrors.map((error) => (
                <List.Item key={error.id}>
                  {error.id}: {error.message}
                </List.Item>
              ))}
            </List>
          </Alert>
        )}

        {warnings.length > 0 && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="yellow"
            variant="light"
          >
            <List size="sm">
              {warnings.map((warning) => (
                <List.Item key={warning}>{warning}</List.Item>
              ))}
            </List>
          </Alert>
        )}

        {questionCount === 0 ? (
          <Text size="sm" c="dimmed">
            左の「質問」から質問を追加すると、ここに回答フォームが表示されます。
          </Text>
        ) : (
          <AutoForm key={previewKey} schema={schema} actions={[]} />
        )}
      </Stack>
    </Card>
  );
};

export const SurveyBuilder = ({
  survey,
  onSaveDraft,
  onPublish,
  isSaving,
}: SurveyBuilderProps) => {
  // 編集対象は title / description / fields のみ。
  // status / revision などはヘッダとアクション側で扱う
  const editorSchema = useMemo(
    () =>
      hideSchemaFieldsExcept(surveysCollection.updateSchema, {
        paths: ["title", "description", "fields"],
      }),
    [],
  );

  const validator = editorSchema as unknown as StandardSchemaV1<
    EditorValues,
    unknown
  >;
  const form = useZodForm({
    defaultValues: survey as unknown as EditorValues,
    validators: {
      onChange: validator,
      onBlur: validator,
      onSubmit: validator,
    },
    onSubmit: () => {
      // 送信は下のアクション（handleSubmit の戻り値）で処理する
    },
  });

  const [isPublishing, setIsPublishing] = useState(false);

  // アクションコンポーネント（createAutoForm*Action）が要求する送信関数。
  // バリデーションを走らせ、成功時のみパース済みの値を返す
  const handleSubmit = useCallback(async () => {
    await form.handleSubmit();
    const parsed = editorSchema.safeParse(form.state.values);
    if (!parsed.success) {
      console.warn("[SurveyBuilder] 入力エラー:", form.getAllErrors());
      return undefined;
    }
    return parsed.data as z.output<EditorSchema>;
  }, [form, editorSchema]);

  const actionComponents = useMemo(
    () => [
      createAutoFormResetAction<EditorSchema>({
        label: "変更を破棄",
        variant: "light",
        color: "orange",
        // 保存済みの内容と同じなら破棄するものがない
        disabled: ({ formState }) => formState.isDefaultValue,
      }),
      createAutoFormSubmitAction<EditorSchema>({
        label: "下書き保存",
        variant: "default",
        disabled: ({ formState }) => formState.isDefaultValue,
        onSubmit: onSaveDraft,
      }),
      createAutoFormButtonAction<EditorSchema>({
        label: survey.status === "published" ? "公開内容を更新" : "公開する",
        color: "green",
        // 未保存の変更があるうちは公開させない（先に保存させる）
        disabled: ({ formState }) => !formState.isDefaultValue,
        loading: () => isPublishing,
        onClick: async () => {
          setIsPublishing(true);
          try {
            await onPublish();
          } finally {
            setIsPublishing(false);
          }
        },
      }),
    ],
    [onSaveDraft, onPublish, survey.status, isPublishing],
  );

  return (
    <ZodFormContextProvider merge componentLibrary={componentLibrary}>
      <FormProvider form={form}>
        <ValidatePrecedingFieldsProvider>
          <Grid gap="lg">
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card withBorder>
                <Group justify="space-between" mb="md" wrap="wrap">
                  <Text fw={500}>設定</Text>
                  <Group gap="xs">
                    {actionComponents.map((ActionComponent, index) => (
                      <ActionComponent
                        key={index}
                        form={form}
                        handleSubmit={handleSubmit}
                        isLoading={isSaving}
                      />
                    ))}
                  </Group>
                </Group>
                <Switch fieldPath="" schema={editorSchema} />
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <SurveyPreview />
            </Grid.Col>
          </Grid>
        </ValidatePrecedingFieldsProvider>
      </FormProvider>
    </ZodFormContextProvider>
  );
};
