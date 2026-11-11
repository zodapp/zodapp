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
  Tabs,
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
import { useApi } from "@zodapp/zod-dynamodb-react";
import type { Api } from "../../../shared/api";
import { postJson } from "../../../shared/api";
import { createDynamoExternalKeyResolver } from "../../../shared/resolvers";
import {
  DeleteMenuItem,
  useDeleteModal,
} from "@zodapp/zod-form-widget/feedback";

import { taskBodySchema } from "../../../../shared";
import { useProjects, useTask } from "../../../shared/hooks";
import { AutoForm } from "../../../components/AutoForm";
import { ReactiveAutoForm } from "../../../components/ReactiveAutoForm";
import { setNestedValue } from "@zodapp/zod-form-widget/form";
import { hideSchemaFields } from "@zodapp/zod-form";
import { taskDetailRoute } from "./detail.route";
import { tasksRoute } from "../tasks.route";
import { useCodeViewerModal } from "../../../components/useCodeViewerModal";

import pageCode from "./detail.tsx?raw";
import collectionCode from "../../../../shared/tables/task.ts?raw";

const TaskDetailPage = () => {
  const { workspaceId, projectId, taskId } = useParams({
    from: taskDetailRoute.id,
  });
  const navigate = useNavigate();
  const api = useApi<Api>();

  // 担当者などの選択肢は、members.list を購読して作る
  const externalKeyResolvers = useMemo(
    () => [createDynamoExternalKeyResolver()],
    [],
  );

  const resolverContext = useMemo(
    () => ({ workspace: { workspaceId } }),
    [workspaceId],
  );

  const taskKey = useMemo(
    () => ({ workspaceId, projectId, taskId }),
    [workspaceId, projectId, taskId],
  );
  const { status, item: task, token } = useTask(taskKey);
  const isTaskLoading = status === "loading";
  // 書き込めるか（閲覧者は不可）。できなければ、フォームを読み取り専用にする
  const canEdit = api.tasks.update.can(taskKey, {}).ok;
  const [isLoading, setIsLoading] = useState(false);

  // ---- 逐次保存（ReactiveAutoForm）用 ----
  // reactiveComponentLibrary は配列フィールドに未対応のため、
  // 逐次保存タブでは labels / watchers を非表示にする
  // updateSchema の静的型は ZodType だが実体は object スキーマなので、
  // ReactiveAutoForm の要求する ZodObject へキャストする
  const reactiveSchema = useMemo(
    () =>
      hideSchemaFields(taskBodySchema, {
        paths: ["labels", "watchers"],
      }) as unknown as z.ZodObject<z.ZodRawShape>,
    [],
  );

  // フィールド確定時にそのフィールドだけを部分更新する。
  // setNestedValue でフィールドパスから部分更新オブジェクトを作る
  const handleReactiveConfirm = useCallback(
    async (fieldPath: string, value: unknown) => {
      const updateData = setNestedValue({}, fieldPath, value);
      // update の params は部分更新（送った項目だけが変わる）
      await api.tasks.update(taskKey, updateData);
    },
    [api, taskKey],
  );

  // blur 時の未確定変更の扱い: true=確定 / false=破棄 / undefined=保留。
  // ここでは blur で自動確定する（確認モーダルを挟む場合は
  // ここでダイアログを出して結果を返す）
  const handleReactiveBlur = useCallback(() => true, []);

  // ---- タスクの別プロジェクトへの移動（トランザクション） ----
  const [
    moveModalOpened,
    { open: openMoveModal, close: closeMoveModal },
  ] = useDisclosure(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const { items: projects } = useProjects(
    useMemo(() => ({ workspaceId, status: "active" as const }), [workspaceId]),
  );
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
      // 「読み取り → 移動先に作成 → 移動元を削除」を、サーバーが
      // 1 回のトランザクションで行う。途中で失敗した場合はすべて取り消されるため、
      // タスクの重複や消失が起きない
      await postJson("/tasks/move", { ...taskKey, toProjectId: moveTargetId });
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
  }, [taskKey, moveTargetId, workspaceId, navigate, closeMoveModal]);

  const { open: openDelete, modal: deleteModal } = useDeleteModal({
    title: "タスクを削除",
    message: "このタスクを削除しますか？この操作は元に戻せません。",
    onDelete: async () => {
      await api.tasks.softDelete(taskKey, {});
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
      await api.tasks.archive(taskKey, {});
      navigate({
        to: tasksRoute.to,
        params: { workspaceId, projectId },
      });
    },
  });

  const handleSubmit = useCallback(
    async (data: z.infer<typeof taskBodySchema>) => {
      setIsLoading(true);
      try {
        await api.tasks.update(taskKey, data, { ifUnchanged: token });
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
    [api, taskKey, token, navigate, workspaceId, projectId],
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
          {canEdit && (
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
          )}
        </Group>
      </Group>

      <Stack gap="lg">
        <Card withBorder>
          <Text fw={500} mb="md">
            タスク情報
          </Text>
          <Tabs defaultValue="batch">
            <Tabs.List mb="md">
              <Tabs.Tab value="batch">一括保存</Tabs.Tab>
              <Tabs.Tab value="reactive">逐次保存</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="batch">
              <AutoForm
                readOnly={!canEdit}
                schema={taskBodySchema}
                defaultValues={task}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                externalKeyResolvers={externalKeyResolvers}
                resolverContext={resolverContext}
                showPreview={true}
              />
            </Tabs.Panel>
            <Tabs.Panel value="reactive">
              <Text size="sm" c="dimmed" mb="md">
                フィールドを編集して確定すると、そのフィールドだけが即座に
                サーバーへ保存されます（保存ボタンなし）。
              </Text>
              <ReactiveAutoForm
                readOnly={!canEdit}
                schema={reactiveSchema}
                defaultValues={task}
                onConfirm={handleReactiveConfirm}
                onBlur={handleReactiveBlur}
                externalKeyResolvers={externalKeyResolvers}
                resolverContext={resolverContext}
                showPreview={true}
              />
            </Tabs.Panel>
          </Tabs>
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
