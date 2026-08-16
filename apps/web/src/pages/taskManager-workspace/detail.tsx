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
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { firestore } from "@repo/firebase";
import { useStoreKey } from "../../shared/auth";

import { workspacesCollection } from "../../shared/taskManager/collections/workspace";
import { useDoc } from "../../shared/taskManager/hooks";
import { AutoForm } from "../../components/AutoForm";
import { workspaceDetailRoute } from "./detail.route";
import { workspacesRoute } from "../taskManager-top/workspaces.route";

import pageCode from "./detail.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/workspace.ts?raw";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";

const WorkspaceDetailPage = () => {
  const { workspaceId } = useParams({
    from: workspaceDetailRoute.id,
  });
  const navigate = useNavigate();
  const storeKey = useStoreKey();

  const accessor = useMemo(
    () => getAccessor(firestore, workspacesCollection, storeKey),
    [storeKey],
  );
  // useDoc: 単一ドキュメントの購読（useEffect + docSync の手書きを置き換え）
  const { item: workspace, isLoading: isWorkspaceLoading } = useDoc({
    collection: workspacesCollection,
    documentIdentity: useMemo(() => ({ workspaceId }), [workspaceId]),
  });
  const [isLoading, setIsLoading] = useState(false);

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
            schema={workspacesCollection.updateSchema}
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
