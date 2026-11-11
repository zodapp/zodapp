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
import { zf } from "@zodapp/zod-form";
import { useApi } from "@zodapp/zod-dynamodb-react";
import { extendSchemaSafe } from "@zodapp/zod-form-widget";
import {
  AutoTable,
  useTableSettingDrawer,
} from "@zodapp/zod-form-widget/table";
import { zfReact } from "@zodapp/zod-form-react";

import { surveyBodySchema, surveySchema, type Survey } from "../../../shared";
import type { Api } from "../../shared/api";
import { useListStore } from "../../shared/listing";
import { useLocalColumnSettings } from "../../shared/useLocalColumnSettings";
import { AutoForm } from "../../components/AutoForm";
import { createActionSchema } from "../../components/createActionSchema";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import { surveysRoute } from "./surveys.route";
import { surveyEditRoute } from "./survey/edit.route";
import { surveyTestDataRoute } from "./testData.route";

import pageCode from "./surveys.tsx?raw";
import collectionCode from "../../../shared/tables/survey.ts?raw";

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

/** 新規作成のフォーム。質問はビルダーで足すので、名前と説明だけを入れる */
const surveyCreateSchema = z
  .object({
    title: surveyBodySchema.shape.title,
    description: surveyBodySchema.shape.description,
  })
  .register(zf.object.registry, {});

type SurveyView = "active" | "trash";

const SurveysPage = () => {
  const { workspaceId } = useParams({ from: surveysRoute.id });
  const navigate = useNavigate();
  const api = useApi<Api>();

  const [view, setView] = useState<SurveyView>("active");
  const workspaceParams = useMemo(() => ({ workspaceId }), [workspaceId]);

  const tableSchema = useMemo(
    () =>
      extendSchemaSafe(surveySchema, {
        _action: createActionSchema<Survey>({
          label: "編集",
          getParams: (item) => ({
            to: surveyEditRoute.to,
            params: { workspaceId, surveyId: item.surveyId },
          }),
        }),
      }),
    [workspaceId],
  );

  // 復元すると deletedAt が null になり、ゴミ箱の一覧（live）から自動で消える
  const handleRestore = useCallback(
    async (row: Survey) => {
      await api.surveys.restore({ workspaceId, surveyId: row.surveyId }, {});
    },
    [api, workspaceId],
  );

  const trashTableSchema = useMemo(
    () =>
      extendSchemaSafe(surveySchema, {
        _restore: zfReact
          .computed()
          .register(zfReact.computed.registry, {
            label: "復元",
            width: 60,
            align: "center" as const,
            compute: (row: Survey) => (
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

  // 有効なものとゴミ箱は、同じ Index（byDeletedAt）の Sort Key の先頭で読み分ける
  const list = useListStore<Survey>(
    () =>
      view === "trash"
        ? api.surveys.deleted.live(workspaceParams)
        : api.surveys.active.live(workspaceParams),
    [api, view, workspaceParams],
  );
  const surveys = list.items;
  const isLoading = list.status === "loading";

  const activeController = useLocalColumnSettings({
    tableKey: SURVEY_TABLE_KEY,
    schema: tableSchema,
    defaultFieldPaths: SURVEY_TABLE_DEFAULT_FIELD_PATHS,
  });
  const trashController = useLocalColumnSettings({
    tableKey: SURVEY_TRASH_TABLE_KEY,
    schema: trashTableSchema,
    defaultFieldPaths: SURVEY_TRASH_DEFAULT_FIELD_PATHS,
  });
  const controller = view === "trash" ? trashController : activeController;

  const { open: openTableSetting, modal: tableSettingDrawer } =
    useTableSettingDrawer({ controller });

  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 書き込めるか（閲覧者は不可）。操作の authorize を、送る前にブラウザで判定する
  const canWrite = api.surveys.create.can(workspaceParams, {
    title: "-",
    fields: [],
  }).ok;

  const handleCreate = useCallback(
    async (data: z.infer<typeof surveyCreateSchema>) => {
      setIsSubmitting(true);
      try {
        const created = await api.surveys.create(workspaceParams, {
          ...data,
          fields: [],
        });
        closeModal();
        // 作成したらそのままビルダーへ
        navigate({
          to: surveyEditRoute.to,
          params: { workspaceId, surveyId: created.surveyId },
        });
      } catch (error) {
        console.error("Failed to create survey:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, workspaceParams, closeModal, navigate, workspaceId],
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
          {canWrite && (
            <Tooltip label="新規作成">
              <ActionIcon
                aria-label="新規作成"
                variant="filled"
                size="lg"
                radius="xl"
                onClick={openModal}
              >
                <IconPlus size={20} />
              </ActionIcon>
            </Tooltip>
          )}
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg" aria-label="メニュー">
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
                // Mantine の polymorphic component は TanStack Router の
                // params を型として受け取れないため object で渡す
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
              : "アンケートがありません。新規作成するか、テストデータからサンプルを追加してください。"}
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
          schema={surveyCreateSchema}
          onSubmit={handleCreate}
          onCancel={closeModal}
          isLoading={isSubmitting}
          submitLabel="作成して編集へ"
        />
      </Modal>

      {codeViewerModal}
      {tableSettingDrawer}
    </Container>
  );
};

export default SurveysPage;
