import {
  Title,
  Text,
  Container,
  Card,
  Group,
  Button,
  Stack,
  Loader,
  Center,
} from "@mantine/core";
import { IconTrash, IconArchive } from "@tabler/icons-react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useMemo } from "react";
import { z } from "zod";
import { firestore } from "@repo/firebase";
import { createFirestoreResolver } from "@zodapp/zod-form-firebase";

import { getAccessor } from "@zodapp/zod-firebase-browser";
import { tasksCollection } from "../../../shared/taskManager/collections/task";
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

  // accessor を使用（mutations / queries が自動バインドされている）
  const accessor = getAccessor(firestore, tasksCollection);

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

  const handleDelete = useCallback(async () => {
    if (!confirm("このタスクを削除しますか？")) return;
    setIsLoading(true);
    try {
      // accessor.mutations.softDelete を直接使用
      await accessor.mutations.softDelete({ workspaceId, projectId, taskId });
      navigate({
        to: tasksRoute.to,
        params: { workspaceId, projectId },
      });
    } catch (error) {
      console.error("Failed to delete task:", error);
    } finally {
      setIsLoading(false);
    }
  }, [accessor, taskId, navigate, workspaceId, projectId]);

  const handleArchive = useCallback(async () => {
    if (!confirm("このタスクをアーカイブしますか？")) return;
    setIsLoading(true);
    try {
      // accessor.mutations.archive を直接使用
      await accessor.mutations.archive({ workspaceId, projectId, taskId });
      navigate({
        to: tasksRoute.to,
        params: { workspaceId, projectId },
      });
    } catch (error) {
      console.error("Failed to archive task:", error);
    } finally {
      setIsLoading(false);
    }
  }, [accessor, taskId, navigate, workspaceId, projectId]);

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
          <Button
            variant="light"
            color="yellow"
            leftSection={<IconArchive size={16} />}
            onClick={handleArchive}
          >
            アーカイブ
          </Button>
          <Button
            variant="light"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={handleDelete}
          >
            削除
          </Button>
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
            showPreview={true}
          />
        </Card>
      </Stack>
    </Container>
  );
};

export default TaskDetailPage;
