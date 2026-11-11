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
import { useState, useCallback, useMemo } from "react";
import { z } from "zod";
import { useApi } from "@zodapp/zod-dynamodb-react";
import type { Api } from "../../shared/api";

import { projectBodySchema } from "../../../shared";
import { useProject } from "../../shared/hooks";
import { AutoForm } from "../../components/AutoForm";
import { projectDetailRoute } from "./detail.route";
import { projectsRoute } from "../taskManager-workspace/projects.route";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";

import pageCode from "./detail.tsx?raw";
import collectionCode from "../../../shared/tables/project.ts?raw";

const ProjectDetailPage = () => {
  const { workspaceId, projectId } = useParams({
    from: projectDetailRoute.id,
  });
  const navigate = useNavigate();
  const api = useApi<Api>();

  const projectKey = useMemo(
    () => ({ workspaceId, projectId }),
    [workspaceId, projectId],
  );
  const { status, item: project, token } = useProject(projectKey);
  const isProjectLoading = status === "loading";
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (data: z.infer<typeof projectBodySchema>) => {
      setIsLoading(true);
      try {
        // 読んだ時点から誰かが変えていたら、上書きせずに失敗させる
        await api.projects.update(projectKey, data, { ifUnchanged: token });
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
    [api, projectKey, token, workspaceId, navigate],
  );

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  const handleCancel = useCallback(() => {
    navigate({
      to: projectsRoute.to,
      params: { workspaceId },
    });
  }, [navigate, workspaceId]);

  if (isLoading || isProjectLoading || !project) {
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
        {codeViewerTrigger}
      </Group>

      <Stack gap="lg">
        <Card withBorder>
          <Text fw={500} mb="md">
            プロジェクト情報
          </Text>
          <AutoForm
            schema={projectBodySchema}
            defaultValues={project}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            showPreview={true}
          />
        </Card>
      </Stack>
      {codeViewerModal}
    </Container>
  );
};

export default ProjectDetailPage;
