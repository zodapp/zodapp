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
import { useParams } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { firestore } from "@repo/firebase";
import { AutoTable } from "../../components/AutoTable";

import type { z } from "zod";

import { useList } from "../../shared/taskManager/hooks";
import { membersCollection } from "../../shared/taskManager/collections/member";
import { AutoForm } from "../../components/AutoForm";
import { membersRoute } from "./members.route";
import { memberDetailRoute } from "./member/detail.route";
import { CodeViewerModal } from "../../components/CodeViewerModal";

import pageCode from "./members.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/member.ts?raw";
import { WorkspaceService } from "../taskManager-top/utils/userWorkspace";
import { zf } from "@zodapp/zod-form";

// テーブル表示用スキーマ
const memberTableSchema = membersCollection.dataSchema
  .extend({}) // registerは破壊的なのでcopyしてからregisterする
  .register(zf.object.registry, {
    properties: ["displayName", "email", "role", "createdAt", "updatedAt"],
  });

const MembersPage = () => {
  const { workspaceId } = useParams({
    from: membersRoute.id,
  });
  const pathParams = useMemo(() => ({ workspaceId }), [workspaceId]);

  // accessor を取得
  const memberAccessor = getAccessor(firestore, membersCollection);
  const { items: members, isLoading } = useList({
    collection: membersCollection,
    pathParams,
    query: {
      orderBy: [{ field: "createdAt", direction: "desc" }],
    },
  });

  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getActionParams = useCallback(
    (item: z.infer<typeof membersCollection.dataSchema>) => ({
      to: memberDetailRoute.to,
      params: { workspaceId, memberId: item.memberId },
    }),
    [workspaceId],
  );

  const handleCreate = useCallback(
    async (data: z.infer<typeof membersCollection.createSchema>) => {
      setIsSubmitting(true);
      try {
        await memberAccessor.createDoc({ workspaceId }, data);
        closeModal();
      } catch (error) {
        console.error("Failed to create member:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [memberAccessor, workspaceId, closeModal],
  );

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>メンバー一覧</Title>
        <Group>
          <CodeViewerModal
            pageCode={pageCode}
            collectionCode={collectionCode}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={openModal}>
            新規追加
          </Button>
        </Group>
      </Group>

      <AutoTable
        schema={memberTableSchema}
        data={members}
        keyField="memberId"
        actionParams={getActionParams}
      />
      {!isLoading && members.length === 0 && (
        <Paper p="xl" withBorder mt="sm">
          <Text c="dimmed" ta="center">
            メンバーがいません。新規追加してください。
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
        title="メンバー追加"
        size="calc(100vw - 3rem)"
      >
        <AutoForm
          schema={membersCollection.createSchema}
          onSubmit={handleCreate}
          onCancel={closeModal}
          isLoading={isSubmitting}
          submitLabel="追加"
          showPreview={true}
        />
      </Modal>
    </Container>
  );
};

export default MembersPage;
