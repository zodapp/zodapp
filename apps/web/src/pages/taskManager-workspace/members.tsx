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
import { useParams } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { firestore, storage } from "@repo/firebase";
import { useStoreKey } from "../../shared/auth";
import { AutoTable } from "@zodapp/zod-form-widget/table";
import { createFirebaseStorageResolver } from "@zodapp/zod-form-firebase";
import { createActionSchema } from "../../components/createActionSchema";

import { z } from "zod";

import { useList } from "../../shared/taskManager/hooks";
import { membersCollection } from "../../shared/taskManager/collections/member";
import { AutoForm } from "../../components/AutoForm";
import { membersRoute } from "./members.route";
import { memberDetailRoute } from "./member/detail.route";
import { CodeViewerModal } from "../../components/CodeViewerModal";

import pageCode from "./members.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/member.ts?raw";
import { zf } from "@zodapp/zod-form";

type MemberData = z.infer<typeof membersCollection.dataSchema>;

const MembersPage = () => {
  const { workspaceId } = useParams({
    from: membersRoute.id,
  });

  const memberTableSchema = useMemo(
    () =>
      membersCollection.dataSchema
        .extend({
          _action: createActionSchema<MemberData>({
            getParams: (item) => ({
              to: memberDetailRoute.to,
              params: { workspaceId, memberId: item.memberId },
            }),
          }),
        })
        .register(zf.object.registry, {
          properties: [
            "displayName",
            "email",
            "role",
            "createdAt",
            "updatedAt",
            "_action",
          ],
        }),
    [workspaceId],
  );

  const collectionIdentity = useMemo(() => ({ workspaceId }), [workspaceId]);
  const storeKey = useStoreKey();
  const fileResolvers = useMemo(
    () => [createFirebaseStorageResolver({ storage })],
    [],
  );
  const resolverContext = useMemo(
    () => ({ workspace: { workspaceId } }),
    [workspaceId],
  );

  // accessor を取得
  const memberAccessor = useMemo(
    () => getAccessor(firestore, membersCollection, storeKey),
    [storeKey],
  );
  const { items: members, isLoading } = useList({
    collection: membersCollection,
    collectionIdentity,
    query: {
      orderBy: [{ field: "createdAt", direction: "desc" }],
    },
  });

  const [modalOpened, { open: openModal, close: closeModal }] =
    useDisclosure(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          <Tooltip label="新規追加">
            <ActionIcon variant="filled" size="lg" radius="xl" onClick={openModal}>
              <IconPlus size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <AutoTable
        schema={memberTableSchema}
        data={members}
        keyField="memberId"
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
          fileResolvers={fileResolvers}
          resolverContext={resolverContext}
          showPreview={true}
        />
      </Modal>
    </Container>
  );
};

export default MembersPage;
