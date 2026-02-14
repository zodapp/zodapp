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
import { useState, useCallback, useEffect, useMemo } from "react";
import { z } from "zod";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { firestore } from "@repo/firebase";

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

  const accessor = useMemo(() => getAccessor(firestore, membersCollection), []);
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
        <CodeViewerModal pageCode={pageCode} collectionCode={collectionCode} />
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
            showPreview={true}
          />
        </Card>
      </Stack>
    </Container>
  );
};

export default MemberDetailPage;
