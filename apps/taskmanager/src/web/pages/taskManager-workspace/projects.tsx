import {
  Title,
  Text,
  Container,
  Group,
  Modal,
  Box,
  Loader,
  Center,
  Paper,
  Menu,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconDotsVertical,
  IconDownload,
  IconUpload,
  IconSettings,
} from "@tabler/icons-react";
import { useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { useApi } from "@zodapp/zod-dynamodb-react";
import {
  AutoTable,
  useTableSettingDrawer,
} from "@zodapp/zod-form-widget/table";
import { useProfileColumnSettings } from "../../shared/taskManager/useProfileColumnSettings";
import { createMingoFilter } from "../../components/mingoQuery";
import { createActionSchema } from "../../components/createActionSchema";
import {
  useExportModal,
  useImportModal,
} from "@zodapp/zod-form-widget/tabular";
import { fetchAllPages, useFiltered } from "../../shared/listing";
import type { Api } from "../../shared/api";

import { z } from "zod";

import { useProjects } from "../../shared/hooks";
import { projectBodySchema, projectSchema } from "../../../shared";
import { AutoForm } from "../../components/AutoForm";
import { AutoSearch } from "../../components/AutoSearch";
import { projectsRoute, searchFilterSchema } from "./projects.route";
import { tasksRoute } from "../taskManager-project/tasks.route";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";

import pageCode from "./projects.tsx?raw";
import collectionCode from "../../../shared/tables/project.ts?raw";

const PROJECT_TABLE_STORAGE_KEY = "tableSetting-project";
const PROJECT_TABLE_DEFAULT_FIELD_PATHS = [
  "name",
  "description",
  "status",
  "createdAt",
];

type ProjectData = z.infer<typeof projectSchema>;
type ProjectInput = z.infer<typeof projectBodySchema>;

const ProjectsPage = () => {
  const { workspaceId } = useParams({
    from: projectsRoute.id,
  });
  const search = useSearch({
    from: projectsRoute.id,
  });
  const navigate = useNavigate({
    from: projectsRoute.id,
  });

  // アクション列は trailingSchema 方式で付ける。
  // - extendSchemaSafe 方式（tasks.tsx 参照）: アクション列もスキーマの一部に
  //   なり、列設定で表示/非表示・並び順をユーザーが変更できる
  // - trailingSchema 方式（このページ）: アクション列は列設定の対象外で、
  //   常にテーブル末尾に固定される。操作列を常に出したい場合はこちら
  const trailingSchema = useMemo(
    () =>
      z.object({
        _action: createActionSchema<ProjectData>({
          getParams: (item) => ({
            to: tasksRoute.to,
            params: { workspaceId, projectId: item.projectId },
          }),
        }),
      }),
    [workspaceId],
  );

  const api = useApi<Api>();

  // アクティブなプロジェクト（ステータスの Index。リアルタイムで購読する）
  const listParams = useMemo(
    () => ({ workspaceId, status: "active" as const }),
    [workspaceId],
  );
  const list = useProjects(listParams);
  const clientFilter = useMemo(() => createMingoFilter(search.q), [search.q]);
  const projects = useFiltered(list.items, clientFilter);
  const isLoading = list.status === "loading";

  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearchChange = useCallback(
    (data: z.infer<typeof searchFilterSchema>) => {
      navigate({
        search: {
          ...search,
          q: data,
        },
      });
    },
    [navigate, search],
  );

  const handleCreate = useCallback(
    async (data: ProjectInput) => {
      setIsSubmitting(true);
      try {
        await api.projects.create({ workspaceId }, data);
        closeModal();
      } catch (error) {
        console.error("Failed to create project:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, workspaceId, closeModal],
  );

  const fetchAllProjects = useCallback(
    () => fetchAllPages(api.projects.byStatus.pages(listParams), clientFilter),
    [api, listParams, clientFilter],
  );

  const { open: openExport, modal: exportModal } = useExportModal({
    schema: projectSchema,
    data: projects,
    fetchAll: fetchAllProjects,
    filename: `projects-${workspaceId}.csv`,
  });

  const handleImport = useCallback(
    async (rows: ProjectInput[]) => {
      for (const row of rows) {
        await api.projects.create({ workspaceId }, row);
      }
    },
    [api, workspaceId],
  );

  const { open: openImport, modal: importModal } = useImportModal({
    schema: projectBodySchema,
    onImport: handleImport,
  });

  // 列設定プロファイル（このブラウザ / 個人 / ワークスペース共通の3スコープ）
  const controller = useProfileColumnSettings({
    tableKey: PROJECT_TABLE_STORAGE_KEY,
    schema: projectSchema,
    defaultFieldPaths: PROJECT_TABLE_DEFAULT_FIELD_PATHS,
    workspaceId,
  });

  const { open: openTableSetting, modal: tableSettingDrawer } =
    useTableSettingDrawer({
      controller,
    });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>プロジェクト一覧</Title>
        <Group>
          {codeViewerTrigger}
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
          <Menu shadow="md" width={200} position="bottom-end">
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
                leftSection={<IconDownload size={16} />}
                onClick={openExport}
              >
                CSVエクスポート
              </Menu.Item>
              <Menu.Item
                leftSection={<IconUpload size={16} />}
                onClick={openImport}
              >
                CSVインポート
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Box
        mb="sm"
        px="sm"
        pb="md"
        style={{
          backgroundColor:
            "light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))",
          borderRadius: "8px",
        }}
      >
        <AutoSearch
          schema={searchFilterSchema}
          onChange={handleSearchChange}
          defaultValues={search.q}
          showPreview={true}
        />
      </Box>

      <AutoTable
        data={projects}
        keyField="projectId"
        controller={controller}
        trailingSchema={trailingSchema}
        trailingDefaultFieldPaths={["_action"]}
      />

      {!isLoading && projects.length === 0 && (
        <Paper p="xl" withBorder mt="sm">
          <Text c="dimmed" ta="center">
            {clientFilter
              ? "フィルタ条件に一致するプロジェクトが見つかりませんでした"
              : "プロジェクトがありません。新規作成してください。"}
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
        title="新規プロジェクト作成"
        size="calc(100vw - 3rem)"
      >
        <AutoForm
          schema={projectBodySchema}
          onSubmit={handleCreate}
          onCancel={closeModal}
          isLoading={isSubmitting}
          submitLabel="作成"
          defaultValues={{ status: "active" }}
          showPreview={true}
        />
      </Modal>

      {codeViewerModal}
      {exportModal}
      {importModal}
      {tableSettingDrawer}
    </Container>
  );
};

export default ProjectsPage;
