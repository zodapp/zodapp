import {
  Title,
  Text,
  Container,
  Card,
  Stack,
  Loader,
  Center,
  Group,
  Menu,
  ActionIcon,
} from "@mantine/core";
import { IconDotsVertical } from "@tabler/icons-react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useMemo } from "react";
import { z } from "zod";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { firestore, storage } from "@repo/firebase";
import { createFirebaseStorageResolver } from "@zodapp/zod-form-firebase";
import { useStoreKey } from "../../../shared/auth";
import {
  DeleteMenuItem,
  useDeleteModal,
} from "@zodapp/zod-form-widget/feedback";

import { membersCollection } from "../../../shared/taskManager/collections/member";
import { AutoForm } from "../../../components/AutoForm";
import { memberDetailRoute } from "./detail.route";
import { membersRoute } from "../members.route";
import { CodeViewerModal } from "../../../components/CodeViewerModal";

import pageCode from "./detail.tsx?raw";
import collectionCode from "../../../shared/taskManager/collections/member.ts?raw";

const MemberDetailPage = () => {
  const { workspaceId, memberId } = useParams({
    from: memberDetailRoute.id,
  });
  const navigate = useNavigate();
  const storeKey = useStoreKey();
  const fileResolvers = useMemo(
    () => [createFirebaseStorageResolver({ storage })],
    [],
  );
  const resolverContext = useMemo(
    () => ({ workspace: { workspaceId } }),
    [workspaceId],
  );

  const accessor = useMemo(
    () => getAccessor(firestore, membersCollection, storeKey),
    [storeKey],
  );
  const [member, setMember] = useState<z.infer<
    typeof membersCollection.updateSchema
  > | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = accessor.docSync({ workspaceId, memberId }, (doc) => {
      setMember(doc);
    });
    return () => unsubscribe();
  }, [accessor, workspaceId, memberId]);

  const handleSubmit = useCallback(
    async (data: z.infer<typeof membersCollection.updateSchema>) => {
      setIsLoading(true);
      try {
        await accessor.updateDoc({ workspaceId, memberId }, data);
        navigate({
          to: membersRoute.to,
          params: { workspaceId },
        });
      } catch (error) {
        console.error("Failed to update member:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [accessor, workspaceId, memberId, navigate],
  );

  const { open: openDelete, modal: deleteModal } = useDeleteModal({
    title: "メンバーを削除",
    message: "このメンバーを削除しますか？この操作は元に戻せません。",
    onDelete: async () => {
      await accessor.deleteDoc({ workspaceId, memberId });
      navigate({
        to: membersRoute.to,
        params: { workspaceId },
      });
    },
  });

  const handleCancel = useCallback(() => {
    navigate({
      to: membersRoute.to,
      params: { workspaceId },
    });
  }, [navigate, workspaceId]);

  if (isLoading || !member) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>メンバー詳細</Title>
        <Group>
          <CodeViewerModal pageCode={pageCode} collectionCode={collectionCode} />
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <DeleteMenuItem label="メンバーを削除" onClick={openDelete} />
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Stack gap="lg">
        <Card withBorder>
          <Text fw={500} mb="md">
            メンバー情報
          </Text>
          <AutoForm
            schema={membersCollection.updateSchema}
            defaultValues={member}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
            submitLabel="更新"
            fileResolvers={fileResolvers}
            resolverContext={resolverContext}
            showPreview={true}
          />
        </Card>
      </Stack>
      {deleteModal}
    </Container>
  );
};

export default MemberDetailPage;
