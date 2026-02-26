import {
  Title,
  Container,
  Button,
  Group,
  Modal,
  Box,
  Menu,
  ActionIcon,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconDots,
  IconDownload,
  IconUpload,
  IconSeeding,
} from "@tabler/icons-react";
import { useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { AutoTable } from "../../components/AutoTable";
import { createMingoFilter } from "../../components/mingoQuery";

import { z } from "zod";

import { useGrowingList } from "../../shared/taskManager/hooks";
import { tasksCollection } from "../../shared/taskManager/collections/task";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { WhereParams } from "@zodapp/zod-firebase";
import { AutoForm } from "../../components/AutoForm";
import { AutoSearch } from "../../components/AutoSearch";
import { FetchMore } from "../../components/FetchMore";
import { taskDetailRoute } from "./task/detail.route";
import { tasksRoute, searchFilterSchema } from "./tasks.route";
import { populateSeed } from "./seed";
import { firestore } from "@repo/firebase";
import { createFirestoreResolver } from "@zodapp/zod-form-firebase";
import { CodeViewerModal } from "../../components/CodeViewerModal";
import { useExportModal, useImportModal } from "../../components/TabularModal";

import pageCode from "./tasks.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/task.ts?raw";
import { zf } from "@zodapp/zod-form";

// テーブル表示用スキーマ
const taskTableSchema = tasksCollection.dataSchema
  .extend({}) // registerは破壊的なのでcopyしてからregisterする
  .register(zf.object.registry, {
    properties: [
      "title",
      "status",
      "priority",
      "dueAt",
      "createdAt",
      "updatedAt",
      "expired",
    ],
  });

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

  const collectionIdentity = useMemo(
    () => ({ workspaceId, projectId }),
    [workspaceId, projectId],
  );

  // accessor を取得（mutations / queries が自動バインドされている）
  const taskAccessor = getAccessor(firestore, tasksCollection);

  // 外部キーResolver（workspaceIdを固定）
  const externalKeyResolvers = useMemo(
    () => [
      createFirestoreResolver({
        db: firestore,
        conditions: {
          membersCondition: {
            identityParams: { workspaceId },
            where: [],
          },
        },
      }),
    ],
    [workspaceId],
  );

  // search.q を status（サーバーサイド）とそれ以外（クライアントフィルタ）に分離
  const { fetchCondition, clientFilter } = useMemo(() => {
    const q = search.q ?? ({} as Partial<z.infer<typeof searchFilterSchema>>);

    const fetchCondition: WhereParams[] = [
      ...(taskAccessor.queries.active.params().where ?? []),
    ];
    const { status, ...rest } = q;
    if (status) {
      fetchCondition.push(
        ...(taskAccessor.queries.byStatus.params(status).where ?? []),
      );
    }
    return {
      fetchCondition,
      clientFilter: createMingoFilter(rest),
    };
  }, [search.q, taskAccessor]);

  const {
    items: tasks,
    isLoading,
    hasMore,
    fetchMore,
    filteredCount,
    scannedCount,
  } = useGrowingList({
    collection: tasksCollection,
    collectionIdentity,
    query: {
      where: fetchCondition,
      orderBy: [{ field: "createdAt", direction: "desc" as const }],
    },
    streamField: "updatedAt",
    clientFilter,
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

  const getActionParams = useCallback(
    (item: z.infer<typeof tasksCollection.dataSchema>) => ({
      to: taskDetailRoute.to,
      params: { workspaceId, projectId, taskId: item.taskId },
    }),
    [workspaceId, projectId],
  );

  // Export: 全件取得してCSVエクスポート（プレビューは現在表示中のデータ）
  const fetchAllTasks = useCallback(
    () => taskAccessor.query(collectionIdentity),
    [taskAccessor, collectionIdentity],
  );

  const { open: openExport, modal: exportModal } = useExportModal({
    schema: tasksCollection.dataSchema,
    data: tasks,
    fetchAll: fetchAllTasks,
    filename: `tasks-${projectId}.csv`,
  });

  // Import: CSVからタスクを一括インポート
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

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>タスク一覧</Title>
        <Group>
          <CodeViewerModal
            pageCode={pageCode}
            collectionCode={collectionCode}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={openModal}>
            新規作成
          </Button>
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg">
                <IconDots size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
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
          showPreview={true}
        />
      </Box>

      <AutoTable
        schema={taskTableSchema}
        data={tasks}
        keyField="taskId"
        actionParams={getActionParams}
      />

      <FetchMore
        isLoading={isLoading}
        hasMore={hasMore}
        fetchMore={fetchMore}
        scannedCount={scannedCount}
        filteredCount={filteredCount}
        itemCount={tasks.length}
        emptyWithMoreMessage="フィルタ条件に一致するタスクが見つかりませんでした"
        emptyNoMoreMessage="タスクがありません。新規作成してください。"
      />

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
          showPreview={true}
        />
      </Modal>

      {exportModal}
      {importModal}
    </Container>
  );
};

export default TasksPage;
