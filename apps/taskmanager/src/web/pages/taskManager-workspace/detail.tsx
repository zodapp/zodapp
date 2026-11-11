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
import { workspaceBodySchema } from "../../../shared";
import type { Api } from "../../shared/api";
import { useWorkspace } from "../../shared/hooks";
import { AutoForm } from "../../components/AutoForm";
import { workspaceDetailRoute } from "./detail.route";
import { workspacesRoute } from "../taskManager-top/workspaces.route";

import pageCode from "./detail.tsx?raw";
import collectionCode from "../../../shared/tables/workspace.ts?raw";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";

const WorkspaceDetailPage = () => {
  const { workspaceId } = useParams({
    from: workspaceDetailRoute.id,
  });
  const navigate = useNavigate();
  const api = useApi<Api>();
  // useWorkspace: Item 1 件の取得。token は ifUnchanged に渡して、読んだ後の他の更新を検出する
  const {
    status,
    item: workspace,
    token,
  } = useWorkspace(useMemo(() => ({ workspaceId }), [workspaceId]));
  const isWorkspaceLoading = status === "loading";
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (data: z.infer<typeof workspaceBodySchema>) => {
      setIsLoading(true);
      try {
        await api.workspaces.update({ workspaceId }, data, { ifUnchanged: token });
        navigate({
          to: workspacesRoute.to,
        });
      } catch (error) {
        console.error("Failed to update workspace:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [api, workspaceId, token, navigate],
  );

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  const handleCancel = useCallback(() => {
    navigate({
      to: workspacesRoute.to,
    });
  }, [navigate]);

  if (isLoading || isWorkspaceLoading || !workspace) {
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
        {codeViewerTrigger}
      </Group>

      <Stack gap="lg">
        <Card withBorder>
          <Text fw={500} mb="md">
            ワークスペース情報
          </Text>
          <AutoForm
            schema={workspaceBodySchema}
            defaultValues={workspace}
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

export default WorkspaceDetailPage;
