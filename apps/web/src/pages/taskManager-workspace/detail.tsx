import {
  Title,
  Text,
  Container,
  Card,
  Stack,
  Loader,
  Center,
  Group,
} from "@mantine/core";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { z } from "zod";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { firestore } from "@repo/firebase";

import { workspacesCollection } from "../../shared/taskManager/collections/workspace";
import { AutoForm } from "../../components/AutoForm";
import { workspaceDetailRoute } from "./detail.route";
import { workspacesRoute } from "../taskManager-top/workspaces.route";

import pageCode from "./detail.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/workspace.ts?raw";
import { CodeViewerModal } from "../../components/CodeViewerModal";

const WorkspaceDetailPage = () => {
  const { workspaceId } = useParams({
    from: workspaceDetailRoute.id,
  });
  const navigate = useNavigate();

  const accessor = getAccessor(firestore, workspacesCollection);
  const [workspace, setWorkspace] = useState<z.infer<
    typeof workspacesCollection.updateSchema
  > | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = accessor.docSync({ workspaceId }, (doc) => {
      setWorkspace(doc);
    });
    return () => unsubscribe();
  }, [accessor, workspaceId]);

  const handleSubmit = useCallback(
    async (data: z.infer<typeof workspacesCollection.updateSchema>) => {
      setIsLoading(true);
      try {
        await accessor.updateDoc({ workspaceId }, data);
        navigate({
          to: workspacesRoute.to,
        });
      } catch (error) {
        console.error("Failed to update workspace:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [accessor, workspaceId, navigate],
  );

  const handleCancel = useCallback(() => {
    navigate({
      to: workspacesRoute.to,
    });
  }, [navigate]);

  if (isLoading || !workspace) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>ワークスペース詳細</Title>
        <CodeViewerModal pageCode={pageCode} collectionCode={collectionCode} />
      </Group>

      <Stack gap="lg">
        <Card withBorder>
          <Text fw={500} mb="md">
            ワークスペース情報
          </Text>
          <AutoForm
            schema={workspacesCollection.updateSchema}
            defaultValues={workspace}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            showPreview={true}
          />
        </Card>
      </Stack>
    </Container>
  );
};

export default WorkspaceDetailPage;
