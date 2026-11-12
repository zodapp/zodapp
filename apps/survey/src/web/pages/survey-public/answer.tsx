import {
  Title,
  Container,
  Card,
  Group,
  Stack,
  Loader,
  Center,
  Alert,
  Text,
  Button,
  List,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import { Link, useParams } from "@tanstack/react-router";
import { useStore, type AnyFormApi } from "@tanstack/react-form";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApi } from "@zodapp/zod-dynamodb-react";
import { useSessionStorageState } from "@zodapp/react-storage";
import type { AutoFormAction } from "@zodapp/zod-form-widget/form";

import { AutoForm } from "../../components/AutoForm";
import { buildSurveySchema } from "../../../shared/survey/buildSurveySchema";
import {
  fromStoredAnswers,
  toStoredAnswers,
  type StoredAnswers,
} from "../../../shared/survey/answers";
import type { Api } from "../../shared/api";
import { useSurvey } from "../../shared/hooks";
import { useAuthContext } from "../../shared/auth";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import { surveyAnswerRoute } from "./answer.route";
import { responsesRoute } from "../survey-workspace/responses.route";

import pageCode from "./answer.tsx?raw";
import buildSurveySchemaCode from "../../../shared/survey/buildSurveySchema.ts?raw";

/**
 * 入力中の値を受け取り、保存する形（日付は YYYY-MM-DD）にして渡す。
 * AutoForm の actions の custom で描くので、フォームの状態（TanStack Form）を読める
 */
const AnswerDraftSaver = ({
  form,
  fields,
  onChange,
}: {
  form: AnyFormApi;
  fields: unknown;
  onChange: (answers: StoredAnswers) => void;
}) => {
  const values = useStore(form.store, (state) => state.values) as Record<string, unknown>;
  useEffect(() => {
    onChange(toStoredAnswers(fields, values));
  }, [fields, values, onChange]);
  return (
    <Text size="xs" c="dimmed">
      入力中の内容は、このタブを閉じるまで保存されます
    </Text>
  );
};

const SurveyAnswerPage = () => {
  const { workspaceId, surveyId } = useParams({ from: surveyAnswerRoute.id });
  const { user } = useAuthContext();
  const api = useApi<Api>();

  const { status, item: survey } = useSurvey(
    useMemo(() => ({ workspaceId, surveyId }), [workspaceId, surveyId]),
  );

  // 保存された質問の定義から、回答フォームのスキーマを実行時に組み立てる
  const { schema, warnings, fieldErrors } = useMemo(
    () => buildSurveySchema(survey?.fields),
    [survey?.fields],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // 回答の途中経過を sessionStorage に残す。再読み込みしても残り、タブを閉じると消える。
  // フォームの初期値には、開いたときの値だけを使う（入力のたびにフォームを作り直さない）
  const [draft, setDraft] = useSessionStorageState<StoredAnswers | null>(
    `survey-answer-draft:${workspaceId}:${surveyId}`,
    null,
  );
  const [initialDraft, setInitialDraft] = useState(draft);
  const defaultValues = useMemo(
    () => (initialDraft ? fromStoredAnswers(survey?.fields, initialDraft) : undefined),
    [survey?.fields, initialDraft],
  );

  const handleSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      if (!survey) return;
      setIsSubmitting(true);
      try {
        await api.responses.create(
          { workspaceId },
          {
            surveyId,
            surveyRevision: survey.revision,
            // メンバーのキーはメールアドレス（tables/member.ts）
            respondentId: user?.email ?? undefined,
            // 日付は YYYY-MM-DD にし、未回答の項目は落とす（survey/answers.ts）
            answers: toStoredAnswers(survey.fields, data),
            submittedAt: new Date(),
          },
        );
        setDraft(null);
        setInitialDraft(null);
        setIsSubmitted(true);
        setSubmittedCount((count) => count + 1);
      } catch (error) {
        console.error("Failed to submit response:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, survey, surveyId, workspaceId, user?.email, setDraft],
  );

  const actions = useMemo<readonly AutoFormAction<typeof schema>[]>(
    () => [
      {
        type: "submit",
        label: "回答を送信",
        loading: isSubmitting,
        onSubmit: handleSubmit,
      },
      {
        type: "custom",
        render: ({ form }) => (
          <AnswerDraftSaver form={form} fields={survey?.fields} onChange={setDraft} />
        ),
      },
    ],
    [isSubmitting, handleSubmit, survey?.fields, setDraft],
  );

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({
      pageCode,
      collectionCode: buildSurveySchemaCode,
    });

  if (status === "loading") {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  if (!survey) {
    return (
      <Container size="md">
        <Alert color="gray" variant="light" title="アンケートが見つかりません">
          削除されたか、URL が間違っている可能性があります。
        </Alert>
      </Container>
    );
  }

  const isAnswerable = survey.status === "published" && survey.deletedAt == null;

  return (
    <Container size="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>{survey.title}</Title>
        {codeViewerTrigger}
      </Group>

      <Stack gap="md">
        {!isAnswerable && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="gray"
            variant="light"
            title={
              survey.status === "closed"
                ? "受付を終了しました"
                : "まだ公開されていません"
            }
          >
            このアンケートは現在回答を受け付けていません。
          </Alert>
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
                <List.Item key={error.id}>{error.message}</List.Item>
              ))}
            </List>
          </Alert>
        )}

        {warnings.length > 0 && (
          <Alert icon={<IconInfoCircle size={16} />} color="yellow" variant="light">
            <List size="sm">
              {warnings.map((warning) => (
                <List.Item key={warning}>{warning}</List.Item>
              ))}
            </List>
          </Alert>
        )}

        {isSubmitted ? (
          <Card withBorder>
            <Stack gap="md" align="center" py="lg">
              <IconCircleCheck size={48} color="var(--mantine-color-green-6)" />
              <Text fw={500}>回答を送信しました。ご協力ありがとうございました。</Text>
              <Group>
                <Button variant="default" onClick={() => setIsSubmitted(false)}>
                  もう一度回答する
                </Button>
                <Button
                  component={Link}
                  to={responsesRoute.to}
                  // Mantine の polymorphic component は TanStack Router の
                  // params/search を型として受け取れないため object で渡す
                  {...({
                    params: { workspaceId },
                    search: { q: { surveyId } },
                  } as object)}
                >
                  回答一覧を見る
                </Button>
              </Group>
            </Stack>
          </Card>
        ) : (
          <Card withBorder>
            {survey.description && (
              <Text size="sm" c="dimmed" mb="md">
                {survey.description}
              </Text>
            )}
            <AutoForm
              // 送信のたびにフォームを初期化する（続けて回答できるように）
              key={submittedCount}
              schema={schema}
              defaultValues={defaultValues}
              readOnly={!isAnswerable}
              actions={isAnswerable ? actions : []}
            />
          </Card>
        )}
      </Stack>

      {codeViewerModal}
    </Container>
  );
};

export default SurveyAnswerPage;
