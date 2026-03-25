import {
  Title,
  Text,
  Container,
  Group,
  Modal,
  Loader,
  Center,
  Paper,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { useCallback, useMemo } from "react";
import { AutoTable } from "@zodapp/zod-form-widget/table";

import { z } from "zod";

import { workspacesCollection } from "../../shared/taskManager/collections";
import { projectsRoute } from "../taskManager-workspace/projects.route";
import { CodeViewerModal } from "../../components/CodeViewerModal";
import { createActionSchema } from "../../components/createActionSchema";
import { useAuthContext } from "../../shared/auth";
import { useUserWorkspaces } from "./utils/userWorkspace";
import { WorkspaceCreate } from "./WorkspaceCreate";

import pageCode from "./workspaces.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/workspace.ts?raw";
import { zf } from "@zodapp/zod-form";

type WorkspaceData = z.infer<typeof workspacesCollection.dataSchema>;

const WorkspacesPage = () => {
  const { user } = useAuthContext();
  const userEmail = user?.email;

  const {
    workspaces,
    isLoading,
    refetch: fetchUserWorkspaces,
    createWorkspaceWithOwner,
  } = useUserWorkspaces(userEmail);

  const workspaceTableSchema = useMemo(
    () =>
      workspacesCollection.dataSchema
        .extend({
          _action: createActionSchema<WorkspaceData>({
            getParams: (item) => ({
              to: projectsRoute.to,
              params: { workspaceId: item.workspaceId },
            }),
          }),
        })
        .register(zf.object.registry, {
          properties: ["name", "description", "createdAt", "_action"],
        }),
    [],
  );

  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);

  const handleCreated = useCallback(
    async (_workspaceId: string) => {
      closeModal();
      await fetchUserWorkspaces();
    },
    [closeModal, fetchUserWorkspaces],
  );

  if (!userEmail) {
    return (
      <Center h={200}>
        <Text>
          ログイン情報が取得できませんでした。ログインしなおしてください。
        </Text>
      </Center>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>ワークスペース一覧</Title>
        <Group>
          <CodeViewerModal
            pageCode={pageCode}
            collectionCode={collectionCode}
          />
          <Tooltip label="新規作成">
            <ActionIcon variant="filled" size="lg" radius="xl" onClick={openModal}>
              <IconPlus size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <AutoTable
        schema={workspaceTableSchema}
        data={workspaces}
        keyField="workspaceId"
      />
      {!isLoading && workspaces.length === 0 && (
        <Paper p="xl" withBorder mt="sm">
          <Text c="dimmed" ta="center">
            ワークスペースがありません。新規作成してください。
          </Text>
        </Paper>
      )}
      {isLoading && (
        <Center h={200}>
          <Loader />
        </Center>
      )}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title="新規ワークスペース作成"
        size="calc(100vw - 3rem)"
      >
        <WorkspaceCreate
          userEmail={userEmail}
          userDisplayName={user?.displayName || userEmail}
          createWorkspaceWithOwner={createWorkspaceWithOwner}
          onCreated={handleCreated}
          onCancel={closeModal}
        />
      </Modal>
    </Container>
  );
};

export default WorkspacesPage;
