import {
  Title,
  Text,
  Container,
  Card,
  Group,
  Stack,
  Loader,
  Center,
  Menu,
  ActionIcon,
  Modal,
  Select,
  Button,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconDotsVertical,
  IconArchive,
  IconArrowsExchange,
} from "@tabler/icons-react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { z } from "zod";
import { firestore } from "@repo/firebase";
import { createFirestoreResolver } from "@zodapp/zod-form-firebase";
import { useStoreKey } from "../../../shared/auth";
import {
  DeleteMenuItem,
  useDeleteModal,
} from "@zodapp/zod-form-widget/feedback";

import {
  getAccessor,
  getMutationsAccessor,
} from "@zodapp/zod-firebase-browser";
import {
  taskMutations,
  tasksCollection,
} from "../../../shared/taskManager/collections/task";
import {
  projectQueries,
  projectsCollection,
} from "../../../shared/taskManager/collections/project";
import { useDoc, useList } from "../../../shared/taskManager/hooks";
import { AutoForm } from "../../../components/AutoForm";
import { taskDetailRoute } from "./detail.route";
import { tasksRoute } from "../tasks.route";
import { useCodeViewerModal } from "../../../components/useCodeViewerModal";

import pageCode from "./detail.tsx?raw";
import collectionCode from "../../../shared/taskManager/collections/task.ts?raw";

const TaskDetailPage = () => {
  const { workspaceId, projectId, taskId } = useParams({
    from: taskDetailRoute.id,
  });
  const navigate = useNavigate();
  const storeKey = useStoreKey();

  const accessor = useMemo(
    () => getAccessor(firestore, tasksCollection, storeKey),
    [storeKey],
  );
  const mutationsAccessor = useMemo(
    () => getMutationsAccessor(firestore, taskMutations, storeKey),
    [storeKey],
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

  // useDoc: 単一ドキュメントの購読（useEffect + docSync の手書きを置き換え）
  const { item: task, isLoading: isTaskLoading } = useDoc({
    collection: tasksCollection,
    documentIdentity: useMemo(
      () => ({ workspaceId, projectId, taskId }),
      [workspaceId, projectId, taskId],
    ),
  });
  const [isLoading, setIsLoading] = useState(false);

  // ---- タスクの別プロジェクトへの移動（トランザクション） ----
  const [
    moveModalOpened,
    { open: openMoveModal, close: closeMoveModal },
  ] = useDisclosure(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const { items: projects } = useList({
    collection: projectsCollection,
    collectionIdentity: useMemo(() => ({ workspaceId }), [workspaceId]),
    query: projectQueries.queries.active(),
  });
  const moveTargetOptions = useMemo(
    () =>
      projects
        .filter((project) => project.projectId !== projectId)
        .map((project) => ({ value: project.projectId, label: project.name })),
    [projects, projectId],
  );

  const handleMove = useCallback(async () => {
    if (!moveTargetId) return;
    setIsMoving(true);
    try {
      // 「読み取り → 移動先に作成 → 移動元を削除」を 1 トランザクションで
      // 実行する。途中で失敗した場合はすべてロールバックされるため、
      // タスクの重複や消失が起きない。
      // accessor.withContext({ runner: transaction }) でトランザクション内
      // 実行になる（読み取りは書き込みより先に行う必要がある）
      await firestore.runTransaction(async (transaction) => {
        const txAccessor = accessor.withContext({ runner: transaction });
        const current = await txAccessor.getDoc({
          workspaceId,
          projectId,
          taskId,
        });
        if (!current) {
          throw new Error("タスクが見つかりません");
        }
        await txAccessor.createDoc(
          { workspaceId, projectId: moveTargetId },
          {
            title: current.title,
            description: current.description,
            status: current.status,
            priority: current.priority,
            labels: current.labels,
            assigneeId: current.assigneeId,
            watchers: current.watchers,
            dueAt: current.dueAt,
            deletedAt: current.deletedAt,
          },
        );
        await txAccessor.deleteDoc({ workspaceId, projectId, taskId });
      });
      closeMoveModal();
      navigate({
        to: tasksRoute.to,
        params: { workspaceId, projectId: moveTargetId },
      });
    } catch (error) {
      console.error("Failed to move task:", error);
    } finally {
      setIsMoving(false);
    }
  }, [
    accessor,
    moveTargetId,
    workspaceId,
    projectId,
    taskId,
    navigate,
    closeMoveModal,
  ]);

  const { open: openDelete, modal: deleteModal } = useDeleteModal({
    title: "タスクを削除",
    message: "このタスクを削除しますか？この操作は元に戻せません。",
    onDelete: async () => {
      await mutationsAccessor.softDelete({ workspaceId, projectId, taskId });
      navigate({
        to: tasksRoute.to,
        params: { workspaceId, projectId },
      });
    },
  });

  const { open: openArchive, modal: archiveModal } = useDeleteModal({
    title: "タスクをアーカイブ",
    message: "このタスクをアーカイブしますか？",
    confirmLabel: "アーカイブする",
    onDelete: async () => {
      await mutationsAccessor.archive({ workspaceId, projectId, taskId });
      navigate({
        to: tasksRoute.to,
        params: { workspaceId, projectId },
      });
    },
  });

  const handleSubmit = useCallback(
    async (data: z.infer<typeof tasksCollection.updateSchema>) => {
      setIsLoading(true);
      try {
        await accessor.updateDoc({ workspaceId, projectId, taskId }, data);
        navigate({
          to: tasksRoute.to,
          params: { workspaceId, projectId },
        });
      } catch (error) {
        console.error("Failed to update task:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [accessor, taskId, navigate, workspaceId, projectId],
  );

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  const handleCancel = useCallback(() => {
    navigate({
      to: tasksRoute.to,
      params: { workspaceId, projectId },
    });
  }, [navigate, workspaceId, projectId]);

  if (isLoading || isTaskLoading || !task) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>タスク詳細</Title>
        <Group>
          {codeViewerTrigger}
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconArchive size={16} />}
                onClick={openArchive}
              >
                アーカイブ
              </Menu.Item>
              <Menu.Item
                leftSection={<IconArrowsExchange size={16} />}
                onClick={openMoveModal}
              >
                別プロジェクトへ移動
              </Menu.Item>
              <Menu.Divider />
              <DeleteMenuItem label="タスクを削除" onClick={openDelete} />
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Stack gap="lg">
        <Card withBorder>
          <Text fw={500} mb="md">
            タスク情報
          </Text>
          <AutoForm
            schema={tasksCollection.updateSchema}
            defaultValues={task}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            externalKeyResolvers={externalKeyResolvers}
            resolverContext={resolverContext}
            showPreview={true}
          />
        </Card>
      </Stack>
      <Modal
        opened={moveModalOpened}
        onClose={closeMoveModal}
        title="別プロジェクトへ移動"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            移動先プロジェクトを選択してください。移動はトランザクションで
            実行され、コピーの作成と元タスクの削除が原子的に行われます。
          </Text>
          <Select
            label="移動先プロジェクト"
            placeholder="プロジェクトを選択"
            data={moveTargetOptions}
            value={moveTargetId}
            onChange={setMoveTargetId}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeMoveModal}>
              キャンセル
            </Button>
            <Button
              onClick={() => void handleMove()}
              disabled={!moveTargetId}
              loading={isMoving}
            >
              移動する
            </Button>
          </Group>
        </Stack>
      </Modal>

      {codeViewerModal}
      {deleteModal}
      {archiveModal}
    </Container>
  );
};

export default TaskDetailPage;
