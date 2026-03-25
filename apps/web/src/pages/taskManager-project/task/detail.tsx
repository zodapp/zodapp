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
} from "@mantine/core";
import { IconDotsVertical, IconArchive } from "@tabler/icons-react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useMemo } from "react";
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
import { AutoForm } from "../../../components/AutoForm";
import { taskDetailRoute } from "./detail.route";
import { tasksRoute } from "../tasks.route";
import { CodeViewerModal } from "../../../components/CodeViewerModal";

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

  const [task, setTask] = useState<z.infer<
    typeof tasksCollection.updateSchema
  > | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = accessor.docSync(
      { workspaceId, projectId, taskId },
      (doc) => {
        setTask(doc);
      },
    );
    return () => unsubscribe();
  }, [accessor, workspaceId, projectId, taskId]);

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

  const handleCancel = useCallback(() => {
    navigate({
      to: tasksRoute.to,
      params: { workspaceId, projectId },
    });
  }, [navigate, workspaceId, projectId]);

  if (isLoading || !task) {
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
          <CodeViewerModal
            pageCode={pageCode}
            collectionCode={collectionCode}
          />
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
      {deleteModal}
      {archiveModal}
    </Container>
  );
};

export default TaskDetailPage;
