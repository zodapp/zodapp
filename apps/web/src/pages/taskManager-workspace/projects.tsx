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
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { firestore } from "@repo/firebase";
import { useStoreKey } from "../../shared/auth";
import {
  AutoTable,
  useTableSettingDrawer,
} from "@zodapp/zod-form-widget/table";
import { useLocalColumnSettings } from "../../shared/taskManager/useLocalColumnSettings";
import { createMingoFilter } from "../../components/mingoQuery";
import { createActionSchema } from "../../components/createActionSchema";
import {
  useExportModal,
  useImportModal,
} from "@zodapp/zod-form-widget/tabular";
import type { ListQuerySpec } from "../../shared/taskManager/listQuerySpec";
import { useExportFetchAll } from "../../shared/taskManager/exportFetch";

import { z } from "zod";

import { useList } from "../../shared/taskManager/hooks";
import {
  projectQueries,
  projectsCollection,
} from "../../shared/taskManager/collections";
import { AutoForm } from "../../components/AutoForm";
import { AutoSearch } from "../../components/AutoSearch";
import { projectsRoute, searchFilterSchema } from "./projects.route";
import { tasksRoute } from "../taskManager-project/tasks.route";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";

import pageCode from "./projects.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/project.ts?raw";
import { zf } from "@zodapp/zod-form";

const PROJECT_TABLE_STORAGE_KEY = "tableSetting-project";

type ProjectData = z.infer<typeof projectsCollection.dataSchema>;

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

  const projectTableSchema = useMemo(
    () =>
      projectsCollection.dataSchema
        .extend({
          _action: createActionSchema<ProjectData>({
            getParams: (item) => ({
              to: tasksRoute.to,
              params: { workspaceId, projectId: item.projectId },
            }),
          }),
        })
        .register(zf.object.registry, {
          properties: ["name", "description", "status", "createdAt", "_action"],
        }),
    [workspaceId],
  );

  const collectionIdentity = useMemo(() => ({ workspaceId }), [workspaceId]);
  const storeKey = useStoreKey();

  // CRUD accessor を取得
  const projectAccessor = useMemo(
    () => getAccessor(firestore, projectsCollection, storeKey),
    [storeKey],
  );

  const projectListSpec = useMemo<ListQuerySpec<typeof projectsCollection>>(
    () => ({
      collection: projectsCollection,
      collectionIdentity,
      query: {
        ...projectQueries.queries.active(),
        orderBy: [{ field: "createdAt", direction: "desc" as const }],
      },
      clientFilter: createMingoFilter(search.q),
    }),
    [collectionIdentity, search.q],
  );

  const { items: projects, isLoading } = useList(projectListSpec);

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
    async (data: z.infer<typeof projectsCollection.createSchema>) => {
      setIsSubmitting(true);
      try {
        await projectAccessor.createDoc({ workspaceId }, data);
        closeModal();
      } catch (error) {
        console.error("Failed to create project:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [projectAccessor, workspaceId, closeModal],
  );

  const fetchAllProjects = useExportFetchAll(projectListSpec);

  const { open: openExport, modal: exportModal } = useExportModal({
    schema: projectsCollection.dataSchema,
    data: projects,
    fetchAll: fetchAllProjects,
    filename: `projects-${workspaceId}.csv`,
  });

  const handleImport = useCallback(
    async (rows: z.infer<typeof projectsCollection.createSchema>[]) => {
      for (const row of rows) {
        await projectAccessor.createDoc(collectionIdentity, row);
      }
    },
    [projectAccessor, collectionIdentity],
  );

  const { open: openImport, modal: importModal } = useImportModal({
    schema: projectsCollection.createSchema,
    onImport: handleImport,
  });

  const controller = useLocalColumnSettings({
    storageKey: PROJECT_TABLE_STORAGE_KEY,
    schema: projectTableSchema,
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
      />

      {!isLoading && projects.length === 0 && (
        <Paper p="xl" withBorder mt="sm">
          <Text c="dimmed" ta="center">
            {projectListSpec.clientFilter
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
          schema={projectsCollection.createSchema}
          onSubmit={handleCreate}
          onCancel={closeModal}
          isLoading={isSubmitting}
          submitLabel="作成"
          defaultValues={projectsCollection.onInit?.()}
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
