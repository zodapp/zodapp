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
import { firestore } from "@repo/firebase";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { AutoForm } from "@zodapp/zod-form-widget/form";
import {
  DeleteMenuItem,
  useDeleteModal,
} from "@zodapp/zod-form-widget/feedback";

import {
  responsesCollection,
  surveysCollection,
} from "../../../shared/survey/collections";
import { buildSurveySchema } from "../../../shared/survey/buildSurveySchema";
import { formatAnswerValue } from "../../../shared/survey/formatAnswerValue";
import { useDoc } from "../../../shared/taskManager/hooks";
import { useStoreKey } from "../../../shared/auth";
import { useCodeViewerModal } from "../../../components/useCodeViewerModal";
import { responseDetailRoute } from "./detail.route";
import { responsesRoute } from "../responses.route";
import { surveyEditRoute } from "../survey/edit.route";

import pageCode from "./detail.tsx?raw";
import collectionCode from "../../../shared/survey/collections/response.ts?raw";

const formatDateTime = (value: unknown) => {
  if (value instanceof Date) return value.toLocaleString("ja-JP");
  return formatAnswerValue(value);
};

/**
 * 回答詳細。
 *
 * 回答は質問定義（DSL）とは別のドキュメントに保存されているので、
 * 表示のたびにアンケートの質問定義から実行時スキーマを組み立て、
 * 回答フォームと同じ `AutoForm` を読み取り専用で描画する。
 * 「入力に使ったスキーマをそのまま表示に使い回せる」ことのサンプル。
 *
 * 回答時点の質問定義と現在の定義がずれている可能性があるため
 * （surveyRevision と survey.revision の比較）、
 * 現在の定義に存在しない回答は別枠で生データとして出す。
 */
const ResponseDetailPage = () => {
  const { workspaceId, responseId } = useParams({
    from: responseDetailRoute.id,
  });
  const navigate = useNavigate();
  const storeKey = useStoreKey();

  const responseAccessor = useMemo(
    () => getAccessor(firestore, responsesCollection, storeKey),
    [storeKey],
  );

  const { item: response, isLoading } = useDoc({
    collection: responsesCollection,
    documentIdentity: useMemo(
      () => ({ workspaceId, responseId }),
      [workspaceId, responseId],
    ),
  });

  // 依存に optional chaining をそのまま書くと React Compiler が
  // 手書きのメモ化を保てないので、いったんローカルに取り出す
  const responseSurveyId = response?.surveyId;
  const answers = response?.answers;

  const { item: survey } = useDoc({
    collection: surveysCollection,
    documentIdentity: useMemo(
      () =>
        responseSurveyId
          ? { workspaceId, surveyId: responseSurveyId }
          : undefined,
      [workspaceId, responseSurveyId],
    ),
  });
  const surveyFields = survey?.fields;

  const { schema } = useMemo(
    () => buildSurveySchema(surveyFields),
    [surveyFields],
  );

  // 現在の質問定義に対応する質問がない回答（質問を削除した後の古い回答など）。
  // 読み取り専用フォームには出てこないので、生の key/value で別に見せる
  const orphanAnswers = useMemo(() => {
    if (!answers || !surveyFields) return [];
    const knownIds = new Set(Object.keys(schema.shape));
    return Object.entries(answers).filter(([key]) => !knownIds.has(key));
  }, [answers, surveyFields, schema]);

  const { open: openDelete, modal: deleteModal } = useDeleteModal({
    title: "回答を削除",
    message: "この回答を削除しますか？この操作は元に戻せません。",
    onDelete: async () => {
      await responseAccessor.deleteDoc({ workspaceId, responseId });
      navigate({ to: responsesRoute.to, params: { workspaceId } });
    },
  });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  if (isLoading || !response) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  const isStaleRevision =
    survey != null &&
    response.surveyRevision != null &&
    survey.revision != null &&
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
              <ActionIcon variant="subtle" size="lg">
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
              <Menu.Divider />
              <DeleteMenuItem label="回答を削除" onClick={openDelete} />
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
                <Table.Td>{formatDateTime(response.submittedAt)}</Table.Td>
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
            title="回答後にアンケートが更新されています"
          >
            以下は<strong>現在の</strong>質問定義で組み立てたフォームです。
            質問文や選択肢が回答時点と異なる場合があります。
          </Alert>
        )}

        <Card withBorder>
          <Text fw={500} mb="md">
            回答内容
          </Text>
          {survey ? (
            <AutoForm
              schema={schema}
              defaultValues={response.answers}
              readOnly
              // 読み取り専用なので送信・キャンセルは出さない
              actions={[]}
            />
          ) : (
            <Text size="sm" c="dimmed">
              アンケート定義が見つかりませんでした（削除された可能性があります）。
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
              回答後に削除された質問への回答です。データは残っているので、
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
