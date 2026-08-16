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
  Checkbox,
  Button,
  Paper,
  Text,
  Select,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconDotsVertical,
  IconDownload,
  IconUpload,
  IconFileUnknown,
  IconSeeding,
  IconSettings,
  IconRestore,
  IconArchive,
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
  taskStatusLiterals,
  type TaskStatus,
} from "../../shared/taskManager/collections/task";
import { getMeta } from "@zodapp/zod-form";
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
import { useProfileColumnSettings } from "../../shared/taskManager/useProfileColumnSettings";
import { taskDetailRoute } from "./task/detail.route";
import { tasksRoute, searchFilterSchema } from "./tasks.route";
import { populateSeed } from "./seed";
import { firestore } from "@repo/firebase";
import { createFirestoreResolver } from "@zodapp/zod-form-firebase";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import {
  useExportModal,
  useImportModal,
  DynamicImportPanel,
  type DynamicImportValue,
  type DynamicTabularRow,
} from "@zodapp/zod-form-widget/tabular";
import { useStoreKey } from "../../shared/auth";
import type { GrowingListQuerySpec } from "../../shared/taskManager/listQuerySpec";
import { useExportFetchAll } from "../../shared/taskManager/exportFetch";

import pageCode from "./tasks.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/task.ts?raw";

const TASK_TABLE_STORAGE_KEY = "tableSetting-task";
const TASK_TABLE_DEFAULT_FIELD_PATHS = [
  "_select",
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
// 行選択状態を data 側に載せた行型（選択列の computed が参照する）
type SelectableTaskData = TaskData & { _selected: boolean };
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

  // 行選択（複数選択 → 一括操作）
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const taskTableSchema = useMemo(
    () =>
      extendSchemaSafe(
        extendSchemaSafe(tasksCollection.dataSchema, {
          _action: createActionSchema<TaskData>({
            getParams: (item) => ({
              to: taskDetailRoute.to,
              params: { workspaceId, projectId, taskId: item.taskId },
            }),
          }),
        }),
        {
          // 選択チェックボックス列。選択状態は data 側（_selected）に
          // 載せることで、選択変更のたびにスキーマを作り直さずに済む
          _select: zfReact
            .computed()
            .register(zfReact.computed.registry, {
              label: "選択",
              width: 40,
              align: "center" as const,
              compute: (row: SelectableTaskData) => (
                <Checkbox
                  checked={row._selected}
                  onChange={() => toggleTaskSelection(row.taskId)}
                  aria-label="行を選択"
                />
              ),
            })
            .optional(),
        },
        { mode: "head" },
      ),
    [workspaceId, projectId, toggleTaskSelection],
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

  // 検索条件の適用場所:
  // - client: 取得済みデータに mingo でフィルタ（インデックス不要。
  //   スキャン件数は増えるが柔軟な条件が書ける）
  // - server: Firestore ネイティブクエリ（==, >=, <= を where に反映。
  //   転送量は減るが、本番では条件の組み合わせごとに複合インデックスが
  //   必要になる。firestore.indexes.json を参照）
  const [filterMode, setFilterMode] = useState<"client" | "server">("client");

  // 復元済みタスクの楽観的除外用。
  // （復元でタスクはゴミ箱クエリの対象外になるが、リアルタイム更新の
  // 購読は購読開始以降の updatedAt を監視するため、購読開始前から
  // 表示されていた行はストリームからは消えない）
  const [restoredTaskIds, setRestoredTaskIds] = useState<Set<string>>(
    () => new Set(),
  );

  const handleRestore = useCallback(
    async (row: TaskData) => {
      await mutationsAccessor.restore({
        workspaceId,
        projectId,
        taskId: row.taskId,
      });
      setRestoredTaskIds((prev) => new Set(prev).add(row.taskId));
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
          item.deletedAt != null &&
          !restoredTaskIds.has(item.taskId) &&
          (mingoFilter?.(item) ?? true),
      };
    }

    const activeQuery = taskQueries.queries.active();

    if (filterMode === "server") {
      // 全条件を Firestore ネイティブの where に反映する。
      // 範囲演算子（>=, <=）は複数フィールドの不等式クエリとして実行される
      const where: WhereParams[] = [...(activeQuery.where ?? [])];
      if (q.status) {
        where.push({ field: "status", operator: "==" as const, value: q.status });
      }
      if (q.priority) {
        where.push({
          field: "priority",
          operator: "==" as const,
          value: q.priority,
        });
      }
      if (q.dueAt?.$gte) {
        where.push({
          field: "dueAt",
          operator: ">=" as const,
          value: q.dueAt.$gte,
        });
      }
      if (q.dueAt?.$lte) {
        where.push({
          field: "dueAt",
          operator: "<=" as const,
          value: q.dueAt.$lte,
        });
      }
      return {
        collection: tasksCollection,
        collectionIdentity,
        query: {
          where,
          orderBy: [{ field: "createdAt", direction: "desc" as const }],
        },
        // サーバ側で全条件を適用するため clientFilter は不要
      };
    }

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
  }, [collectionIdentity, search.q, view, filterMode, restoredTaskIds]);

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

  // 選択状態を data に反映した行（選択列の computed が _selected を参照）
  const selectableTasks = useMemo<SelectableTaskData[]>(
    () =>
      tasks.map((task) => ({
        ...task,
        _selected: selectedTaskIds.has(task.taskId),
      })),
    [tasks, selectedTaskIds],
  );

  // 一括操作: WriteBatch に書き込みをまとめて 1 コミットで反映する。
  // accessor.withContext({ runner: batch }) は書き込み専用のアクセサを返す
  const handleBulkStatusChange = useCallback(
    async (status: TaskStatus) => {
      const batch = firestore.batch();
      const batchAccessor = taskAccessor.withContext({ runner: batch });
      for (const taskId of selectedTaskIds) {
        batchAccessor.updateDoc({ workspaceId, projectId, taskId }, { status });
      }
      await batch.commit();
      setSelectedTaskIds(new Set());
    },
    [taskAccessor, selectedTaskIds, workspaceId, projectId],
  );

  const handleBulkArchive = useCallback(async () => {
    const batch = firestore.batch();
    const batchAccessor = taskAccessor.withContext({ runner: batch });
    for (const taskId of selectedTaskIds) {
      batchAccessor.updateDoc(
        { workspaceId, projectId, taskId },
        { archivedAt: new Date() },
      );
    }
    await batch.commit();
    setSelectedTaskIds(new Set());
  }, [taskAccessor, selectedTaskIds, workspaceId, projectId]);

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

  // ---- スキーマレス（任意ヘッダ）CSV 取込 ----
  // useImportModal はスキーマのプロパティ名がヘッダの CSV を前提とするのに
  // 対し、DynamicImportPanel は任意ヘッダの CSV をそのまま読み込み、
  // 取り込み時に列マッピングを行う。外部ツールからのエクスポートなど、
  // ヘッダを制御できないファイルの取り込みに使う
  const [
    dynamicImportOpened,
    { open: openDynamicImport, close: closeDynamicImport },
  ] = useDisclosure(false);
  const [dynamicImportValue, setDynamicImportValue] =
    useState<DynamicImportValue | null>(null);
  const [columnMapping, setColumnMapping] = useState<
    Record<string, string | null>
  >({});

  const headers = dynamicImportValue?.parsed.headers ?? [];

  // ヘッダ名からの自動マッピング推測
  const guessMapping = useCallback((headerList: string[]) => {
    const guess = (candidates: string[]) =>
      headerList.find((header) =>
        candidates.some((candidate) =>
          header.toLowerCase().includes(candidate),
        ),
      ) ?? null;
    return {
      title: guess(["title", "タスク", "名前", "件名"]) ?? headerList[0] ?? null,
      description: guess(["desc", "説明", "詳細", "内容"]),
      status: guess(["status", "ステータス", "状態"]),
      dueAt: guess(["due", "期限", "締切"]),
    };
  }, []);

  const handleDynamicImportChange = useCallback(
    (value: DynamicImportValue | null) => {
      setDynamicImportValue(value);
      setColumnMapping(value ? guessMapping(value.parsed.headers) : {});
    },
    [guessMapping],
  );

  const statusLabelToValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const literal of taskStatusLiterals) {
      const value = literal.value as string;
      map.set(value, value);
      const label = getMeta(literal, "literal")?.label;
      if (label) map.set(label, value);
    }
    return map;
  }, []);

  const handleDynamicImport = useCallback(
    async (value: DynamicImportValue) => {
      const pick = (row: DynamicTabularRow, key: string) => {
        const header = columnMapping[key];
        const cell = header ? row[header] : undefined;
        return cell == null ? undefined : String(cell);
      };
      for (const row of value.parsed.rows) {
        const title = pick(row, "title")?.trim();
        if (!title) continue; // タイトルなしの行はスキップ
        const statusRaw = pick(row, "status");
        const dueAtRaw = pick(row, "dueAt");
        const dueAt = dueAtRaw ? new Date(dueAtRaw) : undefined;
        const input: z.infer<typeof tasksCollection.createSchema> = {
          title,
          description: pick(row, "description"),
          status:
            (statusRaw && statusLabelToValue.get(statusRaw)
              ? (statusLabelToValue.get(statusRaw) as z.infer<
                  typeof tasksCollection.createSchema
                >["status"])
              : undefined) ?? "todo",
          priority: "medium",
          labels: [],
          deletedAt: null,
          dueAt:
            dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : undefined,
        };
        // createSchema でバリデーションしてから登録する
        const parsed = tasksCollection.createSchema.safeParse(input);
        if (!parsed.success) continue;
        await taskAccessor.createDoc(collectionIdentity, input);
      }
      closeDynamicImport();
      setDynamicImportValue(null);
    },
    [
      columnMapping,
      statusLabelToValue,
      taskAccessor,
      collectionIdentity,
      closeDynamicImport,
    ],
  );

  // 列設定プロファイル（このブラウザ / 個人 / ワークスペース共通の3スコープ）
  const activeController = useProfileColumnSettings({
    tableKey: TASK_TABLE_STORAGE_KEY,
    schema: taskTableSchema,
    defaultFieldPaths: TASK_TABLE_DEFAULT_FIELD_PATHS,
    workspaceId,
  });

  const trashController = useProfileColumnSettings({
    tableKey: TASK_TRASH_TABLE_STORAGE_KEY,
    schema: trashTableSchema,
    defaultFieldPaths: TASK_TRASH_TABLE_DEFAULT_FIELD_PATHS,
    workspaceId,
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
              <Menu.Item
                leftSection={<IconFileUnknown size={16} />}
                onClick={openDynamicImport}
              >
                CSVインポート（任意ヘッダ）
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
        {view === "active" && (
          <Group gap="xs" mt="xs">
            <Tooltip
              label="server: Firestoreのwhere句で絞り込み（要インデックス） / client: 取得済みデータをmingoで絞り込み"
              position="right"
            >
              <SegmentedControl
                size="xs"
                value={filterMode}
                onChange={(value) =>
                  setFilterMode(value as "client" | "server")
                }
                data={[
                  { value: "client", label: "クライアント絞り込み" },
                  { value: "server", label: "サーバ絞り込み" },
                ]}
              />
            </Tooltip>
          </Group>
        )}
      </Box>

      {view === "active" && selectedTaskIds.size > 0 && (
        <Paper withBorder p="xs" mb="sm">
          <Group gap="sm">
            <Text size="sm">{selectedTaskIds.size} 件選択中</Text>
            <Menu shadow="md" position="bottom-start">
              <Menu.Target>
                <Button size="xs" variant="light">
                  ステータス一括変更
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {taskStatusLiterals.map((literal) => (
                  <Menu.Item
                    key={literal.value}
                    onClick={() =>
                      void handleBulkStatusChange(literal.value as TaskStatus)
                    }
                  >
                    {getMeta(literal, "literal")?.label ?? literal.value}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <Button
              size="xs"
              variant="light"
              color="orange"
              leftSection={<IconArchive size={14} />}
              onClick={() => void handleBulkArchive()}
            >
              一括アーカイブ
            </Button>
            <Button
              size="xs"
              variant="subtle"
              onClick={() => setSelectedTaskIds(new Set())}
            >
              選択解除
            </Button>
          </Group>
        </Paper>
      )}

      <div
        ref={scrollParentRef}
        style={{ overflow: "auto", flex: 1, minHeight: 0 }}
      >
        <AutoTable
          ref={tableRef}
          data={view === "active" ? selectableTasks : tasks}
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

      <Modal
        opened={dynamicImportOpened}
        onClose={() => {
          closeDynamicImport();
          setDynamicImportValue(null);
        }}
        title="CSVインポート（任意ヘッダ）"
        size="calc(100vw - 3rem)"
      >
        <DynamicImportPanel
          value={dynamicImportValue}
          onChange={handleDynamicImportChange}
          onImport={handleDynamicImport}
          renderFooter={({ executeImport, isImporting, rowCount }) => (
            <Box mt="md">
              {headers.length > 0 && (
                <Group gap="md" mb="md" align="flex-end">
                  {(
                    [
                      { key: "title", label: "タスク名（必須）" },
                      { key: "description", label: "説明" },
                      { key: "status", label: "ステータス" },
                      { key: "dueAt", label: "期限" },
                    ] as const
                  ).map(({ key, label }) => (
                    <Select
                      key={key}
                      size="xs"
                      label={label}
                      placeholder="対応する列を選択"
                      data={headers}
                      value={columnMapping[key] ?? null}
                      onChange={(next) =>
                        setColumnMapping((prev) => ({ ...prev, [key]: next }))
                      }
                      clearable
                    />
                  ))}
                </Group>
              )}
              <Group justify="flex-end">
                <Text size="sm" c="dimmed">
                  {rowCount} 行
                </Text>
                <Button
                  onClick={() => void executeImport()}
                  loading={isImporting}
                  disabled={rowCount === 0 || !columnMapping.title}
                >
                  マッピングして取り込む
                </Button>
              </Group>
            </Box>
          )}
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
