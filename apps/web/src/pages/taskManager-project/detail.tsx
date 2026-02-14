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

import { projectsCollection } from "../../shared/taskManager/collections/project";
import { AutoForm } from "../../components/AutoForm";
import { projectDetailRoute } from "./detail.route";
import { projectsRoute } from "../taskManager-workspace/projects.route";
import { CodeViewerModal } from "../../components/CodeViewerModal";

import pageCode from "./detail.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/project.ts?raw";

const ProjectDetailPage = () => {
  const { workspaceId, projectId } = useParams({
    from: projectDetailRoute.id,
  });
  const navigate = useNavigate();

  const accessor = getAccessor(firestore, projectsCollection);
  const [project, setProject] = useState<z.infer<
    typeof projectsCollection.updateSchema
  > | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = accessor.docSync({ workspaceId, projectId }, (doc) => {
      setProject(doc);
    });
    return () => unsubscribe();
  }, [accessor, workspaceId, projectId]);

  const handleSubmit = useCallback(
    async (data: z.infer<typeof projectsCollection.updateSchema>) => {
      setIsLoading(true);
      try {
        await accessor.updateDoc({ workspaceId, projectId }, data);
        navigate({
          to: projectsRoute.to,
          params: { workspaceId },
        });
      } catch (error) {
        console.error("Failed to update project:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [accessor, workspaceId, projectId, navigate],
  );

  const handleCancel = useCallback(() => {
    navigate({
      to: projectsRoute.to,
      params: { workspaceId },
    });
  }, [navigate, workspaceId]);

  if (isLoading || !project) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>プロジェクト詳細</Title>
        <CodeViewerModal pageCode={pageCode} collectionCode={collectionCode} />
      </Group>

      <Stack gap="lg">
        <Card withBorder>
          <Text fw={500} mb="md">
            プロジェクト情報
          </Text>
          <AutoForm
            schema={projectsCollection.updateSchema}
            defaultValues={project}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            showPreview={true}
          />
        </Card>
      </Stack>
    </Container>
  );
};

export default ProjectDetailPage;
