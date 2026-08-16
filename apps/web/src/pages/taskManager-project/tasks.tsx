import {
  Title,
  Container,
  Group,
  Modal,
  Box,
  Menu,
  ActionIcon,
  Tooltip,
  SegmentedControl,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconDotsVertical,
  IconDownload,
  IconUpload,
  IconSeeding,
  IconSettings,
  IconRestore,
} from "@tabler/icons-react";
import { useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { createMingoFilter } from "../../components/mingoQuery";
import { createActionSchema } from "../../components/createActionSchema";

import { z } from "zod";

import { useGrowingList } from "../../shared/taskManager/hooks";
import {
  taskMutations,
  taskQueries,
  tasksCollection,
} from "../../shared/taskManager/collections/task";
import { zfReact } from "@zodapp/zod-form-react";
import { getAccessor, getMutationsAccessor } from "@zodapp/zod-firebase-browser";
import { WhereParams } from "@zodapp/zod-firebase";
import { AutoForm, AutoSearch } from "@zodapp/zod-form-widget/form";
import { FetchMore } from "@zodapp/zod-form-widget/feedback";
import { extendSchemaSafe } from "@zodapp/zod-form-widget";
import {
  AutoTable,
  useAutoTableScroll,
  useTableSettingDrawer,
} from "@zodapp/zod-form-widget/table";
import { useLocalColumnSettings } from "../../shared/taskManager/useLocalColumnSettings";
import { taskDetailRoute } from "./task/detail.route";
import { tasksRoute, searchFilterSchema } from "./tasks.route";
import { populateSeed } from "./seed";
import { firestore } from "@repo/firebase";
import { createFirestoreResolver } from "@zodapp/zod-form-firebase";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import {
  useExportModal,
  useImportModal,
} from "@zodapp/zod-form-widget/tabular";
import { useStoreKey } from "../../shared/auth";
import type { GrowingListQuerySpec } from "../../shared/taskManager/listQuerySpec";
import { useExportFetchAll } from "../../shared/taskManager/exportFetch";

import pageCode from "./tasks.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/task.ts?raw";

const TASK_TABLE_STORAGE_KEY = "tableSetting-task";
const TASK_TABLE_DEFAULT_FIELD_PATHS = [
  "title",
  "status",
  "priority",
  "dueAt",
  "createdAt",
  "updatedAt",
  "expired",
  "_action",
];
const TASK_TRASH_TABLE_STORAGE_KEY = "tableSetting-task-trash";
const TASK_TRASH_TABLE_DEFAULT_FIELD_PATHS = [
  "title",
  "status",
  "priority",
  "dueAt",
  "_restore",
];

type TaskData = z.infer<typeof tasksCollection.dataSchema>;
type TaskView = "active" | "trash";

const TasksPage = () => {
  const { workspaceId, projectId } = useParams({
    from: tasksRoute.id,
  });
  const search = useSearch({
    from: tasksRoute.id,
  });
  const navigate = useNavigate({
    from: tasksRoute.id,
  });
  const storeKey = useStoreKey();

  const taskTableSchema = useMemo(
    () =>
      extendSchemaSafe(tasksCollection.dataSchema, {
        _action: createActionSchema<TaskData>({
          getParams: (item) => ({
            to: taskDetailRoute.to,
            params: { workspaceId, projectId, taskId: item.taskId },
          }),
        }),
      }),
    [workspaceId, projectId],
  );

  const collectionIdentity = useMemo(
    () => ({ workspaceId, projectId }),
    [workspaceId, projectId],
  );

  const taskAccessor = useMemo(
    () => getAccessor(firestore, tasksCollection, storeKey),
    [storeKey],
  );
  const mutationsAccessor = useMemo(
    () => getMutationsAccessor(firestore, taskMutations, storeKey),
    [storeKey],
  );

  // アクティブ / ゴミ箱（論理削除済み）のビュー切替
  const [view, setView] = useState<TaskView>("active");

  const handleRestore = useCallback(
    async (row: TaskData) => {
      await mutationsAccessor.restore({
        workspaceId,
        projectId,
        taskId: row.taskId,
      });
    },
    [mutationsAccessor, workspaceId, projectId],
  );

  // ゴミ箱用テーブル: 詳細リンクの代わりに復元ボタンの列を付ける
  const trashTableSchema = useMemo(
    () =>
      extendSchemaSafe(tasksCollection.dataSchema, {
        _restore: zfReact
          .computed()
          .register(zfReact.computed.registry, {
            label: "復元",
            width: 60,
            align: "center" as const,
            compute: (row: TaskData) => (
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

  const externalKeyResolvers = useMemo(
    () => [
      createFirestoreResolver({
        db: firestore,
        storeKey,
      }),
    ],
    [storeKey],
  );

  const resolverContext = useMemo(
    () => ({ workspace: { workspaceId } }),
    [workspaceId],
  );

  const taskListSpec = useMemo<
    GrowingListQuerySpec<typeof tasksCollection>
  >(() => {
    const q = search.q ?? ({} as Partial<z.infer<typeof searchFilterSchema>>);

    if (view === "trash") {
      // ゴミ箱: deletedAt != null（named query 側で orderBy 制約も定義済み）。
      // 復元されたタスクはストリーム更新で clientFilter から外れて消える。
      const deletedQuery = taskQueries.queries.deleted();
      const mingoFilter = createMingoFilter(q);
      return {
        collection: tasksCollection,
        collectionIdentity,
        query: deletedQuery,
        clientFilter: (item: TaskData) =>
          item.deletedAt != null && (mingoFilter?.(item) ?? true),
      };
    }

    const activeQuery = taskQueries.queries.active();

    const fetchCondition: WhereParams[] = [...(activeQuery.where ?? [])];
    const { status, ...rest } = q;
    if (status) {
      fetchCondition.push(
        ...(taskQueries.queries.byStatus(status).where ?? []),
      );
    }
    return {
      collection: tasksCollection,
      collectionIdentity,
      query: {
        where: fetchCondition,
        orderBy: [{ field: "createdAt", direction: "desc" as const }],
      },
      clientFilter: createMingoFilter(rest),
    };
  }, [collectionIdentity, search.q, view]);

  const {
    items: tasks,
    isLoading,
    hasMore,
    fetchMore,
    filteredCount,
    scannedCount,
  } = useGrowingList({
    ...taskListSpec,
    streamField: "updatedAt",
  });

  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = useCallback(
    async (data: z.infer<typeof tasksCollection.createSchema>) => {
      setIsSubmitting(true);
      try {
        await taskAccessor.createDoc(collectionIdentity, data);
        closeModal();
      } catch (error) {
        console.error("Failed to create task:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [taskAccessor, collectionIdentity, closeModal],
  );

  const [isSeeding, setIsSeeding] = useState(false);
  const handleSeed = useCallback(async () => {
    setIsSeeding(true);
    await populateSeed(
      async (data) => {
        await taskAccessor.createDoc(collectionIdentity, data);
      },
      30,
      () => setIsSeeding(false),
    );
  }, [taskAccessor, collectionIdentity]);

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

  const fetchAllTasks = useExportFetchAll(taskListSpec);

  const { open: openExport, modal: exportModal } = useExportModal({
    schema: tasksCollection.dataSchema,
    data: tasks,
    fetchAll: fetchAllTasks,
    filename: `tasks-${projectId}.csv`,
  });

  const handleImport = useCallback(
    async (rows: z.infer<typeof tasksCollection.createSchema>[]) => {
      for (const row of rows) {
        await taskAccessor.createDoc(collectionIdentity, row);
      }
    },
    [taskAccessor, collectionIdentity],
  );

  const { open: openImport, modal: importModal } = useImportModal({
    schema: tasksCollection.createSchema,
    onImport: handleImport,
  });

  const activeController = useLocalColumnSettings({
    storageKey: TASK_TABLE_STORAGE_KEY,
    schema: taskTableSchema,
    defaultFieldPaths: TASK_TABLE_DEFAULT_FIELD_PATHS,
  });

  const trashController = useLocalColumnSettings({
    storageKey: TASK_TRASH_TABLE_STORAGE_KEY,
    schema: trashTableSchema,
    defaultFieldPaths: TASK_TRASH_TABLE_DEFAULT_FIELD_PATHS,
  });

  const controller = view === "trash" ? trashController : activeController;

  const { open: openTableSetting, modal: tableSettingDrawer } =
    useTableSettingDrawer({
      controller,
    });

  const {
    scrollParent,
    scrollParentRef,
    tableRef,
    bottomAnchorRef,
    handleFetchMore,
    scrollFab,
  } = useAutoTableScroll({
    itemCount: tasks.length,
    isLoading,
    fetchMore,
  });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  return (
    <Container
      size="lg"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 60px - var(--mantine-spacing-md) * 2)",
        overflow: "hidden",
      }}
    >
      <Group justify="space-between" mb="lg">
        <Group>
          <Title order={2}>タスク一覧</Title>
          <SegmentedControl
            value={view}
            onChange={(value) => setView(value as TaskView)}
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
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconSeeding size={16} />}
                onClick={handleSeed}
                disabled={isSeeding}
              >
                ダミーデータ追加
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
          externalKeyResolvers={externalKeyResolvers}
          resolverContext={resolverContext}
          showPreview={true}
        />
      </Box>

      <div
        ref={scrollParentRef}
        style={{ overflow: "auto", flex: 1, minHeight: 0 }}
      >
        <AutoTable
          ref={tableRef}
          data={tasks}
          keyField="taskId"
          sortable={false}
          controller={controller}
          externalKeyResolvers={externalKeyResolvers}
          resolverContext={resolverContext}
          scrollParent={scrollParent}
          virtualizeThreshold={50}
        />
        <div style={{ position: "sticky", left: 0, paddingBottom: "8px" }}>
          <FetchMore
            isLoading={isLoading}
            hasMore={hasMore}
            fetchMore={handleFetchMore}
            scannedCount={scannedCount}
            filteredCount={filteredCount}
            itemCount={tasks.length}
            emptyWithMoreMessage="フィルタ条件に一致するタスクが見つかりませんでした"
            emptyNoMoreMessage="タスクがありません。新規作成してください。"
          />
        </div>
        <div ref={bottomAnchorRef} />
      </div>

      {scrollFab}

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title="新規タスク作成"
        size="calc(100vw - 3rem)"
      >
        <AutoForm
          schema={tasksCollection.createSchema}
          onSubmit={handleCreate}
          onCancel={closeModal}
          isLoading={isSubmitting}
          submitLabel="作成"
          defaultValues={tasksCollection.onInit?.()}
          externalKeyResolvers={externalKeyResolvers}
          resolverContext={resolverContext}
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

export default TasksPage;
