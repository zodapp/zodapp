import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Menu,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconDotsVertical,
  IconExternalLink,
} from "@tabler/icons-react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useApi } from "@zodapp/zod-dynamodb-react";
import {
  DeleteMenuItem,
  useDeleteModal,
} from "@zodapp/zod-form-widget/feedback";

import { AutoForm } from "../../../components/AutoForm";
import { buildSurveySchema } from "../../../../shared/survey/buildSurveySchema";
import { fromStoredAnswers } from "../../../../shared/survey/answers";
import { formatAnswerValue } from "../../../../shared/survey/formatAnswerValue";
import type { Api } from "../../../shared/api";
import { useOptionalSurvey, useResponse } from "../../../shared/hooks";
import { useCodeViewerModal } from "../../../components/useCodeViewerModal";
import { responseDetailRoute } from "./detail.route";
import { responsesRoute } from "../responses.route";
import { surveyEditRoute } from "../survey/edit.route";

import pageCode from "./detail.tsx?raw";
import collectionCode from "../../../../shared/tables/response.ts?raw";

/**
 * 回答詳細。
 *
 * 回答は質問の定義とは別の Item に保存されているので、
 * 表示のたびにアンケートの質問の定義からスキーマを組み立て、
 * 回答フォームと同じ `AutoForm` を読み取り専用で描画する。
 * 「入力に使ったスキーマを、そのまま表示に使い回せる」ことのサンプル。
 *
 * 回答した時点の定義と現在の定義がずれていることがあるので
 * （surveyRevision と survey.revision の比較）、
 * 現在の定義にない回答は、別の枠に生のデータとして出す。
 */
const ResponseDetailPage = () => {
  const { workspaceId, responseId } = useParams({
    from: responseDetailRoute.id,
  });
  const navigate = useNavigate();
  const api = useApi<Api>();

  const responseKey = useMemo(
    () => ({ workspaceId, responseId }),
    [workspaceId, responseId],
  );
  const { status, item: response } = useResponse(responseKey);

  const responseSurveyId = response?.surveyId;
  const answers = response?.answers;

  const { item: survey } = useOptionalSurvey(
    useMemo(
      () =>
        responseSurveyId
          ? { workspaceId, surveyId: responseSurveyId }
          : undefined,
      [workspaceId, responseSurveyId],
    ),
  );
  const surveyFields = survey?.fields;

  const { schema } = useMemo(
    () => buildSurveySchema(surveyFields),
    [surveyFields],
  );

  // 日付の回答は YYYY-MM-DD で保存しているので、フォームに渡す前に Date に戻す
  const formValues = useMemo(
    () => fromStoredAnswers(surveyFields, answers),
    [surveyFields, answers],
  );

  // 現在の質問の定義にない回答（質問を消した後の古い回答など）。
  // 読み取り専用のフォームには出てこないので、生の key / value で別に見せる
  const orphanAnswers = useMemo(() => {
    if (!answers || !surveyFields) return [];
    const knownIds = new Set(Object.keys(schema.shape));
    return Object.entries(answers).filter(([key]) => !knownIds.has(key));
  }, [answers, surveyFields, schema]);

  const { open: openDelete, modal: deleteModal } = useDeleteModal({
    title: "回答を削除",
    message: "この回答を削除しますか？この操作は元に戻せません。",
    onDelete: async () => {
      await api.responses.remove(responseKey);
      navigate({ to: responsesRoute.to, params: { workspaceId } });
    },
  });
  // 削除は管理者だけ（tables/response.ts の remove の authorize）
  const canDelete = api.responses.remove.can(responseKey).ok;

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  if (status === "loading") {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  if (!response) {
    return (
      <Container size="md">
        <Alert color="gray" variant="light" title="回答が見つかりません">
          削除された可能性があります。
        </Alert>
      </Container>
    );
  }

  const isStaleRevision =
    survey != null &&
    response.surveyRevision != null &&
    response.surveyRevision !== survey.revision;

  return (
    <Container size="md">
      <Group justify="space-between" mb="lg">
        <Group>
          <Title order={2}>回答詳細</Title>
          {survey && (
            <Anchor
              component={Link}
              to={surveyEditRoute.to}
              {...({
                params: { workspaceId, surveyId: response.surveyId },
              } as object)}
              size="sm"
            >
              {survey.title}
            </Anchor>
          )}
        </Group>
        <Group>
          {codeViewerTrigger}
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="メニュー">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                component={Link}
                to={responsesRoute.to}
                {...({
                  params: { workspaceId },
                  search: { q: { surveyId: response.surveyId } },
                } as object)}
                leftSection={<IconExternalLink size={16} />}
              >
                このアンケートの回答一覧
              </Menu.Item>
              {canDelete && (
                <>
                  <Menu.Divider />
                  <DeleteMenuItem label="回答を削除" onClick={openDelete} />
                </>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Stack gap="lg">
        <Card withBorder>
          <Text fw={500} mb="md">
            回答情報
          </Text>
          <Table variant="vertical" withTableBorder>
            <Table.Tbody>
              <Table.Tr>
                <Table.Th w={140}>回答者</Table.Th>
                <Table.Td>{response.respondentId ?? "（匿名）"}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>回答日時</Table.Th>
                <Table.Td>{response.submittedAt.toLocaleString("ja-JP")}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>回答時の版</Table.Th>
                <Table.Td>
                  <Group gap="xs">
                    <Text size="sm">{response.surveyRevision ?? "-"}</Text>
                    {isStaleRevision && (
                      <Badge color="yellow" variant="light" size="sm">
                        現在は第 {survey?.revision} 版
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Card>

        {isStaleRevision && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="yellow"
            variant="light"
            title="回答の後にアンケートが更新されています"
          >
            以下は<strong>現在の</strong>質問の定義で組み立てたフォームです。
            質問文や選択肢が、回答した時点と異なる場合があります。
          </Alert>
        )}

        <Card withBorder>
          <Text fw={500} mb="md">
            回答内容
          </Text>
          {survey ? (
            <AutoForm
              schema={schema}
              defaultValues={formValues}
              readOnly
              // 読み取り専用なので、送信・キャンセルは出さない
              actions={[]}
            />
          ) : (
            <Text size="sm" c="dimmed">
              アンケートの定義が見つかりませんでした（削除された可能性があります）。
            </Text>
          )}
        </Card>

        {orphanAnswers.length > 0 && (
          <Card withBorder>
            <Group gap="xs" mb="md">
              <Text fw={500}>現在の質問にない回答</Text>
              <Badge color="gray" variant="light" size="sm">
                {orphanAnswers.length} 件
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              回答の後に削除された質問への回答です。データは残っているので、
              質問 ID と生の値をそのまま表示します。
            </Text>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={200}>質問 ID</Table.Th>
                  <Table.Th>回答</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {orphanAnswers.map(([key, value]) => (
                  <Table.Tr key={key}>
                    <Table.Td>
                      <Text size="sm" ff="monospace">
                        {key}
                      </Text>
                    </Table.Td>
                    <Table.Td>{formatAnswerValue(value)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        )}
      </Stack>

      {codeViewerModal}
      {deleteModal}
    </Container>
  );
};

export default ResponseDetailPage;
