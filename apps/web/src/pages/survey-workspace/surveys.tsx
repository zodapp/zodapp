import {
  Title,
  Container,
  Group,
  Modal,
  Menu,
  ActionIcon,
  Tooltip,
  SegmentedControl,
  Paper,
  Text,
  Center,
  Loader,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconDotsVertical,
  IconSettings,
  IconFlask,
  IconRestore,
} from "@tabler/icons-react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import { firestore } from "@repo/firebase";
import {
  getAccessor,
  getMutationsAccessor,
} from "@zodapp/zod-firebase-browser";
import { extendSchemaSafe } from "@zodapp/zod-form-widget";
import { AutoForm } from "@zodapp/zod-form-widget/form";
import {
  AutoTable,
  useTableSettingDrawer,
} from "@zodapp/zod-form-widget/table";
import { zfReact } from "@zodapp/zod-form-react";

import {
  surveyMutations,
  surveyQueries,
  surveysCollection,
} from "../../shared/survey/collections";
import { useList } from "../../shared/taskManager/hooks";
import { useProfileColumnSettings } from "../../shared/taskManager/useProfileColumnSettings";
import { useStoreKey } from "../../shared/auth";
import { createActionSchema } from "../../components/createActionSchema";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import { surveysRoute } from "./surveys.route";
import { surveyEditRoute } from "./survey/edit.route";
import { surveyTestDataRoute } from "./testData.route";

import pageCode from "./surveys.tsx?raw";
import collectionCode from "../../shared/survey/collections/survey.ts?raw";

const SURVEY_TABLE_KEY = "survey";
const SURVEY_TABLE_DEFAULT_FIELD_PATHS = [
  "title",
  "status",
  "revision",
  "publishedAt",
  "updatedAt",
  "_action",
];
const SURVEY_TRASH_TABLE_KEY = "survey-trash";
const SURVEY_TRASH_DEFAULT_FIELD_PATHS = [
  "title",
  "status",
  "deletedAt",
  "_restore",
];

type SurveyData = z.infer<typeof surveysCollection.dataSchema>;
type SurveyView = "active" | "trash";

const SurveysPage = () => {
  const { workspaceId } = useParams({ from: surveysRoute.id });
  const navigate = useNavigate();
  const storeKey = useStoreKey();

  const [view, setView] = useState<SurveyView>("active");
  const collectionIdentity = useMemo(() => ({ workspaceId }), [workspaceId]);

  const surveyAccessor = useMemo(
    () => getAccessor(firestore, surveysCollection, storeKey),
    [storeKey],
  );
  const mutationsAccessor = useMemo(
    () => getMutationsAccessor(firestore, surveyMutations, storeKey),
    [storeKey],
  );

  const tableSchema = useMemo(
    () =>
      extendSchemaSafe(surveysCollection.dataSchema, {
        _action: createActionSchema<SurveyData>({
          label: "編集",
          getParams: (item) => ({
            to: surveyEditRoute.to,
            params: { workspaceId, surveyId: item.surveyId },
          }),
        }),
      }),
    [workspaceId],
  );

  // 復元済みアンケートの楽観的除外（tasks 一覧と同じ理由）
  const [restoredIds, setRestoredIds] = useState<Set<string>>(
    () => new Set(),
  );

  const handleRestore = useCallback(
    async (row: SurveyData) => {
      await mutationsAccessor.restore({ workspaceId, surveyId: row.surveyId });
      setRestoredIds((prev) => new Set(prev).add(row.surveyId));
    },
    [mutationsAccessor, workspaceId],
  );

  const trashTableSchema = useMemo(
    () =>
      extendSchemaSafe(surveysCollection.dataSchema, {
        _restore: zfReact
          .computed()
          .register(zfReact.computed.registry, {
            label: "復元",
            width: 60,
            align: "center" as const,
            compute: (row: SurveyData) => (
              <Tooltip label="復元する">
                <ActionIcon
                  variant="light"
                  aria-label="復元する"
                  onClick={() => void handleRestore(row)}
                >
                  <IconRestore size={16} />
                </ActionIcon>
              </Tooltip>
            ),
          })
          .optional(),
      }),
    [handleRestore],
  );

  const { items: surveys, isLoading } = useList({
    collection: surveysCollection,
    collectionIdentity,
    query:
      view === "trash"
        ? surveyQueries.queries.deleted()
        : {
            ...surveyQueries.queries.active(),
            orderBy: [{ field: "createdAt", direction: "desc" as const }],
          },
    clientFilter:
      view === "trash"
        ? (item: SurveyData) =>
            item.deletedAt != null && !restoredIds.has(item.surveyId)
        : undefined,
  });

  const activeController = useProfileColumnSettings({
    tableKey: SURVEY_TABLE_KEY,
    schema: tableSchema,
    defaultFieldPaths: SURVEY_TABLE_DEFAULT_FIELD_PATHS,
    workspaceId,
  });
  const trashController = useProfileColumnSettings({
    tableKey: SURVEY_TRASH_TABLE_KEY,
    schema: trashTableSchema,
    defaultFieldPaths: SURVEY_TRASH_DEFAULT_FIELD_PATHS,
    workspaceId,
  });
  const controller = view === "trash" ? trashController : activeController;

  const { open: openTableSetting, modal: tableSettingDrawer } =
    useTableSettingDrawer({ controller });

  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = useCallback(
    async (data: z.infer<typeof surveysCollection.createSchema>) => {
      setIsSubmitting(true);
      try {
        const surveyId = await surveyAccessor.createDoc(
          collectionIdentity,
          data,
        );
        closeModal();
        // 作成したらそのままビルダーへ
        navigate({
          to: surveyEditRoute.to,
          params: { workspaceId, surveyId },
        });
      } catch (error) {
        console.error("Failed to create survey:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [surveyAccessor, collectionIdentity, closeModal, navigate, workspaceId],
  );

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Group>
          <Title order={2}>アンケート一覧</Title>
          <SegmentedControl
            value={view}
            onChange={(value) => setView(value as SurveyView)}
            data={[
              { value: "active", label: "アクティブ" },
              { value: "trash", label: "ゴミ箱" },
            ]}
          />
        </Group>
        <Group>
          {codeViewerTrigger}
          <Tooltip label="新規作成">
            <ActionIcon
              variant="filled"
              size="lg"
              radius="xl"
              onClick={openModal}
            >
              <IconPlus size={20} />
            </ActionIcon>
          </Tooltip>
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>テーブル</Menu.Label>
              <Menu.Item
                leftSection={<IconSettings size={16} />}
                onClick={openTableSetting}
              >
                列設定
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>データ操作</Menu.Label>
              <Menu.Item
                component={Link}
                to={surveyTestDataRoute.to}
                // 別タブで開くことで、この一覧を表示したまま投入できる
                target="_blank"
                {...({ params: { workspaceId } } as object)}
                leftSection={<IconFlask size={16} />}
              >
                テストデータ
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <AutoTable data={surveys} keyField="surveyId" controller={controller} />

      {!isLoading && surveys.length === 0 && (
        <Paper p="xl" withBorder mt="sm">
          <Text c="dimmed" ta="center">
            {view === "trash"
              ? "ゴミ箱は空です。"
              : "アンケートがありません。新規作成するか、メニューからサンプルを追加してください。"}
          </Text>
        </Paper>
      )}
      {isLoading && (
        <Center h={200}>
          <Loader />
        </Center>
      )}

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title="新規アンケート作成"
        size="lg"
      >
        <AutoForm
          schema={surveysCollection.createSchema}
          onSubmit={handleCreate}
          onCancel={closeModal}
          isLoading={isSubmitting}
          submitLabel="作成して編集へ"
          defaultValues={surveysCollection.onInit?.()}
        />
      </Modal>

      {codeViewerModal}
      {tableSettingDrawer}
    </Container>
  );
};

export default SurveysPage;
