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
import { useCallback, useMemo, useState } from "react";
import { firestore } from "@repo/firebase";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { AutoForm } from "@zodapp/zod-form-widget/form";

import {
  responsesCollection,
  surveysCollection,
} from "../../shared/survey/collections";
import { buildSurveySchema } from "../../shared/survey/buildSurveySchema";
import { useDoc } from "../../shared/taskManager/hooks";
import { useAuthContext, useStoreKey } from "../../shared/auth";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import { surveyAnswerRoute } from "./answer.route";
import { responsesRoute } from "../survey-workspace/responses.route";

import pageCode from "./answer.tsx?raw";
import buildSurveySchemaCode from "../../shared/survey/buildSurveySchema.ts?raw";

/** Firestore は undefined を保存できないため、未入力の項目を落とす */
const sanitizeAnswers = (answers: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(answers).filter(([, value]) => value !== undefined),
  );

const SurveyAnswerPage = () => {
  const { workspaceId, surveyId } = useParams({ from: surveyAnswerRoute.id });
  const storeKey = useStoreKey();
  const { user } = useAuthContext();

  const responseAccessor = useMemo(
    () => getAccessor(firestore, responsesCollection, storeKey),
    [storeKey],
  );

  const { item: survey, isLoading } = useDoc({
    collection: surveysCollection,
    documentIdentity: useMemo(
      () => ({ workspaceId, surveyId }),
      [workspaceId, surveyId],
    ),
  });

  // 保存された質問定義から回答フォーム用スキーマを実行時に組み立てる
  const { schema, warnings, fieldErrors } = useMemo(
    () => buildSurveySchema(survey?.fields),
    [survey?.fields],
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      if (!survey) return;
      setIsSubmitting(true);
      try {
        await responseAccessor.createDoc(
          { workspaceId },
          {
            surveyId,
            surveyRevision: survey.revision,
            // members のドキュメント ID はメールアドレス（member.ts の onCreateId）
            respondentId: user?.email ?? undefined,
            answers: sanitizeAnswers(data),
          },
        );
        setIsSubmitted(true);
        setSubmittedCount((count) => count + 1);
      } catch (error) {
        console.error("Failed to submit response:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [responseAccessor, survey, surveyId, workspaceId, user?.email],
  );

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({
      pageCode,
      collectionCode: buildSurveySchemaCode,
    });

  if (isLoading || !survey) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  const isAnswerable = survey.status === "published";

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
              // 送信のたびにフォームを初期化する（連続回答用）
              key={submittedCount}
              schema={schema}
              onSubmit={handleSubmit}
              isLoading={isSubmitting}
              submitLabel="回答を送信"
              readOnly={!isAnswerable}
              actions={isAnswerable ? undefined : []}
            />
          </Card>
        )}
      </Stack>

      {codeViewerModal}
    </Container>
  );
};

export default SurveyAnswerPage;
