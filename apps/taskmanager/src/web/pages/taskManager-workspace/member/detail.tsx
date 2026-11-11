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
import { useState, useCallback, useMemo } from "react";
import { z } from "zod";
import { useApi } from "@zodapp/zod-dynamodb-react";
import { createS3FileResolver } from "../../../shared/resolvers";
import type { Api } from "../../../shared/api";
import {
  DeleteMenuItem,
  useDeleteModal,
} from "@zodapp/zod-form-widget/feedback";

import { memberBodySchema } from "../../../../shared";
import { useMember } from "../../../shared/hooks";
import { AutoForm } from "../../../components/AutoForm";
import { memberDetailRoute } from "./detail.route";
import { membersRoute } from "../members.route";
import { useCodeViewerModal } from "../../../components/useCodeViewerModal";

import pageCode from "./detail.tsx?raw";
import collectionCode from "../../../../shared/tables/member.ts?raw";

const MemberDetailPage = () => {
  const { workspaceId, memberId } = useParams({
    from: memberDetailRoute.id,
  });
  const navigate = useNavigate();
  const api = useApi<Api>();
  const fileResolvers = useMemo(() => [createS3FileResolver()], []);
  const resolverContext = useMemo(
    () => ({ workspace: { workspaceId } }),
    [workspaceId],
  );

  // メンバーのキーは（ワークスペース, email）。ルートの memberId には email が入る
  const memberKey = useMemo(
    () => ({ workspaceId, email: memberId }),
    [workspaceId, memberId],
  );
  const { status, item: member, token } = useMember(memberKey);
  const isMemberLoading = status === "loading";
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (data: z.infer<typeof memberBodySchema>) => {
      setIsLoading(true);
      try {
        // 管理者はすべて、本人は表示名だけを変えられる（zodapp のルールと同じ）。
        // どちらが使えるかは、送る前に can で判定する
        if (api.members.update.can(memberKey, data).ok) {
          await api.members.update(memberKey, data, { ifUnchanged: token });
        } else {
          await api.members.updateProfile(
            memberKey,
            { displayName: data.displayName },
            { ifUnchanged: token },
          );
        }
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
    [api, memberKey, token, workspaceId, navigate],
  );

  const { open: openDelete, modal: deleteModal } = useDeleteModal({
    title: "メンバーを削除",
    message: "このメンバーを削除しますか？この操作は元に戻せません。",
    onDelete: async () => {
      await api.members.remove(memberKey);
      navigate({
        to: membersRoute.to,
        params: { workspaceId },
      });
    },
  });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  const handleCancel = useCallback(() => {
    navigate({
      to: membersRoute.to,
      params: { workspaceId },
    });
  }, [navigate, workspaceId]);

  if (isLoading || isMemberLoading || !member) {
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
          {codeViewerTrigger}
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
            schema={memberBodySchema}
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
      {codeViewerModal}
      {deleteModal}
    </Container>
  );
};

export default MemberDetailPage;
