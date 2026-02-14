import {
  Title,
  Text,
  Container,
  Button,
  Group,
  Modal,
  Loader,
  Center,
  Paper,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconPlus } from "@tabler/icons-react";
import { useState, useCallback } from "react";
import { AutoTable } from "../../components/AutoTable";

import type { z } from "zod";

import { workspacesCollection } from "../../shared/taskManager/collections";
import { AutoForm } from "../../components/AutoForm";
import { projectsRoute } from "../taskManager-workspace/projects.route";
import { CodeViewerModal } from "../../components/CodeViewerModal";
import { useAuthContext } from "../../shared/auth";
import { useUserWorkspaces } from "./utils/userWorkspace";

import pageCode from "./workspaces.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/workspace.ts?raw";
import { zf } from "@zodapp/zod-form";

// テーブル表示用スキーマ
const workspaceTableSchema = workspacesCollection.dataSchema
  .extend({}) // registerは破壊的なのでcopyしてからregisterする
  .register(zf.object.registry, {
    properties: ["name", "description", "createdAt"],
  });

const WorkspacesPage = () => {
  const { user } = useAuthContext();
  const userEmail = user?.email;

  const {
    workspaces,
    isLoading,
    refetch: fetchUserWorkspaces,
    createWorkspaceWithOwner,
  } = useUserWorkspaces(userEmail);

  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getActionParams = useCallback(
    (item: z.infer<typeof workspaceTableSchema>) => ({
      to: projectsRoute.to,
      params: { workspaceId: item.workspaceId },
    }),
    [],
  );

  const handleCreate = useCallback(
    async (data: z.infer<typeof workspacesCollection.createSchema>) => {
      if (!userEmail || !user) {
        console.error("User email is required");
        return;
      }

      setIsSubmitting(true);
      try {
        await createWorkspaceWithOwner(data, {
          email: userEmail,
          displayName: user.displayName || userEmail,
        });

        closeModal();
        await fetchUserWorkspaces();
      } catch (error) {
        console.error("Failed to create workspace:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      userEmail,
      user,
      closeModal,
      fetchUserWorkspaces,
      createWorkspaceWithOwner,
    ],
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
          <Button leftSection={<IconPlus size={16} />} onClick={openModal}>
            新規作成
          </Button>
        </Group>
      </Group>

      <AutoTable
        schema={workspaceTableSchema}
        data={workspaces}
        keyField="workspaceId"
        actionParams={getActionParams}
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
        <AutoForm
          schema={workspacesCollection.createSchema}
          onSubmit={handleCreate}
          onCancel={closeModal}
          isLoading={isSubmitting}
          submitLabel="作成"
          showPreview={true}
          defaultValues={{
            ownerId: userEmail,
          }}
        />
      </Modal>
    </Container>
  );
};

export default WorkspacesPage;
