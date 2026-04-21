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
  Menu,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconDotsVertical,
  IconDownload,
  IconUpload,
  IconSettings,
} from "@tabler/icons-react";
import { useParams } from "@tanstack/react-router";
import { useState, useCallback, useMemo } from "react";
import { getAccessor } from "@zodapp/zod-firebase-browser";
import { firestore, storage } from "@repo/firebase";
import { useStoreKey } from "../../shared/auth";
import {
  AutoTable,
  useTableSettingDrawer,
} from "@zodapp/zod-form-widget/table";
import { extendSchemaSafe } from "@zodapp/zod-form-widget";
import { useLocalColumnSettings } from "../../shared/taskManager/useLocalColumnSettings";
import { createFirebaseStorageResolver } from "@zodapp/zod-form-firebase";
import { createActionSchema } from "../../components/createActionSchema";
import {
  useExportModal,
  useImportModal,
} from "@zodapp/zod-form-widget/tabular";
import { useExportFetchAll } from "../../shared/taskManager/exportFetch";
import type { ListQuerySpec } from "../../shared/taskManager/listQuerySpec";

import { z } from "zod";

import { useList } from "../../shared/taskManager/hooks";
import { membersCollection } from "../../shared/taskManager/collections/member";
import { AutoForm } from "../../components/AutoForm";
import { membersRoute } from "./members.route";
import { memberDetailRoute } from "./member/detail.route";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";

import pageCode from "./members.tsx?raw";
import collectionCode from "../../shared/taskManager/collections/member.ts?raw";

const MEMBER_TABLE_STORAGE_KEY = "tableSetting-member";
const MEMBER_TABLE_DEFAULT_FIELD_PATHS = [
  "displayName",
  "email",
  "role",
  "createdAt",
  "updatedAt",
  "_action",
];

type MemberData = z.infer<typeof membersCollection.dataSchema>;

const MembersPage = () => {
  const { workspaceId } = useParams({
    from: membersRoute.id,
  });

  const memberTableSchema = useMemo(
    () =>
      extendSchemaSafe(membersCollection.dataSchema, {
        _action: createActionSchema<MemberData>({
          getParams: (item) => ({
            to: memberDetailRoute.to,
            params: { workspaceId, memberId: item.memberId },
          }),
        }),
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
  const memberListSpec = useMemo<ListQuerySpec<typeof membersCollection>>(
    () => ({
      collection: membersCollection,
      collectionIdentity,
      query: {
        orderBy: [{ field: "createdAt", direction: "desc" as const }],
      },
    }),
    [collectionIdentity],
  );

  const { items: members, isLoading } = useList(memberListSpec);

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

  const fetchAllMembers = useExportFetchAll(memberListSpec);

  const { open: openExport, modal: exportModal } = useExportModal({
    schema: membersCollection.dataSchema,
    data: members,
    fetchAll: fetchAllMembers,
    filename: `members-${workspaceId}.csv`,
  });

  const handleImport = useCallback(
    async (rows: z.infer<typeof membersCollection.createSchema>[]) => {
      for (const row of rows) {
        await memberAccessor.createDoc(collectionIdentity, row);
      }
    },
    [memberAccessor, collectionIdentity],
  );

  const { open: openImport, modal: importModal } = useImportModal({
    schema: membersCollection.createSchema,
    onImport: handleImport,
  });

  const controller = useLocalColumnSettings({
    storageKey: MEMBER_TABLE_STORAGE_KEY,
    schema: memberTableSchema,
    defaultFieldPaths: MEMBER_TABLE_DEFAULT_FIELD_PATHS,
  });

  const { open: openTableSetting, modal: tableSettingDrawer } =
    useTableSettingDrawer({
      controller,
    });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  return (
    <Container size="lg">
      <Group justify="space-between" mb="lg">
        <Title order={2}>メンバー一覧</Title>
        <Group>
          {codeViewerTrigger}
          <Tooltip label="新規追加">
            <ActionIcon
              variant="filled"
              size="lg"
              radius="xl"
              onClick={openModal}
            >
              <IconPlus size={20} />
            </ActionIcon>
          </Tooltip>
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>テーブル</Menu.Label>
              <Menu.Item
                leftSection={<IconSettings size={16} />}
                onClick={openTableSetting}
              >
                列設定
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>データ操作</Menu.Label>
              <Menu.Item
                leftSection={<IconDownload size={16} />}
                onClick={openExport}
              >
                CSVエクスポート
              </Menu.Item>
              <Menu.Item
                leftSection={<IconUpload size={16} />}
                onClick={openImport}
              >
                CSVインポート
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <AutoTable data={members} keyField="memberId" controller={controller} />
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

      {codeViewerModal}
      {exportModal}
      {importModal}
      {tableSettingDrawer}
    </Container>
  );
};

export default MembersPage;
